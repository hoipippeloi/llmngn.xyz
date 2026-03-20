# LLMNGN CLI Reference

CLI for managing the LLMNGN context database.

## Installation

```bash
# Clone repo and link CLI globally
git clone https://github.com/hoipippeloi/llmngn.xyz.git
cd llmngn.xyz && npm install && npm link
```

## Commands

| Command | Description |
|---------|-------------|
| `llmngn init` | Initialize plugin in current project |
| `llmngn query <text>` | Search stored context |
| `llmngn history` | View session history |
| `llmngn stats` | Show database statistics |
| `llmngn export -o <file>` | Export context to JSON |
| `llmngn import <file>` | Import context from JSON |
| `llmngn purge --force` | Delete all stored context |
| `llmngn config list` | Show all settings |
| `llmngn config set <key> <value>` | Update setting |
| `llmngn config get <key>` | Get setting value |

## Options

### query
```
llmngn query <text> [--limit n] [--types type1,type2]
```

### export
```
llmngn export [--output file]
```

### import
```
llmngn import <file>
```

### purge
```
llmngn purge --force
```

## Examples

```bash
# Initialize in a new project
llmngn init

# Search for past decisions
llmngn query "authentication" --types decision --limit 10

# View recent sessions
llmngn history --sessions 5

# Check database size
llmngn stats

# Backup before refactor
llmngn export --output backup.json

# Restore from backup
llmngn import backup.json

# Update retention days
llmngn config set retentionDays 120

# Clear everything
llmngn purge --force
```

## Development

```bash
npm run build      # Compile TypeScript
npm run typecheck  # Type check
npm test           # Run tests
```
