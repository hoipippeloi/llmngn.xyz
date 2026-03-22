# Session Logging Flow (Agent + Plugin)

## Overview

When an agent works with the llmngn plugin installed, context is automatically captured and stored across session events.

## Step-by-Step Logging Process

### 1. Session Start
```
Agent starts → OpenCode fires 'session.created' hook
  → Plugin retrieves past context from DB via ContextRetriever
  → Context injected into agent's system prompt
```

### 2. During Session - Decision Made
```
Agent makes decision → OpenCode fires 'message.updated' hook
  → If LLM extraction enabled: SemanticExtractor.extract() → LLM
  → Else: ContextPersister.persistDecision()
  → Record stored in LanceDB with embedding
```

### 3. During Session - File Edit
```
Agent edits file → OpenCode fires 'file.edited' / 'tool.execute.after' hook
  → ContextPersister.persistFileChange()
  → Record stored with type 'file_change'
```

### 4. During Session - Command Run
```
Agent runs command → OpenCode fires 'command.executed' hook
  → ContextPersister.persistCommand()
  → Record stored with type 'command'
```

### 5. Session Idle
```
Session becomes idle → OpenCode fires 'session.idle' hook
  → ContextPersister.persistSession() - full summary
  → Database cleanup - deleteExpired()
```

### 6. Session Error
```
Session errors → OpenCode fires 'session.error' hook
  → If LLM enabled: SemanticExtractor.extractTechnicalDebt()
  → Else: ContextPersister.persistDebt()
  → Technical debt record created
```

## Key Components

| Component | File | Role |
|-----------|------|------|
| PluginHooks | `src/hooks/plugin.ts` | OpenCode event handlers |
| ContextPersister | `src/context/persister.ts` | Stores records to DB |
| ContextRetriever | `src/context/retriever.ts` | Retrieves context via embeddings |
| SemanticExtractor | `src/context/extractor.ts` | LLM-powered extraction |
| LLMClient | `src/llm/client.ts` | OpenAI/Anthropic/Ollama providers |

## Data Flow

```
OpenCode Events → Plugin Hooks → ContextPersister → LanceDB
                                      ↓
                              SemanticExtractor
                                      ↓
                               LLM Provider
                                      ↓
                              Extracted Context
```

## Record Types Stored

- `decision` - Architectural/important decisions
- `file_change` - File modifications
- `command` - Terminal commands executed
- `task` - Todo/task updates
- `debt` - Technical debt from errors
- `session_summary` - Full session context
