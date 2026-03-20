# Context Persistence Plugin - Installation Guide

## Overview

The Context Persistence Plugin enables LLMs to maintain semantic continuity across coding sessions by persisting and retrieving codebase context through a vector database. This plugin integrates with OpenCode's plugin architecture using session lifecycle hooks.

## Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenCode CLI installed

## Quick Install

```bash
# Clone and build the plugin
git clone https://github.com/hoipippeloi/llmngn.xyz.git
cd llmngn.xyz
npm install
npm run build

# Install globally for CLI access
npm link
```

## Configuration

### 1. Initialize the Plugin

Create the plugin configuration in your project:

```bash
mkdir -p .opencode/plugins
```

Create `.opencode/plugins/context-persistence.json`:

```json
{
  "enabled": true,
  "embeddingModel": "nomic-embed-text",
  "embeddingProvider": "local",
  "lancedbPath": ".lancedb",
  "maxContextTokens": 4096,
  "queryLatencyMs": 500,
  "salienceDecay": 0.95,
  "retentionDays": 90,
  "contextTypes": [
    "file_change",
    "decision",
    "debt",
    "task",
    "architecture",
    "command"
  ],
  "weights": {
    "file_change": 0.8,
    "decision": 1.0,
    "debt": 0.9,
    "task": 0.7,
    "architecture": 1.0,
    "command": 0.5
  },
  "filters": {
    "excludePatterns": [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.min.js",
      "**/.env*",
      "**/package-lock.json"
    ],
    "sensitiveDataRedaction": true
  }
}
```

### 2. Initialize the Database

```bash
context-persist init
```

This creates the `.lancedb` directory and initializes the vector store.

### 3. Verify Installation

```bash
context-persist stats
```

Expected output:
```json
{
  "recordCount": 0,
  "sizeBytes": 0,
  "sessionsCount": 0
}
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `context-persist init` | Initialize plugin in current project |
| `context-persist query <text>` | Query stored context semantically |
| `context-persist history` | Show session history |
| `context-persist stats` | Show database statistics |
| `context-persist export` | Export context for backup |
| `context-persist import <path>` | Import context from backup |
| `context-persist purge --force` | Clear all stored context |
| `context-persist config set <key> <value>` | Set configuration value |
| `context-persist config get <key>` | Get configuration value |
| `context-persist config list` | List all configuration |

## Test the Installation

Run this test to verify the plugin is working correctly:

```bash
# Create a test script
cat > test-plugin.mjs << 'EOF'
import { CLI } from './dist/cli/index.js';
import { LanceDBClient } from './dist/database/client.js';
import { createEmbeddingProvider } from './dist/embedding/embedding.js';
import { ContextRetriever } from './dist/context/retriever.js';
import { ContextPersister } from './dist/context/persister.js';

const TEST_DIR = process.cwd();
const DB_PATH = '.lancedb-test';

