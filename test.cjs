#!/usr/bin/env node
// Context Persistence Plugin - Installation Test
// Run: node test.cjs

const path = require('path');
const fs = require('fs');

async function runTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Context Persistence Plugin - Installation Test         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const projectDir = process.cwd();
  let passed = 0;
  let failed = 0;

  // Test 1: Check built files exist
  console.log('1. Checking built files...');
  const distPath = path.join(projectDir, 'dist');
  const requiredFiles = [
    'cli/index.js',
    'database/client.js',
    'embedding/embedding.js',
    'context/retriever.js',
    'context/persister.js',
    'hooks/plugin.js',
    'types/index.js'
  ];
  
  let allFilesExist = true;
  for (const file of requiredFiles) {
    const filePath = path.join(distPath, file);
    if (!fs.existsSync(filePath)) {
      console.log(`   ✗ Missing: ${file}`);
      allFilesExist = false;
    }
  }
  
  if (allFilesExist) {
    console.log('   ✓ All required files present\n');
    passed++;
  } else {
    console.log('   ✗ Run: npm run build\n');
    failed++;
    process.exit(1);
  }

  // Test 2: Load modules
  console.log('2. Loading modules...');
  try {
    const { CLI } = await import('./dist/cli/index.js');
    const { LanceDBClient } = await import('./dist/database/client.js');
    const { createEmbeddingProvider } = await import('./dist/embedding/embedding.js');
    const { ContextRetriever } = await import('./dist/context/retriever.js');
    const { ContextPersister } = await import('./dist/context/persister.js');
    console.log('   ✓ All modules loaded successfully\n');
    passed++;
  } catch (e) {
    console.log(`   ✗ Failed to load: ${e.message}\n`);
    failed++;
    process.exit(1);
  }

  // Test 3: Initialize CLI
  console.log('3. Initializing CLI...');
  try {
    const { CLI } = await import('./dist/cli/index.js');
    const cli = new CLI(projectDir);
    await cli.init({});
    console.log('   ✓ CLI initialized\n');
    passed++;
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 4: Local embedding
  console.log('4. Testing local embedding (768 dimensions)...');
  try {
    const { createEmbeddingProvider } = await import('./dist/embedding/embedding.js');
    const embedder = createEmbeddingProvider({ provider: 'local', model: 'nomic-embed-text' });
    const result = await embedder.encode('test embedding for verification');
    
    if (result.vector.length === 768 && result.model === 'nomic-embed-text') {
      console.log(`   ✓ Vector dimension: ${result.vector.length}`);
      console.log(`   ✓ Model: ${result.model}\n`);
      passed++;
    } else {
      console.log('   ✗ Unexpected embedding result\n');
      failed++;
    }
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 5: Database operations
  console.log('5. Testing LanceDB operations...');
  const dbPath = path.join(projectDir, '.lancedb-test');
  try {
    const { LanceDBClient } = await import('./dist/database/client.js');
    const db = new LanceDBClient(dbPath);
    await db.initialize();
    
    // Insert test record
    await db.insert({
      id: 'test-verify',
      vector: new Array(768).fill(0.1),
      projectId: 'verify-test',
      contextType: 'decision',
      content: 'Test verification record',
      metadata: { decisionType: 'architecture', rationale: 'test', alternatives: [], stakeholders: [] },
      sessionId: 'test-session',
      createdAt: new Date().toISOString(),
      salience: 1.0
    });
    
    // Query it back
    const results = await db.query(new Array(768).fill(0.1), { limit: 5 });
    
    if (results.length > 0 && results[0].projectId === 'verify-test') {
      console.log(`   ✓ Insert and query working`);
      console.log(`   ✓ Retrieved ${results.length} record(s)\n`);
      passed++;
    } else {
      console.log('   ✗ Query returned unexpected results\n');
      failed++;
    }
    
    await db.close();
    
    // Cleanup test db
    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { recursive: true, force: true });
    }
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 6: Context retrieval scoring
  console.log('6. Testing context retrieval scoring...');
  try {
    const { CLI } = await import('./dist/cli/index.js');
    const { LanceDBClient } = await import('./dist/database/client.js');
    const { createEmbeddingProvider } = await import('./dist/embedding/embedding.js');
    const { ContextRetriever } = await import('./dist/context/retriever.js');
    
    const cli = new CLI(projectDir);
    await cli.init({});
    const config = await cli.getConfig();
    
    const testDbPath = path.join(projectDir, '.lancedb-score-test');
    const db = new LanceDBClient(testDbPath);
    await db.initialize();
    
    const embedder = createEmbeddingProvider({ provider: 'local', model: config.embeddingModel });
    const retriever = new ContextRetriever(db, embedder, config);
    
    // Test recency decay
    const now = Date.now();
    const recentScore = retriever.calculateScore(
      { vector: new Array(768).fill(0.5), projectId: 'test', contextType: 'decision', content: 'recent', metadata: { decisionType: 'architecture', rationale: 'test', alternatives: [], stakeholders: [] }, sessionId: 's1', createdAt: new Date(now).toISOString(), salience: 1.0 },
      new Array(768).fill(0.5),
      config.weights
    );
    
    const oldScore = retriever.calculateScore(
      { vector: new Array(768).fill(0.5), projectId: 'test', contextType: 'decision', content: 'old', metadata: { decisionType: 'architecture', rationale: 'test', alternatives: [], stakeholders: [] }, sessionId: 's1', createdAt: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(), salience: 1.0 },
      new Array(768).fill(0.5),
      config.weights
    );
    
    if (recentScore > oldScore) {
      console.log(`   ✓ Recency decay working`);
      console.log(`     Recent: ${recentScore.toFixed(4)}`);
      console.log(`     Old (30d): ${oldScore.toFixed(4)}\n`);
      passed++;
    } else {
      console.log(`   ✗ Recency decay not working properly\n`);
      failed++;
    }
    
    await db.close();
    
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true });
    }
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 7: Sensitive data redaction
  console.log('7. Testing sensitive data redaction...');
  try {
    const { CLI } = await import('./dist/cli/index.js');
    const { LanceDBClient } = await import('./dist/database/client.js');
    const { createEmbeddingProvider } = await import('./dist/embedding/embedding.js');
    const { ContextPersister } = await import('./dist/context/persister.js');
    
    const cli = new CLI(projectDir);
    await cli.init({});
    const config = await cli.getConfig();
    
    const testDbPath = path.join(projectDir, '.lancedb-redact-test');
    const db = new LanceDBClient(testDbPath);
    await db.initialize();
    
    const embedder = createEmbeddingProvider({ provider: 'local', model: config.embeddingModel });
    const persister = new ContextPersister(db, embedder, config);
    
    const sensitive = 'API_KEY=sk-12345 password=secret123 Bearer token123';
    const redacted = persister.redactSensitiveData(sensitive);
    
    await db.close();
    
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true });
    }
    
    const hasRedacted = redacted.includes('[REDACTED]');
    const hasSecrets = redacted.includes('sk-12345') || redacted.includes('secret123');
    
    if (hasRedacted && !hasSecrets) {
      console.log(`   ✓ Sensitive data properly redacted`);
      console.log(`     Input: ${sensitive.slice(0, 40)}...`);
      console.log(`     Output: ${redacted.slice(0, 40)}...\n`);
      passed++;
    } else {
      console.log('   ✗ Redaction not working properly\n');
      failed++;
    }
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 8: Configuration
  console.log('8. Testing configuration...');
  try {
    const { CLI } = await import('./dist/cli/index.js');
    const cli = new CLI(projectDir);
    await cli.init({});
    
    const config = await cli.getConfig();
    
    const hasRequiredFields = 
      typeof config.enabled === 'boolean' &&
      typeof config.embeddingModel === 'string' &&
      typeof config.maxContextTokens === 'number' &&
      typeof config.salienceDecay === 'number' &&
      config.weights !== undefined;
    
    if (hasRequiredFields) {
      console.log('   ✓ Configuration loaded correctly');
      console.log(`     Model: ${config.embeddingModel}`);
      console.log(`     Max tokens: ${config.maxContextTokens}`);
      console.log(`     Decay: ${config.salienceDecay}\n`);
      passed++;
    } else {
      console.log('   ✗ Missing required configuration\n');
      failed++;
    }
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}\n`);
    failed++;
  }

  // Summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                           ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Passed: ${passed}/${passed + failed}                                              ║`);
  console.log(`║  Failed: ${failed}/${passed + failed}                                              ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  if (failed === 0) {
    console.log('\n✓ All tests passed! Plugin is ready for use.');
    console.log('\nNext steps:');
    console.log('  1. Start OpenCode CLI in this directory');
    console.log('  2. The plugin will automatically inject context from prior sessions');
    console.log('  3. After sessions, context is persisted to .lancedb/');
    console.log('  4. Use: context-persist query "your search" to manually query\n');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests failed. Check the output above.');
    process.exit(1);
  }
}

runTest().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});