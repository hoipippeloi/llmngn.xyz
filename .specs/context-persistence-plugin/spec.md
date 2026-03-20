# Context Persistence Plugin Technical Specification

## Executive Summary

The Context Persistence Plugin enables LLMs to maintain semantic continuity across coding sessions by persisting and retrieving codebase context through a vector database. This system captures development decisions, code changes, architectural knowledge, and task progress during sessions, then injects relevant context when new sessions begin. The plugin integrates with OpenCode.ai's plugin architecture using session lifecycle hooks, stores embeddings in LanceDB, and provides a CLI interface for configuration and management.

---

## 1. Architecture Overview

### 1.1 System Diagram

```mermaid
graph TB
    subgraph "OpenCode.ai Session"
        LLM[LLM Context]
        Hooks[Plugin Hooks]
    end
    
    subgraph "Context Persistence Plugin"
        CLI[CLI Application<br/>Crust Framework]
        PreHook[Pre-Session Hook]
        PostHook[Post-Session Hook]
        Embedder[Embedding Service]
        Querier[Query Engine]
    end
    
    subgraph "Storage Layer"
        LanceDB[(LanceDB<br/>Vector Store)]
        Metadata[Metadata Store]
    end
    
    subgraph "External Services"
        EmbeddingAPI[Embedding API<br/>nomic-embed-text /<br/>text-embedding-3-small]
    end
    
    LLM --> Hooks
    Hooks --> PreHook
    Hooks --> PostHook
    PreHook --> CLI
    PostHook --> CLI
    CLI --> Embedder
    CLI --> Querier
    Embedder --> EmbeddingAPI
    Embedder --> LanceDB
    Querier --> LanceDB
    Querier --> Metadata
```

### 1.2 Component Responsibilities

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| CLI Host | Crust + Node.js | Plugin lifecycle, command parsing, configuration |
| Pre-Session Hook | OpenCode Plugin API | Context retrieval and injection |
| Post-Session Hook | OpenCode Plugin API | Context extraction and persistence |
| Vector Store | LanceDB | Semantic storage and retrieval |
| Embedding Service | Cloud/Local API | Text-to-vector conversion |

### 1.3 Deployment Topology

```
Project Root/
├── .lancedb/                    # Vector database (per-project)
├── .opencode/
│   └── plugins/
│       └── context-persistence/
│           ├── config.json      # Plugin configuration
│           └── cache/           # Local embedding cache
├── node_modules/
└── src/                         # User codebase
```

---

## 2. Data Schema

### 2.1 LanceDB Collection Structure

**Collection Name:** `codebase_context`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `id` | UUID | Yes (Primary) | Unique record identifier |
| `vector` | Float[128] | Yes (IVF_PQ) | Embedding vector (128 dimensions) |
| `projectId` | String | Yes | Project identifier (folder name where .opencode/package.json/.git exists) |
| `contextType` | Enum | Yes | Category: `file_change`, `decision`, `debt`, `task`, `architecture`, `command` |
| `content` | Text | No | Raw text content for embedding |
| `metadata` | String (JSON) | No | Structured metadata stored as JSON string |
| `sessionId` | String | Yes | Source session identifier |
| `createdAt` | Number | Yes | Record creation time (Unix timestamp in ms) |
| `expiresAt` | Number | No | TTL for automatic pruning (Unix timestamp in ms) |
| `salience` | Float | Yes | Importance score (0.0-1.0) |

**Note:** The schema uses camelCase field names. The `projectId` is derived from the project folder name (e.g., "llmngn.xyz") rather than a hash, making it human-readable and portable.

### 2.2 Metadata Schema by Context Type