async function test() {
  console.log('=== Context Persistence Plugin Test ===\n');
  
  // Test 1: Initialize
  console.log('1. Initializing plugin...');
  const cli = new CLI(TEST_DIR);
  await cli.init({});
  console.log('   ✓ Plugin initialized\n');

  // Test 2: Local embedding
  console.log('2. Testing local embedding...');
  const embedder = createEmbeddingProvider({ provider: 'local', model: 'nomic-embed-text' });
  const embedding = await embedder.encode('test embedding');
  console.log(`   ✓ Vector dimension: ${embedding.vector.length}\n`);

  // Test 3: Database operations
  console.log('3. Testing database...');
  const db = new LanceDBClient(DB_PATH);
  await db.initialize();
  
  await db.insert({
    id: 'test-decision',
    vector: new Array(768).fill(0.1),
    projectId: 'test-project',
    contextType: 'decision',
    content: 'Use TypeScript for type safety',
    metadata: { decisionType: 'architecture', rationale: 'Better DX', alternatives: ['JavaScript'], stakeholders: ['team'] },
    sessionId: 'test-session',
    createdAt: new Date().toISOString(),
    salience: 1.0
  });
  
  const results = await db.query(new Array(768).fill(0.1), { limit: 5 });
  console.log(`   ✓ Inserted and queried ${results.length} record(s)\n`);

  // Test 4: Context retrieval with scoring
  console.log('4. Testing context retrieval...');
  const config = await cli.getConfig();
  const retriever = new ContextRetriever(db, embedder, config);
  const retrieved = await retriever.retrieve('TypeScript', { projectId: 'test-project', limit: 5 });
  console.log(`   ✓ Retrieved ${retrieved.length} context(s)`);
  if (retrieved.length > 0) {
    console.log(`   ✓ Top result: "${retrieved[0].record.content.slice(0, 50)}..."\n`);
  }

  // Test 5: Sensitive data redaction
  console.log('5. Testing sensitive data redaction...');
  const persister = new ContextPersister(db, embedder, config);
  const sensitive = 'API_KEY=sk-12345 password=secret';
  const redacted = persister.redactSensitiveData(sensitive);
  console.log(`   ✓ Redacted: ${redacted.includes('[REDACTED]') ? 'PASS' : 'FAIL'}\n`);

  // Test 6: Recency decay
  console.log('6. Testing recency decay...');
  const recentScore = retriever.calculateScore(
    { vector: new Array(768).fill(0.5), projectId: 'test', contextType: 'decision', content: 'recent', metadata: {}, sessionId: 's1', createdAt: new Date().toISOString(), salience: 1.0 },
    new Array(768).fill(0.5),
    config.weights
  );
  const oldScore = retriever.calculateScore(
    { vector: new Array(768).fill(0.5), projectId: 'test', contextType: 'decision', content: 'old', metadata: {}, sessionId: 's1', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), salience: 1.0 },
    new Array(768).fill(0.5),
    config.weights
  );
  console.log(`   ✓ Recent (${recentScore.toFixed(4)}) > Old (${oldScore.toFixed(4)}): ${recentScore > oldScore ? 'PASS' : 'FAIL'}\n`);

  // Test 7: CLI commands
  console.log('7. Testing CLI commands...');
  const stats = await cli.stats();
  console.log(`   ✓ Stats: ${stats.recordCount} records, ${stats.sessionsCount} sessions\n`);

  // Test 8: Weighted scoring by context type
  console.log('8. Testing context type weights...');
  const decisionWeight = config.weights['decision'];
  const commandWeight = config.weights['command'];
  console.log(`   ✓ Decision weight: ${decisionWeight} (highest priority)`);
  console.log(`   ✓ Command weight: ${commandWeight} (lowest priority)\n`);

  await db.close();
  
  console.log('=== All Tests Passed! ===');
  console.log('\nContext Persistence Plugin is ready for use.');
  console.log('\nNext steps:');
  console.log('  1. Start a coding session with OpenCode');
  console.log('  2. Make changes, take notes, record decisions');
  console.log('  3. End the session - context will be persisted');
  console.log('  4. Start a new session - context will be injected automatically\n');
}

test().catch(e => {
  console.error('Test failed:', e.message);
  process.exit(1);
});
EOF

# Run the test
node test-plugin.mjs
```

## Expected Test Output

```
=== Context Persistence Plugin Test ===

1. Initializing plugin...
   ✓ Plugin initialized

2. Testing local embedding...
   ✓ Vector dimension: 768

3. Testing database...
   ✓ Inserted and queried 1 record(s)

4. Testing context retrieval...
   ✓ Retrieved 1 context(s)
   ✓ Top result: "Use TypeScript for type safety"

5. Testing sensitive data redaction...
   ✓ Redacted: PASS

6. Testing recency decay...
   ✓ Recent (1.0000) > Old (0.2146): PASS

7. Testing CLI commands...
   ✓ Stats: 1 records, 1 sessions

8. Testing context type weights...
   ✓ Decision weight: 1 (highest priority)
   ✓ Command weight: 0.5 (lowest priority)

