# Context Logging

Plugin: `opencode/plugins/llmngn.ts` | Storage: LanceDB

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
|------|------|----------|------------|
| `decision` | Architectural choices | 1.0 | 180d |
| `architecture` | System design | 1.0 | 365d |
| `file_change` | File edits | 0.8 | 90d |
| `debt` | Errors/tech debt | 0.9 | 90d |
| `completion` | Finished work | 0.85 | 60d |
| `task` | Task tracking | 0.7 | 60d |
| `command` | Shell commands | 0.5 | 30d |

## Flow

```
session.created → Query DB, inject context into prompt
         ↓
file.edited → persistContext("file_change")
command.executed → persistContext("command")
message.updated → detectCompletion() → persistContext()
session.idle → Persist session summary, cleanup expired
```

## Completion Detection

Pattern-matched actions: `fixed` (✓), `created` (+), `implemented` (★), `refactored` (↻), `updated` (↑), `resolved` (✓)

Trigger words: done, complete, finished, fixed, created, implemented, resolved, updated, refactored

## LLM Extraction

When `llm.enabled: true`, extracts structured context from messages.

Contexts: `message`, `error`, `command_result`, `file_diff`, `session_summary`, `completion`

Confidence threshold: 0.7

## Redaction

Patterns replaced with `[REDACTED]`:
- API keys, passwords, secrets, bearer tokens, AWS secrets, private keys

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
  "contextTypes": ["file_change", "decision", "debt", "task", "architecture", "command", "completion"],
  "llm": { "enabled": false }
}
```

## Key Functions

- `persistContext()` - Store context record
- `queryRecords()` - Retrieve by project
- `detectCompletion()` - Pattern-based completion detection
- `extractWithLLM()` - LLM-based extraction
- `redactSensitive()` - Clean sensitive data