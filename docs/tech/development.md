# Development Guide

Guide for contributors and developers working on LLMNGN.

## Prerequisites

- Node.js 18+
- Bun or npm
- Git

## Setup

```bash
# Clone the repository
git clone https://github.com/hoipippeloi/llmngn.xyz.git
cd llmngn.xyz

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Link CLI globally (optional)
npm link
```

## Project Structure

```
llmngn.xyz/
├── src/
│   ├── index.ts              # Main exports
│   ├── cli.ts                # CLI entry point
│   ├── cli/
│   │   └── index.ts          # CLI implementation
│   ├── context/
│   │   ├── index.ts
│   │   ├── persister.ts      # Context storage service
│   │   └── retriever.ts      # Context retrieval service
│   ├── database/
│   │   ├── index.ts
│   │   ├── client.ts         # LanceDB client
│   │   └── schema.ts         # Database schema definitions
│   ├── embedding/
│   │   ├── index.ts
│   │   └── embedding.ts      # Embedding providers
│   ├── hooks/
│   │   ├── index.ts
│   │   └── plugin.ts         # OpenCode plugin hooks
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   └── utils/
│       ├── index.ts
│       └── config.ts         # Configuration management
├── test/
│   └── setup.ts              # Test setup
├── docs/
│   └── *.md                  # Documentation
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run dev` | Watch mode for development |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run typecheck` | Type check without emitting |

## Architecture

### Module Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        src/index.ts                         │
│                     (Public API exports)                    │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   hooks/    │  │  context/   │  │  database/  │  │  embedding/ │
│  plugin.ts  │  │ persister   │  │  client.ts  │  │ embedding.ts│
│             │  │ retriever   │  │  schema.ts  │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

### Data Flow

```
1. Hook Event
   └─▶ ContextPersistencePlugin.handleHook()
       └─▶ ContextPersister.persist()
           ├─▶ Redaction filter
           ├─▶ EmbeddingProvider.encode()
           └─▶ LanceDBClient.addRecord()

2. Session Start
   └─▶ ContextPersistencePlugin.onSessionCreated()
       └─▶ ContextRetriever.retrieve()
           ├─▶ EmbeddingProvider.encode(query)
           ├─▶ LanceDBClient.querySimilar()
           └─▶ Format results for prompt
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Structure

Tests are co-located with source files:

```
src/
├── database/
│   ├── client.ts
│   └── client.test.ts
├── embedding/
│   ├── embedding.ts
│   └── embedding.test.ts
└── ...
```

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { LanceDBClient } from './client'

describe('LanceDBClient', () => {
  let client: LanceDBClient

  beforeEach(async () => {
    client = new LanceDBClient('.test-lancedb')
    await client.initialize()
  })

  it('should add a record', async () => {
    const id = await client.addRecord({
      id: 'test-id',
      vector: [0.1, 0.2],
      projectId: 'test',
      contextType: 'decision',
      content: 'Test content',
      metadata: {},
      sessionId: 'session-1',
      createdAt: new Date().toISOString(),
      salience: 1.0
    })

    expect(id).toBe('test-id')
  })
})
```

### Mock Embeddings

For tests that don't need real embeddings:

```typescript
const mockEmbedding: EmbeddingProvider = {
  name: 'mock',
  encode: async () => ({ vector: new Array(1536).fill(0), model: 'mock', tokens: 0 }),
  encodeBatch: async (texts) => texts.map(() => ({ vector: new Array(1536).fill(0), model: 'mock', tokens: 0 })),
  isAvailable: async () => true
}
```

## Code Style

### TypeScript Guidelines

- Use strict mode
- Prefer interfaces over types for object shapes
- Export from index files
- Use async/await over raw promises

```typescript
// Preferred
export interface ContextRecord {
  id: string
  content: string
}

// Avoid
export type ContextRecord = {
  id: string
  content: string
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `LanceDBClient` |
| Functions | camelCase | `addRecord()` |
| Constants | SCREAMING_SNAKE | `SCHEMA_VERSION` |
| Interfaces | PascalCase | `ContextRecord` |
| Types | PascalCase | `ContextType` |
| Files | kebab-case | `embedding-provider.ts` |

### Error Handling

```typescript
// Throw typed errors
export class DatabaseError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = 'DatabaseError'
  }
}

// Use in code
if (!connected) {
  throw new DatabaseError('Not connected to database')
}
```

## Adding New Features

### Adding a Context Type

1. Update `src/types/index.ts`:

```typescript
export type ContextType =
  | 'file_change'
  | 'decision'
  | 'debt'
  | 'task'
  | 'architecture'
  | 'command'
  | 'new_type'  // Add here

export interface NewTypeMetadata {
  // Define metadata structure
}
```

2. Update `ContextMetadata` union:

```typescript
export type ContextMetadata =
  | FileChangeMetadata
  | DecisionMetadata
  | TechnicalDebtMetadata
  | TaskMetadata
  | ArchitectureMetadata
  | CommandMetadata
  | InitMetadata
  | NewTypeMetadata  // Add here
  | Record<string, unknown>
```

3. Update default configuration in `src/utils/config.ts`:

```typescript
const DEFAULT_WEIGHTS: Record<ContextType, number> = {
  // ...
  new_type: 0.6
}
```

### Adding an Embedding Provider

1. Implement the interface:

```typescript
export class NewEmbeddingProvider implements EmbeddingProvider {
  name = 'new-provider'

  async encode(text: string): Promise<EmbeddingResponse> {
    // Implementation
  }

  async encodeBatch(texts: string[]): Promise<EmbeddingResponse[]> {
    // Implementation
  }

  async isAvailable(): Promise<boolean> {
    // Implementation
  }
}
```

2. Update factory function in `src/embedding/embedding.ts`:

```typescript
export function createEmbeddingProvider(config: Config): EmbeddingProvider {
  switch (config.provider) {
    case 'cloud':
      return new CloudEmbeddingProvider(config)
    case 'local':
      return new LocalEmbeddingProvider(config)
    case 'new-provider':
      return new NewEmbeddingProvider(config)
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}
```

## Debugging

### Enable Debug Logs

```bash
DEBUG=llmngn:* llmngn stats
```

### Database Inspection

```bash
# View raw database files
ls -la .lancedb/

# Export and inspect
llmngn export -o debug.json
cat debug.json | jq '.records[0]'
```

### Common Issues

**Embedding failures:**
```bash
# Check API key
echo $OPENAI_API_KEY

# Test local Ollama
curl http://localhost:11434/api/embeddings -d '{"model":"nomic-embed-text","prompt":"test"}'
```

**Database errors:**
```bash
# Reset database
rm -rf .lancedb
llmngn init
```

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Run tests: `npm test`
4. Build: `npm run build`
5. Publish: `npm publish`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run lint and tests
5. Submit a pull request

### Commit Messages

Follow conventional commits:

```
feat: add new embedding provider
fix: handle empty query results
docs: update API reference
test: add tests for retriever
refactor: simplify config validation
```
