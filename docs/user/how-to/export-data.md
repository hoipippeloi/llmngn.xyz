# How to Export Your Data

This guide shows you how to export and backup your LLMNGN context data.

## Before You Start

- Export creates a JSON backup of all your context
- Useful before major changes or for version control
- Export file can be re-imported later

## Step-by-Step Instructions

### 1. Open Your Terminal

Open your terminal or command prompt in your project folder.

### 2. Export to File

```bash
llmngn export --output backup.json
```

This creates `backup.json` with all your stored context.

### 3. Verify Export

Check the file was created:

```bash
ls backup.json
# or on Windows
dir backup.json
```

### 4. View Export Contents

Open the file to see your data:

```bash
cat backup.json
# or on Windows
type backup.json
```

The export includes:
- All context records
- Metadata (type, session, timestamps)
- Vector embeddings
- Expiration dates

### 5. Import Data Later

Restore from backup:

```bash
llmngn import backup.json
```

## Using the Interactive Command

In OpenCode:

```
/llmngn export my data
```

## Use Cases

**Before a refactor**: Backup before major code changes

**Version control**: Commit exports to git for history

**Team sharing**: Share context with team members

**Migration**: Move context between projects

## Troubleshooting

**Problem**: Export file is empty
- Check if you have data: `llmngn list`
- Verify command ran successfully

**Problem**: Import fails
- Ensure JSON file is valid
- Check file path is correct
- Use `--force` flag if needed

**Problem**: File too large
- Export filtered data (future feature)
- Consider cleaning old records first: `llmngn clean`

## Related Guides

- [How to Store Decisions](store-decisions.md)
- [How to Delete Records](delete-records.md)
- [Configuration Options](../tech/configuration.md)
