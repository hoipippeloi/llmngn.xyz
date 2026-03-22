# Context Logging

Plugin: `opencode/plugins/llmngn.ts` | Storage: LanceDB | Table: `llmngn_context`

## Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique 22-char identifier |
| `vector` | number[768] | Embedding for semantic search |
| `project_id` | string | Project (directory basename) |
| `context_type` | string | Record type |
| `content` | string | Primary text |
| `context` | string | Optional agent reasoning (~30 tokens) |
| `metadata` | string | JSON metadata |
| `session_id` | string | Session identifier |
| `created_at` | number | Timestamp (ms) |
| `expires_at` | number | Expiry timestamp (ms) |
| `salience` | number | Importance (0-1) |

## Context Types

| Type | When | Salience | Retention |
|------|------|----------|------------|
| `decision` | Architectural choices | 1.0 | 180d |
| `architecture` | System design | 1.0 | 365d |
| `file_change` | File edits | 0.8 | 90d |
| `debt` | Errors/tech debt | 0.9 | 90d |
| `completion` | Finished work | 0.85 | 60d |
| `task` | Task tracking | 0.7 | 60d |

## Hooks

| Hook | Action |
|------|--------|
| `session.created` | Set session ID, query DB for context |
| `session.idle` | Persist session data with agent reasoning in `context` field |
| `session.error` | Store as `debt` |
| `file.edited` | Store as `file_change` with reasoning |
| `message.updated` | Detect completions, decisions |
| `todo.updated` | Store as `task` |

## Flow

```
session.created → Query DB → Inject context into prompt
         ↓
file.edited → persistContext("file_change", {...}, context)
message.updated → detectCompletion() → persistContext()
session.idle → Persist summary with chatContext in context field
```

## Completion Detection

Patterns: `fixed` (✓), `created` (+), `implemented` (★), `refactored` (↻), `updated` (↑), `resolved` (✓)

Triggers: done, complete, finished, fixed, created, implemented, resolved, updated, refactored

Output: `{symbol} {action}: {target}` → stored in `content`; agent reasoning in `context`

## LLM Extraction

When `llm.enabled: true`, extracts structured context via LLM.

Contexts: `message`, `error`, `file_diff`, `session_summary`, `completion`

Threshold: 0.7 confidence | Providers: `openai`, `anthropic`, `ollama`, `local`

## Redaction

Replaced with `[REDACTED]`: API keys, passwords, secrets, bearer tokens, AWS secrets, tokens, private keys

## Exclusions

```
**/node_modules/** **/dist/** **/.git/** **/build/**
**/*.min.js **/.env* **/package-lock.json
```

## Config

File: `.opencode/plugins/llmngn.json`

```json
{
  "enabled": true,
  "embeddingModel": "nomic-embed-text",
  "embeddingProvider": "local",
  "lancedbPath": ".lancedb",
  "maxContextTokens": 4096,
  "contextTypes": ["file_change", "decision", "debt", "task", "architecture", "completion"],
  "llm": { "enabled": false }
}
```

## Key Functions

| Function | Purpose |
|----------|---------|
| `persistContext(content, type, session, project, metadata, salience, context)` | Store record with agent reasoning |
| `queryRecords()` | Retrieve by project |
| `detectCompletion()` | Pattern-based completion detection |
| `extractWithLLM()` | LLM-based structured extraction |

## Session Data

```typescript
interface SessionData {
  sessionId: string
  filesEdited: Array<{ filePath, changes }>
  commands: Array<{ command, exitCode, duration }>  // in-memory only, not persisted
  decisions: Array<{ content, rationale? }>
  tasks: Array<{ content, status }>
  errors: Array<{ error, context? }>
  completions: Array<{ shorthand, action, target, message }>
}
```

## Debug

`debug: true` → `.opencode/plugins/llmngn-debug.log`

Operations: `initDatabase`, `insertRecord`, `queryRecords`, `deleteExpired`, `validateSchema`