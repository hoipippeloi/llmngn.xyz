# llmngn Plugin - Context Logging System

## Overview

The llmngn plugin captures and persists context from agent sessions to LanceDB, enabling cross-session memory and continuity. It tracks file changes, decisions, technical debt, tasks, commands, and completions.

**Implementation:** Single file at `opencode/plugins/llmngn.ts`

---

## Database Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (random 22-char) |
| `vector` | number[768] | Embedding vector for semantic search |
| `project_id` | string | Project identifier (directory basename) |
| `context_type` | string | Type of context record |
| `content` | string | The actual content/text |
| `metadata` | string | JSON metadata specific to context type |
| `session_id` | string | Session identifier |
| `created_at` | number | Creation timestamp (ms) |
| `expires_at` | number | Expiration timestamp (ms) |
| `salience` | number | Importance score (0-1) |

**Table Name:** `llmngn_context`  
**Vector Size:** 768 dimensions  
**Schema Version:** 1.0.0

---

## Context Types

| Type | When Stored | Default Salience | Retention |
|------|-------------|------------------|-----------|
| `decision` | Architectural/pattern choices made | 1.0 | 180 days |
| `architecture` | System design mentions | 1.0 | 365 days |
| `file_change` | On file edits (create/modify/delete) | 0.8 | 90 days |
| `debt` | Technical debt from errors | 0.9 | 90 days |
| `completion` | When work is finished (fixed/created/implemented) | 0.85 | 60 days |
| `task` | When tasks are tracked | 0.7 | 60 days |
| `command` | After shell command execution | 0.5 | 30 days |

---

## Hooks & Write Flow

| Hook | Lines | DB Writes | Description |
|------|-------|-----------|-------------|
| `experimental.chat.system.transform` | 841-898 | Read only | Injects context into system prompt |
| `session.created` | 900-906 | None | Sets session ID |
| `session.idle` | 908-990 | Full session | Persists all session data, deletes expired |
| `session.error` | 992-1011 | `debt` | Extracts/persists error as technical debt |
| `file.edited` | 1013-1044 | `file_change` | Stores file modification details |
| `command.executed` | 1046-1064 | `command` | Stores command execution metadata |
| `message.updated` | 1066-1102 | `decision`, `completion`, varies | Extracts context from assistant messages |
| `todo.updated` | 1104-1124 | `task` | Stores task updates |
| `tool.execute.after` | 1126-1158 | `command`, `file_change` | Captures bash/write/edit tool usage |
| `experimental.session.compacting` | 1160-1196 | Read only | Preserves persistent context during compaction |
| `event` | 1198-1455 | Varies | Unified event handler for all event types |

---

## Session Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. SESSION START                                                │
│     session.created → Sets globalSessionId                       │
│     system.transform → Queries DB → Injects context into prompt  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. DURING SESSION                                               │
│     file.edited → persistContext("file_change")                  │
│     command.executed → persistContext("command")                 │
│     message.updated → detectCompletion() → persistContext()      │
│     todo.updated → persistContext("task")                        │
│     session.error → persistContext("debt")                       │
│     tool.execute.after → persistContext for bash/write/edit      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. SESSION IDLE                                                 │
│     session.idle →                                               │
│       - LLM enabled: extractWithLLM(session_summary)             │
│       - LLM disabled: Direct persist all sessionData             │
│       - Persist completion summary                               │
│       - deleteExpired() cleanup                                  │
│       - Reset sessionData arrays                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Completion Detection

The plugin automatically detects completed work from assistant messages using pattern matching:

**Action Patterns (lines 44-51):**
- `fixed` → ✓
- `created` → +
- `implemented` → ★
- `refactored` → ↻
- `updated` → ↑
- `resolved` → ✓

**Trigger words:** done, complete, finished, fixed, created, implemented, resolved, updated, refactored

**Output format:** `{symbol} {action}: {target}` (e.g., `✓ fixed: auth.ts`)

---

## LLM Extraction

When `llm.enabled: true`, the plugin uses an LLM to extract structured context.

**Extraction Contexts (lines 517-586):**

| Context | Purpose |
|---------|---------|
| `message` | Extract decisions, architecture, debt, tasks, file changes from conversation |
| `error` | Analyze errors for root cause, severity, fix recommendations |
| `command_result` | Extract command outcomes and follow-up actions |
| `file_diff` | Summarize file changes, categorize change type |
| `session_summary` | Extract key info for long-term memory |
| `completion` | Detect completed work with action/target/details |

**Confidence Threshold:** 0.7 (configurable via `llm.extractionConfidenceThreshold`)

**Providers:** `openai`, `anthropic`, `ollama`, `local`

---

## Sensitive Data Redaction

**Patterns (lines 23-32):**
- API keys (`API_KEY=...`, `api_key=...`)
- Passwords (`password=...`)
- Secrets (`secret=...`)
- Bearer tokens (`Bearer ...`)
- AWS secrets (`AWS_SECRET_ACCESS_KEY=...`)
- Tokens (`token=...`)
- Private keys (`private_key=...`)

All replaced with `[REDACTED]` before storage.

---

## File Exclusion

**Default patterns (lines 117-118):**
```
**/node_modules/**
**/dist/**
**/.git/**
**/build/**
**/*.min.js
**/.env*
**/package-lock.json
```

---

## Configuration

**File:** `.opencode/plugins/llmngn.json`

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
    "apiKey": null,
    "endpoint": null,
    "extractionConfidenceThreshold": 0.7
  }
}
```

---

## Key Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| `loadConfig()` | 208-224 | Load user config with defaults |
| `redactSensitive()` | 226-233 | Apply redaction patterns |
| `shouldExclude()` | 235-242 | Check file against exclusion patterns |
| `initDatabase()` | 253-265 | Connect to LanceDB |
| `validateSchema()` | 267-287 | Verify DB schema matches expected |
| `insertRecord()` | 289-331 | Insert context record into DB |
| `queryRecords()` | 333-356 | Query records by project |
| `deleteExpired()` | 358-364 | Remove expired records |
| `simpleEmbed()` | 366-378 | Generate simple embedding vector |
| `persistContext()` | 380-410 | Main function to store context |
| `llmComplete()` | 412-482 | Call LLM provider API |
| `llmExtractStructured()` | 484-515 | Extract structured data from LLM |
| `extractWithLLM()` | 670-697 | Extract context using LLM |
| `storeExtractedContext()` | 699-773 | Store extracted context to DB |
| `detectCompletion()` | 59-103 | Pattern-based completion detection |

---

## Session Data Structure

In-memory tracking during session (lines 165-174):

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

---

## Debug Logging

When `debug: true`, logs DB operations to `.opencode/plugins/llmngn-debug.log`.

**Tracked operations:**
- `initDatabase`
- `insertRecord`
- `queryRecords`
- `deleteExpired`
- `validateSchema`
- `extractWithLLM`
- `storeExtractedContext`
