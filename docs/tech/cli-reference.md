# CLI Reference

Command-line interface for managing the LLMNGN context database.

## Installation

```bash
# Clone and install globally
git clone https://github.com/hoipippeloi/llmngn.xyz.git
cd llmngn.xyz && npm install && npm link

# Or use with npx after building
npx llmngn <command>
```

## Interactive Command

Use `/llmngn` in OpenCode for natural language interaction:

```
/llmngn <your intent>
```

| Example Prompt | Action |
|----------------|--------|
| "store that we decided to use Redis" | `llmngn add` decision |
| "show me my latest records" | `llmngn list` |
| "find anything about auth" | `llmngn query` |
| "export my data" | `llmngn export` |
| "what's in my database?" | `llmngn stats` |
| "show session history" | `llmngn history` |
| "delete record abc123" | `llmngn delete` |
| "clean up expired" | `llmngn clean` |

## Commands Overview

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
| `llmngn export` | Export context to JSON |
| `llmngn import <file>` | Import context from JSON |
| `llmngn purge` | Delete all stored context |
| `llmngn config` | Manage configuration |

---

## init

Initializes the plugin and stores an init record.

```bash
llmngn init [options]
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--embedding-model <model>` | text-embedding-3-small | Embedding model to use |

**Example:**

```bash
llmngn init
llmngn init --embedding-model text-embedding-3-large
```

---

## add

Adds a new context record manually.

```bash
llmngn add <content> [options]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `content` | Yes | Text content to store |

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `-t, --type <type>` | decision | Context type |
| `-s, --session <id>` | auto | Session ID |
| `-m, --metadata <json>` | {} | Metadata as JSON string |

**Context Types:**

- `decision` - Design decisions
- `file_change` - File modifications
- `task` - Task tracking
- `debt` - Technical debt
- `architecture` - System structure
- `command` - CLI commands

**Examples:**

```bash
# Simple decision
llmngn add "Decided to use Redis for caching"

# With explicit type
llmngn add "Auth module refactored" --type file_change

# With metadata
llmngn add "Performance issue in user query" \
  --type debt \
  --metadata '{"severity":"high","debtType":"performance"}'

# Complex metadata
llmngn add "Switched to TypeScript" \
  -t decision \
  -m '{"rationale":"Better type safety","alternatives":["JavaScript","Flow"]}'
```

---

## list

Lists all context records.

```bash
llmngn list [options]
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `-l, --limit <n>` | 100 | Maximum results |
| `-t, --type <type>` | all | Filter by context type |
| `-s, --session <id>` | all | Filter by session ID |
| `--json` | false | Output as JSON |

**Examples:**

```bash
# List all
llmngn list

# List only decisions
llmngn list --type decision

# List recent file changes
llmngn list -t file_change -l 20

# List from specific session
llmngn list --session abc123

# JSON output for scripting
llmngn list --json | jq '.[].content'
```

---

## get

Retrieves a specific record by ID.

```bash
llmngn get <id> [options]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Record UUID |

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--json` | false | Output as JSON |

**Example:**

```bash
llmngn get 550e8400-e29b-41d4-a716-446655440000
```

---

## query

Semantic search across stored context.

```bash
llmngn query <text> [options]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `text` | Yes | Search query |

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `-l, --limit <n>` | 10 | Maximum results |
| `-t, --types <types>` | all | Comma-separated context types |
| `--json` | false | Output as JSON |

**Examples:**

```bash
# Basic search
llmngn query "authentication"

# Search with type filter
llmngn query "database" --types decision,architecture

# Limit results
llmngn query "error handling" -l 5

# JSON output
llmngn query "API design" --json
```

---

## delete

Deletes a record by ID.

```bash
llmngn delete <id> [options]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Record UUID |

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `-f, --force` | false | Skip confirmation |

**Examples:**

```bash
# With confirmation
llmngn delete 550e8400-e29b-41d4-a716-446655440000

# Skip confirmation
llmngn delete 550e8400-e29b-41d4-a716-446655440000 --force
```

---

## clean

Removes all expired records.

```bash
llmngn clean [options]
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--dry-run` | false | Show what would be deleted |

**Examples:**

```bash
# Preview expired records
llmngn clean --dry-run

# Delete expired
llmngn clean
```

---

## history

View session history.

```bash
llmngn history [options]
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `-s, --sessions <n>` | 10 | Number of sessions to show |
| `--json` | false | Output as JSON |

**Example:**

```bash
llmngn history
llmngn history --sessions 20
```

---

## stats

Shows database statistics.

```bash
llmngn stats [options]
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--json` | false | Output as JSON |

**Output:**

```
Database Statistics
───────────────────
Total Records: 150
Database Size: 512 KB

By Type:
  decision:     45
  file_change:  80
  task:         15
  debt:         5
  command:      5

Date Range:
  Oldest: 2024-01-15
  Newest: 2024-03-20
```

---

## export

Exports all context to a JSON file.

```bash
llmngn export [options]
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <file>` | llmngn-export.json | Output file path |

**Examples:**

```bash
# Default filename
llmngn export

# Custom filename
llmngn export -o backup-2024-03-20.json

# With timestamp
llmngn export -o "backup-$(date +%Y%m%d).json"
```

---

## import

Imports context from a JSON file.

```bash
llmngn import <file>
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `file` | Yes | Path to JSON export file |

**Example:**

```bash
llmngn import backup-2024-03-20.json
```

---

## purge

Deletes all stored context.

```bash
llmngn purge [options]
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--force` | false | Required to confirm deletion |

**Example:**

```bash
llmngn purge --force
```

---

## config

Manage configuration settings.

```bash
llmngn config <subcommand>
```

### Subcommands

#### `config list`

Shows all configuration settings.

```bash
llmngn config list
```

#### `config set <key> <value>`

Updates a configuration setting.

```bash
llmngn config set retentionDays 120
llmngn config set maxContextTokens 8192
```

#### `config reset`

Resets configuration to defaults.

```bash
llmngn config reset
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Database error |
| 4 | Not found |
| 5 | Operation cancelled |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LLMNGN_DB_PATH` | Database path (default: `.lancedb`) |
| `LLMNGN_CONFIG_PATH` | Config file path |
| `OPENAI_API_KEY` | API key for cloud embeddings |
