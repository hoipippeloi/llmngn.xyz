# llmngn Database Logging Analysis

## Overview

When working with an agent, llmngn writes context records to a LanceDB table named `'llmngn_context'`. Each record captures architectural knowledge, decisions, and code changes for later retrieval.

## Database Schema

**File:** `src/database/schema.ts`

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `vector` | Embedding vector for semantic search |
| `project_id` | Project identifier |
| `context_type` | Type of context (see below) |
| `content` | The actual content/text |
| `metadata` | JSON metadata specific to context type |
| `session_id` | Session identifier |
| `created_at` | Creation timestamp |
| `expires_at` | Expiration timestamp |
| `salience` | Importance score (0-1) |

## Context Types

**File:** `src/types/index.ts`

| Type | Description | Default Salience | Retention |
|------|-------------|------------------|-----------|
| `file_change` | File modifications | 1.0 | 90 days |
| `decision` | Architectural/pattern decisions | 1.0 | 180 days |
| `debt` | Technical debt issues | 0.9 | 90 days |
| `task` | Todo items and tasks | 0.7 | 60 days |
| `architecture` | System design elements | varies | 365 days |
| `command` | CLI commands executed | 0.5 | 30 days |

## What Gets Written Per Operation

### File Edit/Write
- **Trigger:** `file.edited` hook, `tool.execute.after` hook (write/edit tools)
- **Type:** `file_change`
- **Content:** diff summary
- **Metadata:** `filePath`, `changeType`, `diffSummary`, `linesAdded`, `linesRemoved`, `relatedTasks`

### Command Execution
- **Trigger:** `command.executed` hook
- **Type:** `command`
- **Content:** command line
- **Metadata:** `commandLine`, `exitCode`, `duration`, `sideEffects`, `workingDirectory`

### Decision Made
- **Trigger:** `message.updated` hook (type=decision)
- **Type:** `decision`
- **Content:** rationale
- **Metadata:** `decisionType`, `rationale`, `alternatives`, `stakeholders`

### Task Updated
- **Trigger:** `todo.updated` hook
- **Type:** `task`
- **Content:** blocked reason or task ID
- **Metadata:** `taskId`, `status`, `dependencies`, `completedAt`, `blockedReason`

### Error Occurs
- **Trigger:** `session.error` hook
- **Type:** `error` (via LLM extraction) or `debt` (fallback)
- **Content:** error description or debt type description
- **Metadata:** error context or debt details

### Session Idle
- **Trigger:** `session.idle` hook
- **Action:** Writes full session summary via `persister.persistSession()` - all changes, decisions, tasks, commands, debt from the session

### LLM Message (with extraction enabled)
- **Trigger:** `message.updated` hook (assistant role)
- **Type:** varies (extracted by LLM)
- **Method:** `persistFromLLM()` or `persistFromExtraction()`

## Hooks & Write Flow

**File:** `src/hooks/plugin.ts`

| Hook | Lines | DB Writes |
|------|-------|-----------|
| `session.created` | 67-89 | None (retrieves only) |
| `session.idle` | 110-122 | Full session summary |
| `file.edited` | 124-151 | File changes |
| `command.executed` | 153-169 | Command metadata |
| `tool.execute.after` | 171-204 | File writes/edits |
| `message.updated` | 206-227 | LLM messages / decisions |
| `todo.updated` | 229-245 | Task updates |
| `session.error` | 247-276 | Errors / debt |
| `experimental.session.compacting` | 91-108 | None (retrieves only) |

## Persister Methods

**File:** `src/context/persister.ts`

| Method | Lines | Context Type |
|--------|-------|--------------|
| `persistFileChange()` | 171-201 | `file_change` |
| `persistDecision()` | 203-226 | `decision` |
| `persistTask()` | 228-251 | `task` |
| `persistCommand()` | 253-276 | `command` |
| `persistDebt()` | 278-299 | `debt` |
| `persistFromExtraction()` | 128-151 | varies |
| `persistFromLLM()` | 153-169 | varies |

## Sensitive Data Redaction

**File:** `src/context/persister.ts` (lines 14-23)

Redaction patterns automatically redact before storage:
- API keys, passwords, secrets
- Bearer tokens
- AWS secrets
- Private keys

Applied via `redactSensitiveData()` at lines 301-311.

## Key Files

| Purpose | File Path |
|---------|-----------|
| Database Schema | `src/database/schema.ts` |
| Database Client | `src/database/client.ts` |
| Plugin Hooks | `src/hooks/plugin.ts` |
| Context Persister | `src/context/persister.ts` |
| Context Retriever | `src/context/retriever.ts` |
| Semantic Extractor | `src/context/extractor.ts` |
| Type Definitions | `src/types/index.ts` |
| Configuration | `src/utils/config.ts` |
