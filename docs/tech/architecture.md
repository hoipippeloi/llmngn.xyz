# Architecture

This document describes the internal architecture of LLMNGN.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         OpenCode CLI                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Hook Events
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ContextPersistencePlugin                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Hooks     │  │  Persister  │  │      Retriever          │ │
│  │  Handler    │──▶│  Service    │  │      Service            │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │                    │
                              │                    │
              ┌───────────────┘                    └───────────────┐
              ▼                                                    ▼
┌─────────────────────────┐                        ┌─────────────────────────┐
│   Embedding Provider    │                        │       LanceDB           │
│  ┌───────────────────┐  │                        │   (Vector Storage)      │
│  │ Cloud (OpenAI)    │  │                        │                         │
│  │ Local (Ollama)    │  │                        │   ┌─────────────────┐   │
│  └───────────────────┘  │                        │   │ context_records │   │
└─────────────────────────┘                        │   └─────────────────┘   │
                                                   └─────────────────────────┘
```

## Core Components

### 1. ContextPersistencePlugin

Entry point for OpenCode hooks. Registered in `.opencode/plugins/llmngn.ts`.

**Responsibilities:**
- Register hook handlers for OpenCode events
- Route events to appropriate services
- Handle initialization and configuration

**Hook Events:**

| Event | Trigger | Action |
|-------|---------|--------|
| `session.created` | New session starts | Query relevant context |
| `file.edited` | File modified | Store file change record |
| `command.executed` | CLI command run | Store command record |
| `todo.updated` | Task status changed | Store task record |
| `session.error` | Error occurred | Store error context |

### 2. ContextPersister

Handles storing context records to the database.

**Responsibilities:**
- Generate embeddings for content
- Apply sensitive data redaction
- Set expiration dates based on context type
- Store records in LanceDB

**Data Flow:**

```typescript
// Input: Raw event data
const input = {
  contextType: 'decision',
  content: 'Decided to use Redis for caching',
  metadata: { decisionType: 'library' }
}

// Processing:
// 1. Redact sensitive data
// 2. Generate embedding vector
// 3. Calculate salience score
// 4. Set expiration date

// Output: ContextRecord stored in LanceDB
```

### 3. ContextRetriever

Queries and retrieves relevant context.

**Responsibilities:**
- Semantic search via vector similarity
- Apply type filters and weights
- Calculate combined relevance scores
- Format context for injection

**Scoring Formula:**

```
weightedScore = (similarity * 0.4) + (recency * 0.3) + (typeWeight * 0.3)
```

### 4. EmbeddingProvider

Converts text to vector embeddings.

**Providers:**

| Provider | Model | Dimensions | Use Case |
|----------|-------|------------|----------|
| Cloud | text-embedding-3-small | 1536 | Production, requires API key |
| Local | nomic-embed-text | 768 | Offline, privacy-focused |

**Interface:**

```typescript
interface EmbeddingProvider {
  name: string
  encode(text: string): Promise<EmbeddingResponse>
  encodeBatch(texts: string[]): Promise<EmbeddingResponse[]>
  isAvailable(): Promise<boolean>
}
```

### 5. LanceDBClient

Database abstraction layer.

**Responsibilities:**
- Connection management
- Table creation and schema
- CRUD operations
- Vector similarity search

## Data Model

### ContextRecord Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID identifier |
| `vector` | number[] | Embedding vector (1536 or 768 dims) |
| `projectId` | string | Project identifier |
| `contextType` | ContextType | Type of context (decision, file_change, etc.) |
| `content` | string | Text content |
| `metadata` | object | Type-specific metadata |
| `sessionId` | string | Session identifier |
| `createdAt` | string | ISO timestamp |
| `expiresAt` | string | ISO timestamp |
| `salience` | number | Importance score (0-1) |

### Metadata Types

Each context type has specialized metadata:

**FileChangeMetadata:**
```typescript
{
  filePath: string
  changeType: 'create' | 'modify' | 'delete'
  diffSummary: string
  linesAdded: number
  linesRemoved: number
  relatedTasks: string[]
}
```

**DecisionMetadata:**
```typescript
{
  decisionType: 'architecture' | 'library' | 'pattern' | 'refactor'
  rationale: string
  alternatives: string[]
  stakeholders: string[]
  reversedAt?: string
}
```

**TechnicalDebtMetadata:**
```typescript
{
  debtType: 'performance' | 'security' | 'maintainability' | 'testing'
  severity: 'low' | 'medium' | 'high' | 'critical'
  introducedIn: string
  estimatedEffort: string
  blockingRelease: boolean
}
```

## Configuration Flow

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ llmngn.json   │────▶│ ConfigManager │────▶│ Services      │
│ (user config) │     │ (validation)  │     │ (runtime)     │
└───────────────┘     └───────────────┘     └───────────────┘
```

Configuration is loaded at startup and validated against the schema. Invalid values fall back to defaults.

## Performance Considerations

### Embedding Generation

- **Cloud**: ~50-100ms per request
- **Local**: ~10-50ms per request (depends on hardware)
- **Batching**: Use `encodeBatch()` for multiple texts

### Vector Search

- LanceDB uses IVF-PQ indexing for fast ANN search
- Search latency: ~5-20ms for 10K records
- Memory usage: ~1MB per 1000 records

### Storage

- Each record: ~2-6KB (depends on content length)
- Vector storage: 1536 floats * 4 bytes = 6KB per record
- Recommended max: 50,000 records per project
