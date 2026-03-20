# LLMNGN CLI Reference

CLI for managing the LLMNGN context database.

## Installation

```bash
git clone https://github.com/hoipippeloi/llmngn.xyz.git
cd llmngn.xyz && npm install && npm link
```

## Commands

| Command | Description |
|---------|-------------|
| `llmngn init` | Initialize plugin in current project |
| `llmngn add <content>` | Add context record manually |
| `llmngn query <text>` | Search stored context |
| `llmngn history` | View session history |
| `llmngn stats` | Show database statistics |
| `llmngn export -o <file>` | Export context to JSON |
| `llmngn import <file>` | Import context from JSON |
| `llmngn purge --force` | Delete all stored context |
| `llmngn config list` | Show all settings |
| `llmngn config set <key> <value>` | Update setting |

## add

```bash
llmngn add <content> [--type type] [--session id] [--metadata json]
```

**Options:**
- `-t, --type` - Context type: `decision`, `file_change`, `command`, `task`, `debt`, `architecture` (default: decision)
- `-s, --session` - Session ID (auto-generated if not provided)
- `-m, --metadata` - Additional metadata as JSON string

## query

```bash
llmngn query <text> [--limit n] [--types type1,type2]
```

## export/import

```bash
llmngn export [-o file]
llmngn import <file>
```

## Examples

```bash
# Add a decision
llmngn add "Use Redis for session caching" --type decision

# Add with metadata
llmngn add "Refactored auth module" --type file_change --metadata '{"file":"src/auth.ts"}'

# Search context
llmngn query "authentication" --types decision --limit 10

# View history
llmngn history --sessions 5

# Backup
llmngn export -o backup.json

# Clear all
llmngn purge --force
```

## Development

```bash
npm run build      # Compile
npm run typecheck  # Type check
npm test           # Run tests
```
