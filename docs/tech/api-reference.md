# API Reference

Programmatic API for integrating LLMNGN into your applications.

## Installation

```bash
npm install llmngn
```

## Exports

```typescript
import {
  ContextPersistencePlugin,
  ContextRetriever,
  ContextPersister,
  LanceDBClient,
  CloudEmbeddingProvider,
  LocalEmbeddingProvider,
  createEmbeddingProvider,
  ConfigManager,
  CLI
} from 'llmngn'
```

## LanceDBClient

Primary database client for managing context records.

### Constructor

```typescript
const client = new LanceDBClient(dbPath: string)
```

### Methods

#### `initialize()`

Creates the database and tables if they don't exist.

```typescript
await client.initialize()
```

#### `addRecord(record: RecordInput): Promise<string>`

Adds a new context record. Returns the record ID.

```typescript
const id = await client.addRecord({
  id: 'uuid-here',
  vector: [0.1, 0.2, ...],  // 1536 dimensions
  projectId: 'my-project',
  contextType: 'decision',
  content: 'Decided to use PostgreSQL',
  metadata: { decisionType: 'architecture' },
  sessionId: 'session-123',
  createdAt: new Date().toISOString(),
  salience: 1.0
})
```

#### `getRecord(id: string): Promise<ContextRecord | null>`

Retrieves a record by ID.

```typescript
const record = await client.getRecord('uuid-here')
```

#### `querySimilar(vector: number[], options?): Promise<SearchResult[]>`

Performs vector similarity search.

```typescript
const results = await client.querySimilar(embeddingVector, {
  limit: 10,
  type: 'decision',
  projectId: 'my-project'
})
```

#### `listRecords(options?): Promise<ContextRecord[]>`

Lists records with optional filters.

```typescript
const records = await client.listRecords({
  type: 'decision',
  sessionId: 'session-123',
  limit: 100
})
```

#### `deleteRecord(id: string): Promise<boolean>`

Deletes a record by ID.

```typescript
const deleted = await client.deleteRecord('uuid-here')
```

#### `deleteExpired(): Promise<number>`

Removes all expired records. Returns count deleted.

```typescript
const count = await client.deleteExpired()
```

#### `getStats(): Promise<DatabaseStats>`

Returns database statistics.

```typescript
const stats = await client.getStats()
// {
//   totalRecords: 150,
//   byType: { decision: 45, file_change: 80, ... },
//   oldestRecord: '2024-01-01T00:00:00Z',
//   newestRecord: '2024-03-15T12:00:00Z',
//   dbSizeBytes: 524288
// }
```

#### `close(): Promise<void>`

Closes the database connection.

```typescript
await client.close()
```

---

## ContextPersister

High-level service for persisting context with automatic embedding.

### Constructor

```typescript
const persister = new ContextPersister(client: LanceDBClient, embeddingProvider: EmbeddingProvider)
```

### Methods

#### `persist(input: PersistInput): Promise<string>`

Persists context with automatic embedding and metadata handling.

```typescript
const id = await persister.persist({
  contextType: 'decision',
  content: 'Decided to use Redis for session storage',
  metadata: {
    decisionType: 'library',
    rationale: 'Redis provides fast in-memory operations',
    alternatives: ['Memcached', 'PostgreSQL']
  },
  projectId: 'my-project',
  sessionId: 'session-123'
})
```

#### `persistBatch(inputs: PersistInput[]): Promise<string[]>`

Persists multiple records efficiently.

```typescript
const ids = await persister.persistBatch([
  { contextType: 'file_change', content: '...', metadata: {...} },
  { contextType: 'task', content: '...', metadata: {...} }
])
```

---

## ContextRetriever

High-level service for retrieving relevant context.

### Constructor

```typescript
const retriever = new ContextRetriever(client: LanceDBClient, embeddingProvider: EmbeddingProvider)
```

### Methods

#### `retrieve(query: string, options?: QueryOptions): Promise<SearchResult[]>`

Retrieves context relevant to a natural language query.

```typescript
const results = await retriever.retrieve('authentication', {
  types: ['decision', 'architecture'],
  limit: 5,
  since: '2024-01-01'
})
```

#### `retrieveForSession(sessionId: string): Promise<SearchResult[]>`

Retrieves all context from a specific session.

```typescript
const sessionContext = await retriever.retrieveForSession('session-123')
```

#### `formatForPrompt(results: SearchResult[], maxTokens?: number): string`

Formats results for injection into an LLM prompt.