```typescript
interface FileChangeMetadata {
  filePath: string;
  changeType: 'create' | 'modify' | 'delete';
  diffSummary: string;
  linesAdded: number;
  linesRemoved: number;
  relatedTasks: string[];
}

interface DecisionMetadata {
  decisionType: 'architecture' | 'library' | 'pattern' | 'refactor';
  rationale: string;
  alternatives: string[];
  stakeholders: string[];
  reversedAt?: Timestamp;
}

interface TechnicalDebtMetadata {
  debtType: 'performance' | 'security' | 'maintainability' | 'testing';
  severity: 'low' | 'medium' | 'high' | 'critical';
  introducedIn: string;  // session_id
  estimatedEffort: string;  // story points
  blockingRelease: boolean;
}

interface TaskMetadata {
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  dependencies: string[];
  completedAt?: Timestamp;
  blockedReason?: string;
}

interface ArchitectureMetadata {
  component: string;
  layer: 'presentation' | 'business' | 'data' | 'infrastructure';
  relationships: string[];
  constraints: string[];
}

interface CommandMetadata {
  commandLine: string;
  exitCode: number;
  duration: number;  // milliseconds
  sideEffects: string[];
  workingDirectory: string;
}
```

### 2.3 Embedding Strategy

**Vector Dimensions:** 128 (local simple embedding)

**Embedding Algorithm:**
The current implementation uses a simple deterministic embedding that:
1. Splits text into words (max 50)
2. Creates a 128-dimensional vector from character code patterns
3. Applies tanh normalization

This provides basic semantic similarity without external API dependencies. Future versions may support pluggable embedding providers (nomic-embed-text, OpenAI, local transformers).

**Embedded Fields:**
- `content` (primary): Concatenated summary of changes, decisions, rationale
- `metadata.filePath` (for file changes): Relative path for semantic path queries
- `metadata.rationale` (for decisions): Decision reasoning text

**Stored as Metadata (Not Embedded):**
- All numeric fields (timestamps, counts, scores)
- Enumerations and status flags
- Binary identifiers (UUIDs, hashes)
- Large diff content (store summary only)

### 2.4 Index Configuration

```python
# LanceDB table creation
table = db.create_table(
    "codebase_context",
    schema=schema,
    mode="overwrite"
)

# Create vector index
table.create_index(
    metric_type="cosine",
    num_partitions=256,
    num_sub_vectors=96,
    vector_column="vector"
)

# Create scalar indexes
table.create_index("project_id")
table.create_index("context_type")
table.create_index("session_id")
table.create_index("created_at")
```

---

## 3. API Design

### 3.1 CLI Commands

```bash
# Initialize plugin in current project
context-persist init [--embedding-model <model>]

# Query stored context
context-persist query <text> [--limit <n>] [--type <type>]

# Show session history
context-persist history [--sessions <n>]

# Export context for backup
context-persist export [--output <path>]

# Import context from backup
context-persist import <path>

# Clear stored context
context-persist purge [--force]

# Show database statistics
context-persist stats

# Configure plugin
context-persist config set <key> <value>
context-persist config get <key>
context-persist config list
```

### 3.2 Plugin Hook Interface

```typescript
export const ContextPersistencePlugin = async ({ client, directory }) => {
  const db = await initLanceDB(directory)
  const projectId = basename(directory)  // Folder name, e.g., "llmngn.xyz"
  
  return {
    // === READ PATH ===
    
    "experimental.chat.system.transform": async (_input, output) => {
      // Primary context injection point - fires before each LLM call
      const context = await queryRelevantContext(db, projectId)
      if (context.length > 0) {
        output.system.push(formatContextInjection(context))
      }
    },
    
    "session.created": async (input) => {
      // Track session ID for associating records
      sessionId = input.session?.sessionId
    },
    
    // === WRITE PATH ===
    
    "session.idle": async () => {
      // Persist accumulated session data when session becomes idle
      await persistSessionSummary(db, sessionData, projectId)
    },
    
    // Primary capture hooks using tool.execute.after
    // Note: file.edited and command.executed hooks don't fire in OpenCode
    // We use tool.execute.after to capture bash, write, and edit operations
    
    "tool.execute.after": async (input, output) => {
      if (input.tool === "bash") {
        await persistCommand(db, output.args.command, projectId)
      }
      if (input.tool === "write" || input.tool === "edit") {
        await persistFileChange(db, output.args.filePath, input.tool, projectId)
      }
    },
    
    // Legacy hooks (kept for compatibility, may not fire in all OpenCode versions)
    "file.edited": async (input) => {
      await logFileChange(db, input.filePath, input.changes, projectId)
    },
    
    "command.executed": async (input) => {
      await logCommandExecution(db, input.command, input.result, projectId)
    },
  }
}
```

