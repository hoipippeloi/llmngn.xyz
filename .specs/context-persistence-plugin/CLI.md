# Context Persistence CLI

Command-line interface for managing the context persistence database.

## Installation

The CLI is available as part of the context-persistence plugin. No separate installation required.

## Commands

### Query Context

Search stored context records.

```bash
context-persist query <text> [options]
```

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--limit, -n` | 10 | Maximum results to return |
| `--type, -t` | all | Filter by context type: `file_change`, `decision`, `debt`, `task`, `architecture`, `command` |
| `--session, -s` | all | Filter by session ID |
| `--json` | false | Output as JSON |
| `--verbose, -v` | false | Show metadata and timestamps |

**Examples:**
```bash
# Search for authentication-related context
context-persist query "authentication login"

# Get last 20 commands
context-persist query "" --type command --limit 20

# Find decisions about API design
context-persist query "API design" --type decision --verbose

# Export results as JSON
context-persist query "refactor" --json > refactor-context.json
```

---

### Show History

Display session history with context counts.

```bash
context-persist history [options]
```

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--sessions, -n` | 10 | Number of sessions to show |
| `--type, -t` | all | Filter by context type |
| `--after` | - | Show sessions after date (ISO format) |
| `--before` | - | Show sessions before date (ISO format) |

**Examples:**
```bash
# Show last 5 sessions
context-persist history --sessions 5

# Show sessions from last week
context-persist history --after 2026-03-13

# Show only sessions with file changes
context-persist history --type file_change
```

---

### Export Context

Export database contents for backup or analysis.

```bash
context-persist export [options]
```

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--output, -o` | stdout | Output file path |
| `--format, -f` | json | Export format: `json`, `csv`, `markdown` |
| `--type, -t` | all | Filter by context type |
| `--session, -s` | all | Export specific session |
| `--since` | - | Export records since date |

**Examples:**
```bash
# Full backup to file
context-persist export --output backup.json

# Export only decisions as markdown
context-persist export --type decision --format markdown --output decisions.md

# Export last week of context
context-persist export --since 2026-03-13 --output recent.json

# Pipe to another tool
context-persist export --format csv | gzip > context.csv.gz
```

---

### Import Context

Restore context from a backup file.

```bash
context-persist import <path> [options]
```

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--merge` | false | Merge with existing (don't replace) |
| `--dry-run` | false | Preview without importing |

**Examples:**
```bash
# Restore from backup
context-persist import backup.json

# Merge with existing data
context-persist import backup.json --merge

# Preview import
context-persist import backup.json --dry-run
```

---

### Purge Context

Clear stored context from the database.

```bash
context-persist purge [options]
```

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--force, -f` | false | Skip confirmation prompt |
| `--type, -t` | all | Purge specific context type only |
| `--session, -s` | all | Purge specific session only |
| `--before` | - | Purge records before date |
| `--expired` | false | Purge only expired records |

**Examples:**
```bash
# Interactive purge (prompts for confirmation)
context-persist purge

# Force purge all
context-persist purge --force

# Purge only commands
context-persist purge --type command --force

# Purge expired records
context-persist purge --expired

# Purge old sessions
context-persist purge --before 2026-01-01
```

---

### Show Statistics

Display database statistics and health info.

```bash
context-persist stats [options]
```

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--verbose, -v` | false | Show detailed breakdown |
| `--json` | false | Output as JSON |

**Output includes:**
- Total record count
- Records by type
- Database size on disk
- Oldest/newest records
- Session count
- Average records per session

**Examples:**
```bash
# Basic stats
context-persist stats

# Detailed breakdown
context-persist stats --verbose

# Machine-readable output
context-persist stats --json
```

---

### Configuration

Manage plugin configuration.

```bash
context-persist config <command> [options]
```

**Subcommands:**

#### List all settings
```bash
context-persist config list
```

#### Get a specific setting
```bash
context-persist config get <key>
```

#### Set a setting
```bash
context-persist config set <key> <value>
```

**Examples:**
```bash
# List current config
context-persist config list

# Check if enabled
context-persist config get enabled

# Enable debug mode
context-persist config set debug true

# Change retention period
context-persist config set retentionDays 180

# Update exclude patterns
context-persist config set filters.excludePatterns '["**/node_modules/**", "**/.env*"]'
```

---

### Initialize

Initialize or reinitialize the plugin database.

```bash
context-persist init [options]
```

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--force, -f` | false | Overwrite existing database |
| `--migrate` | false | Migrate from older schema |

**Examples:**
```bash
# Initialize new database
context-persist init

# Reinitialize (WARNING: destroys existing data)
context-persist init --force

# Migrate from v1.0 schema
context-persist init --migrate
```

---

## Global Options

Available for all commands:

| Flag | Description |
|------|-------------|
| `--project, -p` | Project directory (default: current) |
| `--config, -c` | Custom config file path |
| `--quiet, -q` | Suppress non-essential output |
| `--help, -h` | Show help |
| `--version` | Show version |

**Examples:**
```bash
# Operate on different project
context-persist stats --project /path/to/other-project

# Use custom config
context-persist query "test" --config ./custom-config.json

# Quiet mode for scripts
context-persist purge --expired --quiet
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Database error |
| 4 | Configuration error |
| 5 | Permission denied |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENCODE_CONTEXT_DB` | Override database path |
| `OPENCODE_CONTEXT_CONFIG` | Override config path |
| `OPENCODE_CONTEXT_DEBUG` | Enable debug logging (1/0) |

---

## Shell Completion

Generate shell completion scripts:

```bash
# Bash
context-persist completion bash > ~/.local/share/bash-completion/completions/context-persist

# Zsh
context-persist completion zsh > ~/.zsh/completion/_context-persist

# Fish
context-persist completion fish > ~/.config/fish/completions/context-persist.fish
```

---

## Programmatic Usage

The CLI can be used in scripts:

```bash
#!/bin/bash
# Backup context before major refactor

DATE=$(date +%Y%m%d)
context-persist export --output "context-backup-${DATE}.json"

if [ $? -eq 0 ]; then
  echo "Backup saved to context-backup-${DATE}.json"
else
  echo "Backup failed!"
  exit 1
fi
```

```bash
#!/bin/bash
# Weekly cleanup cron job

# Purge expired records
context-persist purge --expired --quiet

# Keep only last 100 sessions
context-persist purge --before $(date -d "100 sessions ago" -I) --quiet
```
