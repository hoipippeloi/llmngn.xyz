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
| `llmngn list` | List all records |
| `llmngn get <id>` | Get record by ID |
| `llmngn query <text>` | Search stored context |
| `llmngn delete <id>` | Delete record by ID |
| `llmngn clean` | Delete expired records |
| `llmngn history` | View session history |
| `llmngn stats` | Show database statistics |
| `llmngn export -o <file>` | Export context to JSON |
| `llmngn import <file>` | Import context from JSON |
| `llmngn purge --force` | Delete all stored context |
| `llmngn config list` | Show all settings |
| `llmngn config set <key> <value>` | Update setting |

## Command Details

### init
```bash
llmngn init [--embedding-model <model>]
```
Initializes plugin and stores a usage instructions record in the database. Future sessions can query this record to understand how to use the plugin.
- `--embedding-model` - Set custom embedding model

### add
```bash
llmngn add <content> [-t type] [-s session] [-m metadata]
```
- `-t, --type` - Context type: decision, file_change, command, task, debt, architecture
- `-s, --session` - Session ID
- `-m, --metadata` - Metadata as JSON string

### list
```bash
llmngn list [-l limit] [-t type] [-s session]
```
- `-l, --limit` - Max results (default: 100)
- `-t, --type` - Filter by context type
- `-s, --session` - Filter by session ID

### query
```bash
llmngn query <text> [-l limit] [-t types]
```
- `-l, --limit` - Max results
- `-t, --types` - Comma-separated context types

### delete
```bash
llmngn delete <id> [-f]
```
- `-f, --force` - Confirm deletion

### export/import
```bash
llmngn export [-o file]
llmngn import <file>
```

### purge
```bash
llmngn purge --force
```

## Examples

```bash
# Add a decision
llmngn add "Use Redis for caching" --type decision

# Add with metadata
llmngn add "Refactored auth" -t file_change -m '{"file":"src/auth.ts"}'

# List all records
llmngn list

# List only decisions
llmngn list --type decision --limit 20

# Get specific record
llmngn get abc123-def456

# Search context
llmngn query "authentication" --types decision --limit 10

# Delete a record
llmngn delete abc123-def456 --force

# Remove expired records
llmngn clean

# View session history
llmngn history --sessions 5

# Check database stats
llmngn stats

# Backup before refactor
llmngn export -o backup.json

# Restore from backup
llmngn import backup.json

# Clear everything
llmngn purge --force

# Update config
llmngn config set retentionDays 120
```

## Development

```bash
npm run build      # Compile
npm run typecheck  # Type check
npm test           # Run tests
```