**Implementation Notes:**
- `experimental.chat.system.transform` is the primary hook for context injection
- `tool.execute.after` captures bash commands and file edits (write/edit tools)
- Legacy hooks (`file.edited`, `command.executed`) are registered but may not fire
- `projectId` uses folder name for human-readable identification
```

### 3.3 Configuration File Format

**Location:** `.opencode/plugins/context-persistence.json`

```json
{
  "enabled": true,
  "embeddingModel": "nomic-embed-text",
  "embeddingProvider": "local",
  "lancedbPath": ".lancedb",
  "maxContextTokens": 4096,
  "salienceDecay": 0.95,
  "retentionDays": 90,
  "debug": true,
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
      "**/.git/**",
      "**/build/**",
      "**/*.min.js",
      "**/.env*",
      "**/package-lock.json"
    ],
    "sensitiveDataRedaction": true
  }
}
```

**Key Settings:**
- `debug`: Enable verbose logging to `.opencode/plugins/context-persistence-debug.log`
- `lancedbPath`: Relative path from project root for database storage
- `weights`: Importance multipliers for different context types
- `filters.excludePatterns`: Glob patterns for files to skip
- `filters.sensitiveDataRedaction`: Auto-redact API keys, passwords, etc.
```

---

## 4. Lifecycle Flow

### 4.1 Pre-Session Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant OpenCode
    participant Plugin
    participant LanceDB
    participant EmbeddingAPI
    
    User->>OpenCode: Start new session
    OpenCode->>Plugin: Fire "session.created" hook
    Plugin->>LanceDB: Query recent context (project_id filter)
    LanceDB-->>Plugin: Return top-K relevant records
    Plugin->>EmbeddingAPI: Embed current session intent (optional)
    EmbeddingAPI-->>Plugin: Return query vector
    Plugin->>LanceDB: Semantic similarity search
    LanceDB-->>Plugin: Return ranked context
    Plugin->>Plugin: Apply weights and filters
    Plugin->>Plugin: Truncate to maxContextTokens
    Plugin-->>OpenCode: Inject context into session
    OpenCode->>User: Session starts with prior context
```

### 4.2 Post-Session Sequence Diagram

```mermaid
sequenceDiagram
    participant OpenCode
    participant Plugin
    participant LanceDB
    participant EmbeddingAPI
    
    OpenCode->>Plugin: Fire "session.idle" hook (session end)
    Plugin->>Plugin: Extract session summary
    Plugin->>Plugin: Identify decisions, changes, debts
    loop Each context item
        Plugin->>EmbeddingAPI: Embed content text
        EmbeddingAPI-->>Plugin: Return vector
        Plugin->>LanceDB: Insert record with metadata
        LanceDB-->>Plugin: Confirm persistence
    end
    Plugin->>LanceDB: Update salience scores (decay)
    Plugin->>LanceDB: Prune expired records
    Plugin-->>OpenCode: Hook complete
```

### 4.3 Error Recovery Flow

```mermaid
graph TD
    Start[Hook Triggered] --> CheckDB{LanceDB Available?}
    CheckDB -->|No| Fallback1[Log warning, skip persistence]
    CheckDB -->|Yes| CheckEmbed{Embedding Available?}
    CheckEmbed -->|No| Fallback2[Use cached vectors /<br/>skip embedding]
    CheckEmbed -->|Yes| CheckQuota{API Quota OK?}
    CheckQuota -->|No| Fallback3[Queue for retry /<br/>use local model]
    CheckQuota -->|Yes| Normal[Proceed normally]
    
    Fallback1 --> End[Continue session]
    Fallback2 --> End
    Fallback3 --> End
    Normal --> End
    
    style Fallback1 fill:#ffcc00
    style Fallback2 fill:#ffcc00
    style Fallback3 fill:#ffcc00
    style Normal fill:#99ff99
