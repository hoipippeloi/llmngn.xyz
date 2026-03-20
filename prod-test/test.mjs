// Production test for context-persistence-plugin
const { CLI } = await import('../dist/cli/index.js');
const { LanceDBClient } = await import('../dist/database/client.js');
const { createEmbeddingProvider } = await import('../dist/embedding/embedding.js');
const { ContextRetriever } = await import('../dist/context/retriever.js');
const { ContextPersister } = await import('../dist/context/persister.js');
const { existsSync } = await import('fs');
const { rm } = await import('fs/promises');
const { join } = await import('path');

const TEST_DIR = process.cwd();
const DB_PATH = join(TEST_DIR, '.lancedb-test');

async function cleanup() {
  try {
    if (existsSync(DB_PATH)) {
      await rm(DB_PATH, { recursive: true, force: true });
    }
  } catch (e) {
    // ignore
  }
}

async function runTests() {
  console.log('=== Context Persistence Plugin Production Tests ===\n');
  
  let passed = 0;
  let failed = 0;

  // Test 1: Initialize plugin
  console.log('Test 1: Initialize plugin...');
  try {
    const cli = new CLI(TEST_DIR);
    await cli.init({ embeddingModel: 'nomic-embed-text' });
    console.log('  ✓ Plugin initialized successfully');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  // Test 2: Check configuration
  console.log('\nTest 2: Check configuration...');
  try {
    const cli = new CLI(TEST_DIR);
    await cli.init({});
    const config = await cli.getConfig();
    
    if (config.enabled && config.embeddingModel && config.maxContextTokens > 0) {
      console.log('  ✓ Configuration loaded correctly');
      console.log('    - Embedding model:', config.embeddingModel);
      console.log('    - Max context tokens:', config.maxContextTokens);
      console.log('    - Salience decay:', config.salienceDecay);
      passed++;
    } else {
      throw new Error('Invalid configuration');
    }
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  // Test 3: Database operations
  console.log('\nTest 3: Database operations...');
  try {
    const db = new LanceDBClient(DB_PATH);
    await db.initialize();
    
    // Insert test record
    await db.insert({
      id: 'test-1',
      vector: new Array(768).fill(0.1),
      projectId: 'test-project',
      contextType: 'decision',
      content: 'Use TypeScript for type safety',
      metadata: {
        decisionType: 'architecture',
        rationale: 'Better developer experience',
        alternatives: ['JavaScript', 'Flow'],
        stakeholders: ['team']
      },
      sessionId: 'session-1',
      createdAt: new Date().toISOString(),
      salience: 1.0
    });

    // Query record
    const results = await db.query(new Array(768).fill(0.1), { limit: 10 });
    
    if (results.length > 0 && results[0].content === 'Use TypeScript for type safety') {
      console.log('  ✓ Database insert and query working');
      passed++;
    } else {
      throw new Error('Query returned unexpected results');
    }
    
    await db.close();
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  // Test 4: Embedding service (local)
  console.log('\nTest 4: Local embedding service...');
  try {
    const embedder = createEmbeddingProvider({
      provider: 'local',
      model: 'nomic-embed-text'
    });
    
    const result = await embedder.encode('test text for embedding');
    
    if (result.vector.length === 768 && result.model === 'nomic-embed-text') {
      console.log('  ✓ Local embedding working');
      console.log('    - Vector dimension:', result.vector.length);
      console.log('    - Model:', result.model);
      passed++;
    } else {
      throw new Error('Unexpected embedding result');
    }
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  // Test 5: Context retrieval with scoring
  console.log('\nTest 5: Context retrieval with scoring...');
  try {
    const db = new LanceDBClient(DB_PATH);
    await db.initialize();
    
    const embedder = createEmbeddingProvider({
      provider: 'local',
      model: 'nomic-embed-text'
    });
    
    const config = await new CLI(TEST_DIR).getConfig();
    const retriever = new ContextRetriever(db, embedder, config);
    
    const results = await retriever.retrieve('TypeScript', {
      projectId: 'test-project',
      limit: 5
    });
    
    if (Array.isArray(results)) {
      console.log('  ✓ Context retrieval working');
      console.log('    - Results count:', results.length);
      if (results.length > 0) {
        console.log('    - Top result score:', results[0].weightedScore.toFixed(4));
      }
      passed++;
    } else {
      throw new Error('Unexpected retrieval result');
    }
    
    await db.close();
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  // Test 6: Context persistence
  console.log('\nTest 6: Context persistence...');
  try {
    const db = new LanceDBClient(DB_PATH);
    await db.initialize();
    
    const embedder = createEmbeddingProvider({
      provider: 'local',
      model: 'nomic-embed-text'
    });
    
    const config = await new CLI(TEST_DIR).getConfig();
    const persister = new ContextPersister(db, embedder, config);
    
    await persister.persistFileChange({
      filePath: '/src/app.ts',
      changeType: 'modify',
      diffSummary: 'Added authentication middleware',
      linesAdded: 25,
      linesRemoved: 5,
      relatedTasks: ['task-123']
    }, 'session-2', 'test-project');
    
    await persister.persistDecision({
      decisionType: 'library',
      rationale: 'Chose LanceDB for vector storage due to performance',
      alternatives: ['Pinecone', 'Weaviate'],
      stakeholders: ['architect']
    }, 'session-2', 'test-project');
    
    console.log('  ✓ Context persistence working');
    passed++;
    
    await db.close();
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  // Test 7: Sensitive data redaction
  console.log('\nTest 7: Sensitive data redaction...');
  try {
    const config = await new CLI(TEST_DIR).getConfig();
    const db = new LanceDBClient(DB_PATH);
    await db.initialize();
    
    const embedder = createEmbeddingProvider({
      provider: 'local',
      model: 'nomic-embed-text'
    });
    
    const persister = new ContextPersister(db, embedder, config);
    
    const sensitive = 'API_KEY=sk-12345 password=secret123 Bearer token123';
    const redacted = persister.redactSensitiveData(sensitive);
    
    if (!redacted.includes('sk-12345') && !redacted.includes('secret123') && redacted.includes('[REDACTED]')) {
      console.log('  ✓ Sensitive data redaction working');
      console.log('    - Original:', sensitive.slice(0, 30) + '...');
      console.log('    - Redacted:', redacted.slice(0, 30) + '...');
      passed++;
    } else {
      throw new Error('Redaction failed');
    }
    
    await db.close();
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  // Test 8: CLI stats command
  console.log('\nTest 8: CLI stats command...');
  try {
    const cli = new CLI(TEST_DIR);
    await cli.init({});
    
    const stats = await cli.stats();
    
    if ('recordCount' in stats && 'sessionsCount' in stats) {
      console.log('  ✓ CLI stats working');
      console.log('    - Record count:', stats.recordCount);
      console.log('    - Sessions:', stats.sessionsCount);
      passed++;
    } else {
      throw new Error('Invalid stats response');
    }
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  // Test 9: CLI config commands
  console.log('\nTest 9: CLI config commands...');
  try {
    const cli = new CLI(TEST_DIR);
    await cli.init({});
    
    const originalValue = await cli.configGet('maxContextTokens');
    
    await cli.configSet('maxContextTokens', '2048');
    const newValue = await cli.configGet('maxContextTokens');
    
    if (newValue === 2048) {
      console.log('  ✓ CLI config set/get working');
      console.log('    - Changed maxContextTokens:', originalValue, '→', newValue);
      passed++;
    } else {
      throw new Error('Config not updated');
    }
    
    // Restore original
    await cli.configSet('maxContextTokens', String(originalValue));
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  // Test 10: Weighted scoring algorithm
  console.log('\nTest 10: Weighted scoring algorithm...');
  try {
    const db = new LanceDBClient(DB_PATH);
    await db.initialize();
    
    const embedder = createEmbeddingProvider({
      provider: 'local',
      model: 'nomic-embed-text'
    });
    
    const config = await new CLI(TEST_DIR).getConfig();
    const retriever = new ContextRetriever(db, embedder, config);
    
    // Create test records with different context types
    const now = Date.now();
    const recentRecord = {
      id: 'recent',
      vector: new Array(768).fill(0.5),
      projectId: 'test',
      contextType: 'decision',
      content: 'Recent decision',
      metadata: { decisionType: 'architecture', rationale: 'test', alternatives: [], stakeholders: [] },
      sessionId: 's1',
      createdAt: new Date(now).toISOString(),
      salience: 1.0
    };
    
    const oldRecord = {
      id: 'old',
      vector: new Array(768).fill(0.5),
      projectId: 'test',
      contextType: 'decision',
      content: 'Old decision',
      metadata: { decisionType: 'architecture', rationale: 'test', alternatives: [], stakeholders: [] },
      sessionId: 's1',
      createdAt: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      salience: 1.0
    };
    
    const recentScore = retriever.calculateScore(recentRecord, new Array(768).fill(0.5), config.weights);
    const oldScore = retriever.calculateScore(oldRecord, new Array(768).fill(0.5), config.weights);
    
    if (recentScore > oldScore) {
      console.log('  ✓ Weighted scoring with recency decay working');
      console.log('    - Recent score:', recentScore.toFixed(4));
      console.log('    - Old score (30d):', oldScore.toFixed(4));
      passed++;
    } else {
      throw new Error('Recency decay not working');
    }
    
    await db.close();
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  // Summary
  console.log('\n=== Test Summary ===');
  console.log('Passed:', passed + '/' + (passed + failed));
  console.log('Failed:', failed + '/' + (passed + failed));
  
  if (failed === 0) {
    console.log('\n✓ All tests passed!');
  } else {
    console.log('\n✗ Some tests failed');
  }

  // Cleanup
  await cleanup();
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});