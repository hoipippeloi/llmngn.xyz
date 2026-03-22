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
| `context` | string | Optional agent reasoning |
| `metadata` | string | JSON metadata |
| `session_id` | string | Session identifier |
| `created_at` | number | Timestamp (ms) |
| `expires_at` | number | Expiry timestamp (ms) |
| `salience` | number | Importance (0-1) |

## Context Types

| Type | When | Salience | Retention |
|------|------|----------|-----------|
| `decision` | Architectural choices | 1.0 | 180d |
| `architecture` | System design | 1.0 | 365d |
| `file_change` | File edits | 0.8 | 90d |
| `debt` | Errors/tech debt | 0.9 | 90d |
| `completion` | Finished work | 0.85 | 60d |
| `task` | Task tracking | 0.7 | 60d |
| `command` | Shell commands | 0.5 | 30d |

## Hooks

| Hook | Action |
|------|--------|
| `experimental.chat.system.transform` | Inject context into system prompt (read only) |
| `session.created` | Set session ID |
| `session.idle` | Persist session data, delete expired |
| `session.error` | Store as `debt` |
| `file.edited` | Store as `file_change` |
| `command.executed` | Store as `command` |
| `message.updated` | Detect completions, decisions |
| `todo.updated` | Store as `task` |
| `tool.execute.after` | Capture bash/write/edit tool usage |
| `experimental.session.compacting` | Preserve persistent context (read only) |

## Flow

```
┌─ SESSION START ─────────────────────────────────────────────────┐
│  session.created → Set session ID                                │
│  system.transform → Query DB → Inject context into system prompt │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─ DURING SESSION ────────────────────────────────────────────────┐
│  file.edited → persistContext("file_change")                     │
│  command.executed → persistContext("command")                    │
│  message.updated → detectCompletion() → persistContext()         │
│  todo.updated → persistContext("task")                           │
│  session.error → persistContext("debt")                          │
│  tool.execute.after → persistContext for bash/write/edit         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─ SESSION IDLE ──────────────────────────────────────────────────┐
│  LLM enabled: extractWithLLM(session_summary)                    │
│  LLM disabled: Direct persist sessionData                        │
│  deleteExpired() cleanup → Reset sessionData                     │
└─────────────────────────────────────────────────────────────────┘
```

## Completion Detection

Patterns: `fixed` (✓), `created` (+), `implemented` (★), `refactored` (↻), `updated` (↑), `resolved` (✓)

Triggers: done, complete, finished, fixed, created, implemented, resolved, updated, refactored

Output: `{symbol} {action}: {target}` (e.g., `✓ fixed: auth.ts`)

## LLM Extraction

When `llm.enabled: true`, extracts structured context via LLM.

Contexts: `message`, `error`, `command_result`, `file_diff`, `session_summary`, `completion`

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
  "salienceDecay": 0.95,
  "retentionDays": 180,
  "debug": true,
  "contextTypes": ["file_change", "decision", "debt", "task", "architecture", "command", "completion"],
  "weights": {
    "file_change": 0.8,
    "decision": 1,
    "debt": 0.9,
    "task": 0.7,
    "architecture": 1,
    "command": 0.5,
    "completion": 0.85
  },
  "filters": {
    "excludePatterns": ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/build/**", "**/*.min.js", "**/.env*", "**/package-lock.json"],
    "sensitiveDataRedaction": true
  },
  "llm": {
    "enabled": false,
    "provider": "openai",
    "model": "gpt-4o-mini",
    "extractionConfidenceThreshold": 0.7
  }
}
```

## Key Functions

| Function | Purpose |
|----------|---------|
| `loadConfig()` | Load user config with defaults |
| `redactSensitive()` | Apply redaction patterns |
| `shouldExclude()` | Check file against exclusion patterns |
| `initDatabase()` | Connect to LanceDB |
| `insertRecord()` | Insert context record |
| `queryRecords()` | Retrieve by project |
| `deleteExpired()` | Remove expired records |
| `persistContext()` | Main function to store context |
| `llmComplete()` | Call LLM provider API |
| `llmExtractStructured()` | Extract structured data from LLM |
| `extractWithLLM()` | Extract context using LLM |
| `storeExtractedContext()` | Store extracted context to DB |
| `detectCompletion()` | Pattern-based completion detection |

## Session Data

```typescript
interface SessionData {
  sessionId: string
  startTime: string
  filesEdited: Array<{ filePath: string; changes: string }>
  commands: Array<{ command: string; exitCode: number; duration: number }>
  decisions: Array<{ content: string; rationale?: string }>
  tasks: Array<{ content: string; status: string }>
  errors: Array<{ error: string; context?: string }>
  completions: Array<{ shorthand: string; action: string; target: string; message: string }>
}
```

## Debug

`debug: true` → `.opencode/plugins/llmngn-debug.log`

Operations: `initDatabase`, `insertRecord`, `queryRecords`, `deleteExpired`, `validateSchema`, `extractWithLLM`, `storeExtractedContext`
