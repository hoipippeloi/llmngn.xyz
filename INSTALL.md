# LLMNGN Installation

Context persistence plugin for OpenCode that maintains semantic continuity across coding sessions using LanceDB.

## Quick Install

Run this in your project directory:

```bash
npx degit hoipippeloi/llmngn.xyz/.opencode .opencode && cd .opencode && bun install && cd ..
```

## Verify

Start OpenCode in your project. The plugin auto-loads - no additional setup required.

## Interactive Command

The `/llmngn` command is installed automatically in `.opencode/commands/llmngn.md`.

Use it in OpenCode for natural language interaction:

```
/llmngn store this decision
/llmngn show me recent changes
/llmngn find anything about auth
/llmngn export my data
```

## CLI Installation

For the `llmngn` CLI commands:

```bash
git clone https://github.com/hoipippeloi/llmngn.xyz.git
cd llmngn.xyz && npm install && npm link
llmngn --help
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `llmngn init` | Initialize plugin |
| `llmngn add <content>` | Add record |
| `llmngn list` | List all records |
| `llmngn get <id>` | Get by ID |
| `llmngn query <text>` | Search |
| `llmngn delete <id>` | Delete record |
| `llmngn clean` | Remove expired |
| `llmngn stats` | Database info |
| `llmngn export -o <file>` | Backup |
| `llmngn import <file>` | Restore |
| `llmngn purge --force` | Clear all |

See [CLI.md](./CLI.md) for details.

## Configuration

Edit `.opencode/plugins/llmngn.json`:

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Enable/disable plugin |
| `lancedbPath` | `".lancedb"` | Database location |
| `maxContextTokens` | `4096` | Max tokens per injection |
| `retentionDays` | `90` | Days to keep context |
| `filters.excludePatterns` | `["**/node_modules/**", ...]` | Files to skip |
| `filters.sensitiveDataRedaction` | `true` | Redact secrets |

## How It Works

1. Plugin hooks into OpenCode session lifecycle
2. Captures file changes, commands, decisions during sessions
3. Stores in local LanceDB with vector embeddings
4. Injects relevant context into new sessions

## Reset

```bash
rm -rf .lancedb
```

## Requirements

- Node.js 18+
- OpenCode CLI
- Bun or npm

## Support

https://github.com/hoipippeloi/llmngn.xyz/issues
