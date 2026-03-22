# $ llmngn_

Context persistence plugin for OpenCode - stores and retrieves context across sessions.

## Quick Commands

| Command | Use |
|---------|-----|
| `llmngn add <text>` | Store a decision/note |
| `llmngn list` | List all records |
| `llmngn query <text>` | Search context |
| `llmngn stats` | Database info |
| `llmngn clean` | Remove expired |
| `llmngn purge --force` | Clear all |
| `llmngn uninstall --keep-db` | Remove plugin only |
| `llmngn uninstall --full` | Remove everything |

## Examples

```bash
# Store a decision
llmngn add "Use Redis for caching" -t decision

# Store with metadata
llmngn add "Fixed auth bug" -t file_change -m '{"file":"src/auth.ts"}'

# List decisions only
llmngn list -t decision -l 20

# Search for something
llmngn query "authentication" -l 10

# Get specific record
llmngn get <id>

# Delete a record
llmngn delete <id> --force

# Backup before changes
llmngn export -o backup.json

# Restore from backup
llmngn import backup.json

# View session history
llmngn history

# Remove only plugin files (keep database)
llmngn uninstall --keep-db

# Remove everything including database
llmngn uninstall --full
```

## Files

- `.opencode/plugins/llmngn.ts` - Plugin code
- `.opencode/plugins/llmngn.json` - Config
- `.lancedb/` - Database

## Config

Edit `.opencode/plugins/llmngn.json` to customize retention, weights, filters.

## Context Types

| Type | Weight | Retention |
|------|--------|-----------|
| decision | 1.0 | 180 days |
| architecture | 1.0 | 365 days |
| debt | 0.9 | 90 days |
| file_change | 0.8 | 90 days |
| task | 0.7 | 60 days |
| command | 0.5 | 30 days |

## Interactive Command

Use `/llmngn` in OpenCode for natural language interaction:

```
/llmngn store that we decided to use Redis for caching
/llmngn show me my latest records
/llmngn find anything about authentication
/llmngn export my data
```

## Troubleshooting

```bash
# Plugin not loading
cd .opencode && npm install

# Reset everything
rm -rf .lancedb && llmngn init
```