```typescript
const formatted = retriever.formatForPrompt(results, 2000)
// Returns formatted string like:
// "## Recent Context
// 
// ### Decision: Use Redis for caching
// Decided to use Redis for session storage...
// ..."
```

---

## Embedding Providers

### CloudEmbeddingProvider

Uses OpenAI's embedding API.

```typescript
const provider = new CloudEmbeddingProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small'  // or 'text-embedding-3-large'
})
```

### LocalEmbeddingProvider

Uses local Ollama instance.

```typescript
const provider = new LocalEmbeddingProvider({
  baseUrl: 'http://localhost:11434',
  model: 'nomic-embed-text'
})
```

### createEmbeddingProvider

Factory function that creates the appropriate provider based on configuration.

```typescript
const provider = createEmbeddingProvider({
  provider: 'cloud',  // or 'local'
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small'
})
```

### EmbeddingProvider Interface

```typescript
interface EmbeddingProvider {
  name: string
  
  encode(text: string): Promise<EmbeddingResponse>
  encodeBatch(texts: string[]): Promise<EmbeddingResponse[]>
  isAvailable(): Promise<boolean>
}

interface EmbeddingResponse {
  vector: number[]
  model: string
  tokens: number
}
```

---

## ContextPersistencePlugin

OpenCode plugin for automatic context capture.

### Constructor

```typescript
const plugin = new ContextPersistencePlugin(config: PluginConfig)
```

### Methods

#### `registerHooks(hooks: PluginHooks): void`

Registers hook handlers with OpenCode.

```typescript
plugin.registerHooks({
  'session.created': handleSessionCreated,
  'file.edited': handleFileEdited,
  'command.executed': handleCommandExecuted
})
```

#### `initialize(): Promise<void>`

Initializes the plugin (creates DB, loads config).

```typescript
await plugin.initialize()
```

---

## Types

### ContextType

```typescript
type ContextType =
  | 'file_change'
  | 'decision'
  | 'debt'
  | 'task'
  | 'architecture'
  | 'command'
```

### ContextRecord

```typescript
interface ContextRecord {
  id: string
  vector: number[]
  projectId: string
  contextType: ContextType
  content: string
  metadata: ContextMetadata
  sessionId: string
  createdAt: string
  expiresAt?: string
  salience: number
}
```

### PluginConfig

```typescript
interface PluginConfig {
  enabled: boolean
  embeddingModel: string
  embeddingProvider: 'cloud' | 'local'
  apiKey?: string
  lancedbPath: string
  maxContextTokens: number
  queryLatencyMs: number
  salienceDecay: number
  retentionDays: number
  contextTypes: ContextType[]
  weights: Record<ContextType, number>
  filters: {
    excludePatterns: string[]
    sensitiveDataRedaction: boolean
  }
}
```

### SearchResult

```typescript
interface SearchResult {
  record: ContextRecord
  score: number
  similarity: number
  recency: number
  weightedScore: number
}
```

### QueryOptions

```typescript
interface QueryOptions {
  intent?: string
  types?: ContextType[]
  since?: string
  limit?: number
  weights?: Partial<Record<ContextType, number>>
}
```

---

## Error Handling

All methods throw typed errors:

```typescript
try {
  await client.addRecord(record)
} catch (error) {
  if (error instanceof DatabaseError) {
    console.error('Database error:', error.message)
  } else if (error instanceof EmbeddingError) {
    console.error('Embedding failed:', error.message)
  }
}
```

## Complete Example

```typescript
import { 
  LanceDBClient, 
  ContextPersister, 
  ContextRetriever,
  createEmbeddingProvider 
} from 'llmngn'

async function main() {
  const client = new LanceDBClient('.lancedb')
  await client.initialize()
  
  const embedding = createEmbeddingProvider({
    provider: 'cloud',
    apiKey: process.env.OPENAI_API_KEY
  })
  
  const persister = new ContextPersister(client, embedding)
  const retriever = new ContextRetriever(client, embedding)
  
  // Store a decision
  await persister.persist({
    contextType: 'decision',
    content: 'Decided to use PostgreSQL for primary database',
    metadata: {
      decisionType: 'architecture',
      rationale: 'Need ACID transactions and complex queries'
    },
    projectId: 'my-app',
    sessionId: 'session-1'
  })
  
  // Retrieve relevant context
  const results = await retriever.retrieve('database choice', {
    types: ['decision'],
    limit: 5
  })
  
  console.log(retriever.formatForPrompt(results, 1000))
  
  await client.close()
}

main()
```