```

---

## 5. Context Taxonomy

### 5.1 Context Type Classification

| Type | Priority Weight | Retention | Description |
|------|-----------------|-----------|-------------|
| `decision` | 1.0 | 180 days | Architectural decisions, library choices, pattern selections |
| `architecture` | 1.0 | 365 days | Component relationships, system boundaries, API contracts |
| `debt` | 0.9 | Until resolved | Technical debt items, refactoring needs, known issues |
| `file_change` | 0.8 | 90 days | Significant file modifications, new files, deletions |
| `task` | 0.7 | 60 days | Task progress, blockers, completions |
| `command` | 0.5 | 30 days | Build commands, migrations, deployments |

### 5.2 Priority Scoring Algorithm

```python
def calculate_priority(record, query_vector):
    base_weight = WEIGHTS[record.context_type]
    
    # Semantic relevance (cosine similarity)
    relevance = cosine_similarity(record.vector, query_vector)
    
    # Recency decay (exponential)
    age_days = (now - record.created_at).days
    recency = config.salience_decay ** age_days
    
    # Manual salience boost
    salience = record.salience
    
    # Composite score
    score = base_weight * relevance * recency * salience
    
    return score
```

### 5.3 Retention Policies

| Policy | Action | Trigger |
|--------|--------|---------|
| TTL Expiry | Hard delete | `expires_at < now` |
| Salience Decay | Reduce priority | Daily batch job |
| Session Compaction | Merge related records | After 10 sessions |
| Project Archival | Compress to cold storage | 365 days inactive |

---

## 6. Retrieval Strategy

### 6.1 Query Patterns

```typescript
// Primary query: filter by projectId
async function queryRelevantContext(db, projectId, options) {
  const table = await db.openTable('codebase_context')
  const results = await table.query()
    .limit(options.limit || 50)
    .toArray()
  
  // Filter by projectId (folder name)
  return results.filter(r => r.projectId === projectId)
}

// Note: Full vector search requires explicit index creation
// Current implementation uses filtering + in-memory processing
```
```

### 6.2 Relevance Scoring

**Multi-Factor Ranking:**
1. **Cosine Similarity** (0.0-1.0): Vector distance to query
2. **Type Weight** (0.5-1.0): Context type priority
3. **Recency Score** (0.0-1.0): Exponential decay by age
4. **Manual Salience** (0.0-1.0): User/LLM-assigned importance

**Final Score:** `similarity × type_weight × recency × salience`

### 6.3 Context Window Management

```typescript
const MAX_CONTEXT_TOKENS = 4096  // Configurable

function truncateContext(records, maxTokens) {
  const sorted = sortByScore(records)
  const result = []
  let tokenCount = 0
  
  for (const record of sorted) {
    const tokens = countTokens(record.content)
    if (tokenCount + tokens <= maxTokens) {
      result.push(record)
      tokenCount += tokens
    }
  }
  
  return result
}
```

### 6.4 Deduplication Strategy

**Semantic Deduplication:**
- Compute pairwise cosine similarity
- Merge records with similarity > 0.95
- Keep most recent, preserve salience sum

**Exact Deduplication:**
- Hash `content + metadata.filePath`
- Skip insert if hash exists in last N sessions

---

## 7. Error Handling

### 7.1 Degradation Behavior

| Failure Mode | Degradation | Recovery |
|--------------|-------------|----------|
| LanceDB unavailable | Skip persistence, log warning | Retry on next hook |
| Embedding API timeout | Use cached vectors, skip new embeddings | Queue for batch retry |
| Rate limit exceeded | Switch to local model (if configured) | Exponential backoff |
| Database corruption | Create new DB, notify user | Restore from backup |
| Context query timeout | Return empty context, log metrics | Increase timeout limit |

