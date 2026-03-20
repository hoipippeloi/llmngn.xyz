# Context Persistence Plugin - Installation Guide

## Overview

The Context Persistence Plugin maintains semantic continuity across OpenCode sessions by persisting and retrieving codebase context through LanceDB vector storage. It auto-loads as an OpenCode plugin.

## Prerequisites

- Node.js 18+
- OpenCode CLI installed
- Bun (OpenCode uses this for plugin dependencies)

## Quick Install

The plugin files are already in this repository:

```
.opencode/
├── package.json              # Dependencies: @lancedb/lancedb, uuid
└── plugins/
    ├── context-persistence.ts    # Main plugin (self-contained)
    └── context-persistence.json   # Configuration
```

### 1. Install Dependencies

```bash
# In the project directory, install plugin dependencies
cd .opencode && bun install && cd ..
```

Or with npm:
```bash
cd .opencode && npm install && cd ..
```

### 2. Configure the Plugin

Edit `.opencode/plugins/context-persistence.json`:

```json
{
  "enabled": true,
  "embeddingModel": "nomic-embed-text",
  "embeddingProvider": "local",
  "lancedbPath": ".lancedb",
  "maxContextTokens": 4096,
  "salienceDecay": 0.95,
  "retentionDays": 90,
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
    "decision": 1,
    "debt": 0.9,
    "task": 0.7,
    "architecture": 1,
    "command": 0.5
  },
  "filters": {
    "excludePatterns": [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.min.js",
      "**/.env*",
      "**/package-lock.json"
    ],
    "sensitiveDataRedaction": true
  }
}
```

### 3. Verify Installation

Start OpenCode in the project directory. The plugin auto-loads. Check logs for:

```
[context-persistence-plugin] Plugin initialized
```

## How It Works

### Auto-Loading

OpenCode automatically loads plugins from:
- `.opencode/plugins/*.ts` - Project-level
- `~/.config/opencode/plugins/*.ts` - Global

The plugin hooks into:

| Hook | Purpose |
|------|---------|
| `experimental.chat.system.transform` | Injects prior session context into system prompt |
| `session.created` | Initializes session tracking |
| `file.edited` | Records file changes |
| `command.executed` | Records command invocations |
| `session.idle` | Persists session data to LanceDB |

### Context Injection Flow

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

### Storage Structure

Context is stored in `.lancedb/codebase_context.lance/`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique record ID |
| `vector` | number[768] | Embedding vector |
| `projectId` | string | Hashed project path |
| `contextType` | string | One of: decision, file_change, command, etc. |
| `content` | string | The actual context text |
| `metadata` | object | Additional structured data |
| `sessionId` | string | Session identifier |
| `createdAt` | string | ISO timestamp |
| `expiresAt` | string | ISO timestamp (retention) |
| `salience` | number | Weight 0-1 |

## Context Types and Priority

| Type | Weight | Retention | Description |
|------|--------|-----------|-------------|
| `decision` | 1.0 | 180 days | Architectural decisions, library choices |
| `architecture` | 1.0 | 365 days | Component relationships |
| `debt` | 0.9 | 90 days | Technical debt items |
| `file_change` | 0.8 | 90 days | File modifications |
| `task` | 0.7 | 60 days | Task progress |
| `command` | 0.5 | 30 days | Build commands |

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable plugin |
| `embeddingModel` | string | `"nomic-embed-text"` | Model name (placeholder) |
| `embeddingProvider` | string | `"local"` | Uses hash-based embedding fallback |
| `lancedbPath` | string | `".lancedb"` | Database storage path |
| `maxContextTokens` | number | `4096` | Max tokens per context injection |
| `salienceDecay` | number | `0.95` | Weight for recent vs old context |
| `retentionDays` | number | `90` | Default retention period |

## Self-Contained Implementation

The plugin in `.opencode/plugins/context-persistence.ts` is self-contained:

- **No external imports** from parent `dist/` folder
- **Inline embedding** using hash-based vector generation
- **Direct LanceDB calls** via dynamic import
- **Graceful degradation** - returns empty hooks if LanceDB unavailable

## Troubleshooting

### Plugin not loading

```bash
# Check dependencies are installed
ls .opencode/node_modules/@lancedb

# Reinstall
cd .opencode && bun install
```

### No context being persisted

1. Verify `enabled: true` in config
2. Check `.lancedb/` directory exists
3. Run a session and check `.lancedb/codebase_context.lance/`

### LanceDB errors

LanceDB requires native bindings. If you see errors:

```bash
# Rebuild native modules
cd .opencode && npm rebuild @lancedb/lancedb
```

### Reset all context

```bash
rm -rf .lancedb
```

The database will be recreated on next session.

## Security

- **Local-first**: All data stored locally in LanceDB
- **Sensitive data redaction**: Automatically filters API keys, passwords, tokens
- **Project isolation**: Hashed project ID separates contexts
- **No cloud sync**: Data never leaves your machine

## Manual Verification

To manually check stored context:

```javascript
// In a test script
const lancedb = await import("@lancedb/lancedb")
const db = await lancedb.connect(".lancedb")
const table = await db.openTable("codebase_context")
const rows = await table.query().limit(10).toArray()
console.log(rows)
```

## Support

- GitHub Issues: https://github.com/hoipippeloi/llmngn.xyz/issues