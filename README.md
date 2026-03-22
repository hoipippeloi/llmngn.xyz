# $ llmngn_

Context persistence plugin for OpenCode that maintains semantic continuity across coding sessions using LanceDB.

## Install

```bash
npx degit hoipippeloi/llmngn.xyz/opencode .opencode && cd .opencode && bun install && cd ..
```

```powershell
npx degit hoipippeloi/llmngn.xyz/opencode .opencode; cd .opencode; bun install; cd ..
```

This installs:
- Plugin hooks (`.opencode/plugins/llmngn.ts`)
- Configuration (`.opencode/plugins/llmngn.json`)
- Interactive command (`.opencode/commands/llmngn.md`)

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

## Features

- **Semantic Retrieval** - Vector embeddings find relevant context
- **Multiple Types** - Tracks changes, decisions, tasks, commands, debt
- **Local-First** - All data in local LanceDB, no cloud
- **Auto-Redaction** - Filters API keys, passwords, tokens
- **Weighted Scoring** - Prioritizes decisions over commands
- **Zero Config** - Works out of the box
- **Interactive Command** - `/llmngn` for natural language queries

## Interactive Command

Use `/llmngn` in OpenCode for natural language interaction:

```
/llmngn store that we decided to use Redis for caching
/llmngn show me my latest records
/llmngn find anything about authentication
/llmngn export my data
/llmngn what patterns do I have?
```

The command understands the plugin E2E and infers the right action from your intent.

## Context Types

| Type | Weight | Retention |
|------|--------|-----------|
| decision | 1.0 | 180 days |
| architecture | 1.0 | 365 days |
| debt | 0.9 | 90 days |
| file_change | 0.8 | 90 days |
| task | 0.7 | 60 days |
| command | 0.5 | 30 days |

## CLI

```bash
# Install CLI globally
git clone https://github.com/hoipippeloi/llmngn.xyz.git
cd llmngn.xyz && npm install && npm link

# Usage
llmngn init                        # Initialize
llmngn add "Decision text"         # Add record
llmngn list                        # List all
llmngn get <id>                    # Get by ID
llmngn query "auth"                # Search
llmngn delete <id> --force         # Delete
llmngn clean                       # Remove expired
llmngn stats                       # Database info
llmngn export -o backup.json       # Backup
llmngn purge --force               # Clear all
```

See [CLI.md](./CLI.md) for full reference.

## Files

```
.opencode/
├── package.json
└── plugins/
    ├── llmngn.ts      # Plugin
    └── llmngn.json    # Config
```

## Config

Edit `.opencode/plugins/llmngn.json`:

```json
{
  "enabled": true,
  "lancedbPath": ".lancedb",
  "maxContextTokens": 4096,
  "retentionDays": 90,
  "filters": {
    "excludePatterns": ["**/node_modules/**", "**/.env*"],
    "sensitiveDataRedaction": true
  }
}
```

## Troubleshooting

```bash
# Plugin not loading
ls .opencode/node_modules/@lancedb
cd .opencode && bun install

# Reset everything
rm -rf .lancedb
```

## Requirements

- Node.js 18+
- OpenCode CLI
- Bun or npm

## License

MIT