### 7.2 Recovery Procedures

```typescript
async function handleEmbeddingFailure(record, embedder, cache) {
  // Attempt 1: Retry with backoff
  for (let i = 0; i < 3; i++) {
    try {
      return await embedder.encode(record.content, { timeout: 5000 })
    } catch (e) {
      await sleep(1000 * Math.pow(2, i))
    }
  }
  
  // Attempt 2: Use cached vector (if available)
  const cached = await cache.get(record.contentHash)
  if (cached) return cached
  
  // Attempt 3: Queue for batch processing
  await queueForBatchEmbedding(record)
  
  // Attempt 4: Local fallback model
  return await localEmbedder.encode(record.content)
}
```

### 7.3 Observability Requirements

**Metrics to Track:**
- Query latency (p50, p95, p99)
- Embedding API success rate
- Database size growth rate
- Context injection token count
- Deduplication ratio
- Cache hit rate

**Logging Format:**
```json
{
  "timestamp": "2025-01-19T10:30:00Z",
  "level": "info",
  "event": "context_injected",
  "sessionId": "abc123",
  "recordsCount": 15,
  "tokenCount": 3842,
  "queryLatencyMs": 234,
  "project": "llmngn.xyz"
}
```

---

## 8. Security Considerations

### 8.1 Data Isolation

**Project Isolation:**
- `projectId` derived from folder name (basename of project directory)
- Example: `/Users/dev/my-project` → `my-project`
- All queries include `projectId` filter
- Separate LanceDB databases per project (stored in `.lancedb/`)

**User Isolation:**
- Database stored in project directory by default
- Per-user configuration in `.opencode/plugins/context-persistence.json`

### 8.2 Access Controls

```typescript
// File permissions (Unix)
chmod 700 .lancedb/
chmod 600 .opencode/plugins/context-persistence.json

// Programmatic access check
function verifyProjectAccess(projectPath, userId) {
  const stat = fs.statSync(projectPath)
  return stat.uid === userId || stat.mode & 0o700
}
```

### 8.3 Sensitive Data Filtering

**Redaction Rules:**
```typescript
const REDACTION_PATTERNS = [
  /API_KEY=\S+/gi,
  /password:\s*\S+/gi,
  /secret:\s*\S+/gi,
  /Bearer\s+\S+/gi,
  /AWS_SECRET_ACCESS_KEY=\S+/gi,
]

function redactSensitiveData(content: string): string {
  return REDACTION_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, '[REDACTED]'),
    content
  )
}
```

**Excluded Files:**
- `.env*`, `*.pem`, `*.key`, `credentials.json`
- Files matching `config.excludePatterns`

### 8.4 Compliance Considerations

- No PII storage (personally identifiable information)
- GDPR right-to-deletion via `purge` command
- Audit log for data access (optional enterprise feature)
- Data residency: local-only storage (no cloud sync by default)

---

## 9. Performance Constraints

### 9.1 Latency Targets

| Operation | Target | Fallback |
|-----------|--------|----------|
| Context retrieval | < 500ms (p95) | 2000ms max |
| Session start blocking | < 2000ms | Async injection |
| Embedding API call | < 1000ms | Local model |
| Post-session persistence | < 5000ms | Background queue |

### 9.2 Storage Estimates

**Per Session:**
- Average context records: 10-20
- Vector size: 128 floats × 4 bytes = 512 bytes per record
- Metadata overhead: ~1KB per record
- **Total per session:** ~15-35KB

**Per 1000 Sessions:**
- **Estimated size:** 15-35MB
- **Growth rate:** ~25KB/session

### 9.3 Maximum Context Injection

| Setting | Default | Maximum |
|---------|---------|---------|
| Token limit | 4096 tokens | 8192 tokens |
| Record limit | 50 records | 200 records |
| Query timeout | 500ms | 2000ms |

---

## 10. Migration Path

### 10.1 Adoption Strategy for Existing Codebases

