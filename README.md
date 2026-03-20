# Context Persistence Plugin

A plugin for OpenCode that maintains semantic continuity across coding sessions by persisting and retrieving codebase context through a vector database.

## Features

- **Semantic Context Retrieval**: Uses vector embeddings to find relevant context from previous sessions
- **Multiple Context Types**: Tracks file changes, decisions, tasks, commands, technical debt, and architecture
- **Local-First Storage**: All data stored locally with LanceDB - no cloud sync required
- **Sensitive Data Redaction**: Automatically filters API keys, passwords, and tokens
- **Weighted Scoring**: Prioritizes important context (decisions > commands) with configurable weights
- **Session Lifecycle Hooks**: Integrates with OpenCode's plugin architecture

## Installation

```bash
# Clone and build
git clone https://github.com/hoipippeloi/llmngn.xyz.git
cd llmngn.xyz
npm install
npm run build

# Install globally for CLI access
npm link
```

## Quick Start

```bash
# Initialize the plugin
context-persist init

# Verify installation
context-persist stats
```

### Configuration

Create `.opencode/plugins/context-persistence.json`:

```json
{
  "enabled": true,
  "embeddingModel": "nomic-embed-text",
  "embeddingProvider": "local",
  "lancedbPath": ".lancedb",
  "maxContextTokens": 4096,
  "salienceDecay": 0.95,
  "retentionDays": 90,
  "contextTypes": ["file_change", "decision", "debt", "task", "architecture", "command"],
  "weights": {
    "file_change": 0.8,
    "decision": 1.0,
    "debt": 0.9,
    "task": 0.7,
    "architecture": 1.0,
    "command": 0.5
  },
  "filters": {
    "excludePatterns": ["**/node_modules/**", "**/dist/**", "**/.env*"],
    "sensitiveDataRedaction": true
  }
}
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `context-persist init` | Initialize plugin in current project |
| `context-persist query <text>` | Query stored context semantically |
| `context-persist history` | Show session history |
| `context-persist stats` | Show database statistics |
| `context-persist export` | Export context for backup |
| `context-persist import <path>` | Import context from backup |
| `context-persist purge --force` | Clear all stored context |

## Context Types and Priority

| Type | Weight | Retention | Description |
|------|--------|-----------|-------------|
| `decision` | 1.0 | 180 days | Architectural decisions, library choices |
| `architecture` | 1.0 | 365 days | Component relationships, system boundaries |
| `debt` | 0.9 | Until resolved | Technical debt items |
| `file_change` | 0.8 | 90 days | Significant file modifications |
| `task` | 0.7 | 60 days | Task progress, blockers |
| `command` | 0.5 | 30 days | Build commands, deployments |

## Programmatic Usage

```typescript
import { CLI, LanceDBClient, ContextRetriever, ContextPersister, createEmbeddingProvider } from 'context-persistence-plugin';

const cli = new CLI(process.cwd());
await cli.init({ embeddingModel: 'nomic-embed-text' });

const results = await cli.query({ text: 'authentication logic', limit: 10 });
const stats = await cli.stats();
```

## Architecture

```
src/
├── index.ts              # Main exports
├── cli.ts                # CLI entry point
├── types/index.ts        # TypeScript interfaces
├── database/
│   └── client.ts         # LanceDB client
├── embedding/
│   └── embedding.ts      # Cloud/local embedding providers
├── context/
│   ├── persister.ts      # Context persistence logic
│   └── retriever.ts      # Semantic retrieval with scoring
├── hooks/
│   └── plugin.ts         # OpenCode plugin hooks
├── cli/
│   └── index.ts          # CLI commands
└── utils/
    └── config.ts         # Configuration management
```

## OpenCode Hooks Integration

| Hook | Purpose |
|------|---------|
| `session.created` | Inject relevant context from prior sessions |
| `experimental.session.compacting` | Preserve critical context |
| `session.idle` | Persist session summary |
| `file.edited` | Log file modifications |
| `command.executed` | Record command invocations |
| `message.updated` | Capture architectural decisions |
| `todo.updated` | Sync task progress |
| `session.error` | Log error states as technical debt |

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Test coverage
npm run test:coverage

# Type check
npm run typecheck

# Lint
npm run lint
```

## Requirements

- Node.js 18+
- OpenCode CLI (optional, for integration)

## License

MIT