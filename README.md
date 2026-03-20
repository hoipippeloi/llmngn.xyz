# LLMNGN

Context persistence plugin for OpenCode that maintains semantic continuity across coding sessions using LanceDB.

## Features

- **Semantic Context Retrieval**: Uses vector embeddings to find relevant context from previous sessions
- **Multiple Context Types**: Tracks file changes, decisions, tasks, commands, technical debt, and architecture
- **Local-First Storage**: All data stored locally with LanceDB - no cloud sync required
- **Sensitive Data Redaction**: Automatically filters API keys, passwords, and tokens
- **Weighted Scoring**: Prioritizes important context (decisions > commands) with configurable weights
- **Session Lifecycle Hooks**: Integrates with OpenCode's plugin architecture
- **Self-Contained**: No external build required - single TypeScript file loaded by OpenCode

## Installation

### Quick Install

Run this command in your project directory:

```bash
npx degit hoipippeloi/llmngn.xyz/.opencode .opencode && cd .opencode && bun install && cd ..
```

### Manual Installation

#### 1. Install Dependencies

```bash
cd .opencode && bun install && cd ..
```

Or with npm:
```bash
cd .opencode && npm install && cd ..
```

### 2. Configure (Optional)

Edit `.opencode/plugins/llmngn.json`:

```json
{
  "enabled": true,
  "embeddingModel": "nomic-embed-text",
  "embeddingProvider": "local",
  "lancedbPath": ".lancedb",
  "maxContextTokens": 4096,
  "salienceDecay": 0.95,
  "retentionDays": 90,
  "weights": {
    "file_change": 0.8,
    "decision": 1,
    "debt": 0.9,
    "task": 0.7,
    "architecture": 1,
    "command": 0.5
  },
  "filters": {
    "excludePatterns": ["**/node_modules/**", "**/dist/**", "**/.env*"],
    "sensitiveDataRedaction": true
  }
}
```

### 3. Use

Start OpenCode in the project directory. The plugin auto-loads and persists context automatically.

### 4. CLI

Use `llmngn` CLI to manage the database. See [CLI.md](./CLI.md) for commands.

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

## Files

```
.opencode/
├── package.json              # Dependencies
└── plugins/
    ├── llmngn.ts             # Main plugin (self-contained)
    └── llmngn.json           # Configuration
```

## Context Types and Priority

| Type | Weight | Retention | Description |
|------|--------|-----------|-------------|
| `decision` | 1.0 | 180 days | Architectural decisions, library choices |
| `architecture` | 1.0 | 365 days | Component relationships |
| `debt` | 0.9 | 90 days | Technical debt items |
| `file_change` | 0.8 | 90 days | File modifications |
| `task` | 0.7 | 60 days | Task progress |
| `command` | 0.5 | 30 days | Build commands |

## OpenCode Hooks

| Hook | Purpose |
|------|---------|
| `experimental.chat.system.transform` | Inject context into system prompt |
| `session.created` | Initialize session tracking |
| `file.edited` | Record file changes |
| `command.executed` | Record commands |
| `session.idle` | Persist session to LanceDB |

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable plugin |
| `embeddingProvider` | string | `"local"` | Embedding provider: `local` (hash-based) or `cloud` |
| `embeddingModel` | string | `"nomic-embed-text"` | Model name for embeddings |
| `lancedbPath` | string | `".lancedb"` | Database storage path |
| `maxContextTokens` | number | `4096` | Max tokens per injection |
| `salienceDecay` | number | `0.95` | Weight for recent vs old |
| `retentionDays` | number | `90` | Default retention |
| `filters.excludePatterns` | string[] | `["**/node_modules/**", ...]` | Files to exclude |
| `filters.sensitiveDataRedaction` | boolean | `true` | Redact secrets |

## Troubleshooting

### Plugin not loading

```bash
# Verify dependencies
ls .opencode/node_modules/@lancedb

# Reinstall
cd .opencode && bun install
```

### Reset all context

```bash
rm -rf .lancedb
```

## Security

- **Local-first**: All data stored locally
- **Sensitive data redaction**: Filters API keys, passwords, tokens
- **Project isolation**: Hashed project ID separates contexts
- **No cloud sync**: Data never leaves your machine

## Requirements

- Node.js 18+
- OpenCode CLI
- Bun (for plugin dependencies)

## License

MIT