**Phase 1: Discovery (Session 1)**
- Initialize plugin, create empty database
- Log all session activity (write-only)
- No context injection yet

**Phase 2: Warming (Sessions 2-5)**
- Begin accumulating context
- Still no injection (building corpus)

**Phase 3: Active (Session 6+)**
- Enable full read-write cycle
- Inject relevant context from prior sessions
- Enable deduplication and compaction

### 10.2 Migration Commands

```bash
# Initialize for existing project
context-persist init --warmup-sessions 5

# Import context from another project
context-persist import --source ../other-project/.lancedb

# Dry-run: show what would be injected
context-persist query --dry-run --intent "refactor auth module"
```

---

## 11. Versioning Strategy

### 11.1 Schema Evolution

```typescript
// Schema version tracking
interface SchemaVersion {
  version: number;  // Increment on breaking changes
  migratedAt: Timestamp;
  migrationScript: string;
}

// Migration pattern
async function migrateSchema(db, fromVersion, toVersion) {
  const migrations = {
    1: addSalienceColumn,
    2: addExpirationTTL,
    3: extractProjectId,
  }
  
  for (let v = fromVersion + 1; v <= toVersion; v++) {
    await migrations[v](db)
    await recordMigration(db, v)
  }
}
```

### 11.2 Backward Compatibility

- Read old schema versions transparently
- Write in latest schema format
- Deprecation warnings for versions >2 major versions behind

---

## 12. Testing Strategy

### 12.1 Unit Tests

**Coverage Areas:**
- Embedding service mock
- LanceDB query builder
- Context weighting algorithm
- Deduplication logic
- Redaction filters

**Test Framework:** Vitest (aligned with project stack)

```typescript
describe('ContextPersistencePlugin', () => {
  it('injects prior session context on session.created', async () => {
    // Arrange
    const mockDB = createMockLanceDB()
    const plugin = createPlugin({ db: mockDB })
    
    // Act
    const output = await plugin['session.created']({ session: newSession }, { context: [] })
    
    // Assert
    expect(output.context).toHaveLength(1)
    expect(output.context[0]).toContain('prior session data')
  })
  
  it('persists file changes on file.edited', async () => {
    // Test implementation
  })
})
```

### 12.2 Integration Tests

**Test Scenarios:**
- Full session lifecycle (start → work → end)
- Context retrieval accuracy
- Database corruption recovery
- Embedding API failure handling

**Test Infrastructure:**
- Spin up real LanceDB instance
- Mock embedding API with recorded responses
- Use temporary test directories

### 12.3 End-to-End Tests

**E2E Flows:**
1. **Cold Start:** First session, no prior context
2. **Warm Start:** Session with prior context injection
3. **Multi-Session:** 5+ sessions, verify accumulation
4. **Cross-Project:** Verify project isolation
5. **Failure Recovery:** Kill DB, verify graceful degradation

**E2E Framework:** Playwright for CLI interaction

---

## 13. Non-Functional Requirements

### 13.1 Performance

- Context retrieval: < 500ms p95 latency
- Session start blocking: < 2 seconds maximum
- Support codebases with 10k+ files
- Batch embedding for post-session writes

### 13.2 Scalability

- Horizontal scaling: Multiple concurrent sessions via project isolation
- Partitioning: Separate LanceDB tables per project (auto)
- Connection pooling: Reuse LanceDB connections across hooks

### 13.3 Reliability

- Atomic writes: Transactional batch inserts
- Checkpoint/resume: Resume interrupted persistence
- Write-ahead log: Prevent partial corruption
- Health checks: Ping LanceDB on each hook

### 13.4 Usability

- Zero-config default: Works out-of-the-box
- CLI overrides: `--embedding-model`, `--max-tokens`, `--verbose`
- Progress indicators: Spinner for long operations
- Quiet mode: Suppress logs for production

---

## 14. Implementation Constraints

### 14.1 Technical Constraints