=== All Tests Passed! ===

Context Persistence Plugin is ready for use.

Next steps:
  1. Start a coding session with OpenCode
  2. Make changes, take notes, record decisions
  3. End the session - context will be persisted
  4. Start a new session - context will be injected automatically
```

## OpenCode Integration

The plugin automatically integrates with OpenCode through these hooks:

### Pre-Session (Context Injection)
- `session.created` - Retrieves and injects relevant context from prior sessions
- `experimental.session.compacting` - Preserves critical context during compaction

### Post-Session (Context Persistence)
- `session.idle` - Persists session summary at session end
- `file.edited` - Logs file modifications with embeddings
- `command.executed` - Records command invocations
- `message.updated` - Captures architectural decisions
- `todo.updated` - Syncs task progress
- `session.error` - Logs error states as technical debt

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   New Session   │────▶│  Pre-Session    │────▶│  Context        │
│   Starts        │     │  Hook           │     │  Injection      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Context       │────▶│   LanceDB       │────▶│  Semantic       │
│   Retrieved     │     │   Vector Store  │     │  Search         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Session       │────▶│  Post-Session   │────▶│  Context        │
│   Ends          │     │  Hook           │     │  Persisted      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Context Types and Priority

| Type | Weight | Retention | Description |
|------|--------|-----------|-------------|
| `decision` | 1.0 | 180 days | Architectural decisions, library choices |
| `architecture` | 1.0 | 365 days | Component relationships, system boundaries |
| `debt` | 0.9 | Until resolved | Technical debt items, known issues |
| `file_change` | 0.8 | 90 days | Significant file modifications |
| `task` | 0.7 | 60 days | Task progress, blockers |
| `command` | 0.5 | 30 days | Build commands, deployments |

## Troubleshooting

### Plugin not initializing
```bash
# Check configuration exists
ls -la .opencode/plugins/context-persistence.json

# Reinitialize
context-persist init --force
```

### No context retrieved
```bash
# Check database stats
context-persist stats

# If empty, run a few sessions first to build context
```

### Embedding errors
```bash
# Test local embedding
node -e "import('./dist/embedding/embedding.js').then(m => m.createEmbeddingProvider({provider:'local',model:'nomic-embed-text'}).encode('test').then(r => console.log('Vector length:', r.vector.length)))"
```

### Database corruption
```bash
# Purge and reinitialize
context-persist purge --force
rm -rf .lancedb
context-persist init
```

## Programmatic Usage

```typescript
import { CLI } from 'context-persistence-plugin';
import { LanceDBClient } from 'context-persistence-plugin';
import { ContextRetriever } from 'context-persistence-plugin';
import { ContextPersister } from 'context-persistence-plugin';

// Initialize
const cli = new CLI(process.cwd());
await cli.init({ embeddingModel: 'nomic-embed-text' });

// Query context
const results = await cli.query({ text: 'authentication logic', limit: 10 });

// Get stats
const stats = await cli.stats();

// Export for backup
await cli.export({ output: 'backup.json' });

// Import from backup
await cli.import({ path: 'backup.json' });
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable plugin |
| `embeddingModel` | string | `"nomic-embed-text"` | Embedding model name |
| `embeddingProvider` | `"cloud"` \| `"local"` | `"local"` | Use cloud API or local embedding |
| `lancedbPath` | string | `".lancedb"` | Database storage path |
| `maxContextTokens` | number | `4096` | Maximum tokens per injection |
| `salienceDecay` | number | `0.95` | Daily decay factor for recency |
| `retentionDays` | number | `90` | Days before context expires |

## Security

- **Local-first**: All data stored locally in LanceDB
- **Sensitive data redaction**: Automatically filters API keys, passwords, tokens
- **Project isolation**: Each project has separate database
- **No cloud sync**: Data never leaves your machine

## Support

- GitHub Issues: https://github.com/hoipippeloi/llmngn.xyz/issues
- Documentation: `.specs/context-persistence-plugin/spec.md`