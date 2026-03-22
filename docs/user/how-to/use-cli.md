# How to Use the CLI

This guide shows you how to use all LLMNGN CLI commands.

## Before You Start

- CLI is installed with the plugin
- All commands run in your terminal
- Data stored in `.lancedb/` folder

## Quick Reference

| Command | Use |
|---------|-----|
| `llmngn init` | Initialize plugin |
| `llmngn add <text>` | Store a decision/note |
| `llmngn list` | List all records |
| `llmngn get <id>` | Get by ID |
| `llmngn query <text>` | Search context |
| `llmngn delete <id>` | Delete record |
| `llmngn clean` | Remove expired |
| `llmngn stats` | Database info |
| `llmngn export -o file` | Backup |
| `llmngn import file` | Restore |
| `llmngn purge --force` | Clear all |

## Command Details

### init

Initialize the plugin:

```bash
llmngn init
```

Stores a usage instruction record for future reference.

### add

Store new context:

```bash
llmngn add "Your text here"
```

Options:
- `-t, --type` - Context type (decision, file_change, task, debt, command, architecture)
- `-m, --metadata` - Extra data as JSON
- `-s, --session` - Session ID

Examples:
```bash
llmngn add "Using Redis for cache" --type decision
llmngn add "Fixed auth bug" --type file_change --metadata '{"file":"src/auth.ts"}'
```

### list

Show all records:

```bash
llmngn list
```

Options:
- `-l, --limit` - Max results (default: 100)
- `-t, --type` - Filter by type
- `-s, --session` - Filter by session

Examples:
```bash
llmngn list --limit 20
llmngn list --type decision
```

### get

Get specific record:

```bash
llmngn get abc123-def456
```

### query

Search context semantically:

```bash
llmngn query "your search"
```

Options:
- `-l, --limit` - Max results
- `-t, --types` - Filter by types (comma-separated)

Examples:
```bash
llmngn query "authentication" --limit 10
llmngn query "database" --types decision,architecture
```

### delete

Remove a record:

```bash
llmngn delete abc123-def456 --force
```

### clean

Remove expired records:

```bash
llmngn clean
```

Safe command - only removes past retention date.

### stats

Show database info:

```bash
llmngn stats
```

Shows:
- Total records
- Database size
- Record types breakdown
- Oldest/newest records

### export

Backup all data:

```bash
llmngn export --output backup.json
```

### import

Restore from backup:

```bash
llmngn import backup.json
```

### purge

Delete everything:

```bash
llmngn purge --force
```

⚠️ **Warning**: Permanent! Export first.

## Interactive Command in OpenCode

Use `/llmngn` in OpenCode for natural language:

```
/llmngn store this decision
/llmngn show me recent changes
/llmngn find anything about auth
/llmngn export my data
/llmngn what's in my database?
```

## Common Workflows

### Daily usage
```bash
llmngn add "Completed feature X" --type task
llmngn list --limit 5
```

### Weekly cleanup
```bash
llmngn clean
llmngn stats
```

### Before major changes
```bash
llmngn export --output pre-refactor.json
# make changes
llmngn import pre-refactor.json  # if needed
```

### Search workflow
```bash
llmngn query "auth" --type decision
llmngn get <id>  # for details
```

## Troubleshooting

**Problem**: Command not found
- Run `llmngn --version`
- Reinstall: `cd .opencode && bun install`

**Problem**: No data showing
- Run `llmngn stats` to verify database
- Check `.lancedb/` folder exists

**Problem**: Permission errors
- Run as administrator (Windows)
- Check folder permissions

## Related Guides

- [How to Store Decisions](store-decisions.md)
- [How to Search Context](search-context.md)
- [Configuration Options](../tech/configuration.md)
