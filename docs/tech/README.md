# LLMNGN Documentation

Context persistence plugin for OpenCode that maintains semantic continuity across coding sessions using LanceDB.

## What is LLMNGN?

LLMNGN (pronounced "llm engine") solves a fundamental problem in AI-assisted development: context loss between sessions. When you start a new coding session, the AI has no memory of previous decisions, changes, or patterns. LLMNGN bridges this gap by storing and retrieving relevant context automatically.

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   New Session   │────▶│  Plugin Hook    │────▶│  LanceDB        │
│   Starts        │     │  Fires          │     │  Query          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                        ┌─────────────────┐             ▼
                        │  System Prompt  │◀──────── Context Records
                        │  + Context      │     (decisions, changes)
                        └─────────────────┘
```

1. **Capture**: Plugin hooks automatically capture events (file edits, commands, decisions)
2. **Embed**: Content is converted to vector embeddings for semantic search
3. **Store**: Records are persisted in local LanceDB with metadata and expiration
4. **Retrieve**: When a new session starts, relevant context is queried and injected

## Documentation Sections

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System design and data flow |
| [API Reference](./api-reference.md) | Programmatic API documentation |
| [CLI Reference](./cli-reference.md) | Command-line interface guide |
| [Configuration](./configuration.md) | Configuration options and defaults |
| [Development](./development.md) | Contributing and development setup |

## Quick Start

### Installation

```bash
npx degit hoipippeloi/llmngn.xyz/opencode .opencode && cd .opencode && bun install && cd ..
```

### Verify Installation

```bash
llmngn init
llmngn stats
```

### Basic Usage

```bash
# Store a decision
llmngn add "Decided to use PostgreSQL for primary database" --type decision

# Search context
llmngn query "database"

# View all records
llmngn list
```

## Key Features

| Feature | Description |
|---------|-------------|
| Semantic Retrieval | Vector embeddings find contextually relevant information |
| Multiple Context Types | Tracks decisions, changes, tasks, debt, architecture, commands |
| Local-First | All data stored locally in LanceDB, no cloud dependency |
| Auto-Redaction | Filters API keys, passwords, and tokens automatically |
| Weighted Scoring | Prioritizes important context types (decisions > commands) |
| Zero Config | Works out of the box with sensible defaults |

## Context Types

| Type | Weight | Retention | Purpose |
|------|--------|-----------|---------|
| `decision` | 1.0 | 180 days | Architectural and design decisions |
| `architecture` | 1.0 | 365 days | System structure documentation |
| `debt` | 0.9 | 90 days | Technical debt tracking |
| `file_change` | 0.8 | 90 days | File modification history |
| `task` | 0.7 | 60 days | Task and todo tracking |
| `command` | 0.5 | 30 days | CLI command history |

## Requirements

- Node.js 18+
- OpenCode CLI
- Bun or npm

## License

MIT