| Constraint | Rationale |
|------------|-----------|
| No OpenCode core modification | Plugin architecture only |
| Local LanceDB only | No cloud dependency requirement |
| Node.js 18+ minimum | Async/await, ESM support |
| Cross-platform (Win/Mac/Linux) | Electron/CLI compatibility |

### 14.2 Assumptions

| Assumption | Risk Mitigation |
|------------|-----------------|
| Network access for embedding API | Local fallback model (e.g., `@xenova/transformers`) |
| Sufficient disk space (~100MB/1000 sessions) | Automatic pruning, user warnings |
| OpenCode CLI in PATH | Installation script verification |
| Write permissions to project directory | Graceful degradation to user home |

---

## 15. Troubleshooting Guide

### 15.1 Common Issues

| Symptom | Probable Cause | Resolution |
|---------|----------------|------------|
| Context not injected | Empty database | Run 2-3 sessions to accumulate context |
| Context not injected | `experimental.chat.system.transform` not firing | Check OpenCode version compatibility |
| Hooks not firing | `file.edited`/`command.executed` deprecated | Use `tool.execute.after` instead |
| Schema mismatch error | Old database with snake_case fields | Delete `.lancedb/` and reinitialize |
| Slow session start | Large context query | Reduce `maxContextTokens` |
| Database errors | LanceDB not installed | Run `bun install` in `.opencode/` |

### 15.2 Diagnostic Commands

```bash
# Check database health
context-persist stats --verbose

# Test embedding connectivity
context-persist config test-embedding

# View recent context
context-persist query "recent changes" --limit 10

# Export debug logs
context-persist logs --output debug.log
```

### 15.3 Support Escalation

1. Check debug logs: `.opencode/plugins/context-persistence-debug.log`
2. Verify LanceDB exists: `.lancedb/codebase_context.lance/`
3. Check configuration: `.opencode/plugins/context-persistence.json`
4. File issue: https://github.com/llmngn.xyz/context-persistence-plugin/issues

**Debug Mode:**
Set `"debug": true` in config to enable verbose logging to the debug log file. This captures:
- Hook firing events
- Database operations
- Query results
- Error details

---

## Acceptance Criteria Checklist

- [x] Define clear integration points with OpenCode's plugin API (Section 3.2)
- [x] Specify exact data structure for stored context with field types (Section 2.1-2.2)
- [x] Describe embedding model selection with justification (Section 1.1, 2.3)
- [x] Include performance constraints (Section 9)
  - Query latency target: < 500ms
  - Storage estimates: ~50-100KB/session
  - Max context injection: 4096 tokens default
- [x] Address incremental updates vs. full replacement (Section 4.2, 6.4)
- [x] Provide migration path for existing codebases (Section 10)
- [x] Include versioning strategy for schema evolution (Section 11)
- [x] Specify logging and observability requirements (Section 7.3)
- [x] Define testing strategy (Section 12)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-19 | Initial specification |
| 1.1 | 2026-03-20 | Updated for current date, refined LanceDB schema |
| 1.2 | 2026-03-20 | Implementation updates: camelCase schema, 128-dim vectors, folder-based projectId, tool.execute.after hooks |

---

## Implementation Notes

### Actual Implementation (v1.2)

The current implementation differs from the original spec in several ways:

**Schema Changes:**
- Vector dimension reduced from 768 to 128 (simpler local embedding)
- Field names use camelCase (`projectId` not `project_id`)
- Timestamps are Unix milliseconds (numbers) not ISO strings
- Metadata stored as JSON string

**Hook Strategy:**
- Primary context injection: `experimental.chat.system.transform`
- Command capture: `tool.execute.after` (bash tool)
- File change capture: `tool.execute.after` (write/edit tools)
- Legacy hooks registered but may not fire

**Project ID:**
- Uses folder name (e.g., `llmngn.xyz`) for human-readable identification
- Portable across different mount points

**Debug Logging:**
- Logs written to `.opencode/plugins/context-persistence-debug.log`
- Enables troubleshooting of hook firing and data flow

---

**Specification Status:** Implemented

**Next Steps:** Add CLI commands for context management (query, export, purge).
