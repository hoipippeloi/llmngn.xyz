# How to Delete Records

This guide shows you how to delete context records from LLMNGN.

## Before You Start

- Deletion is permanent (use export first for backup)
- You can delete individual records or all data
- Expired records auto-delete with `llmngn clean`

## Step-by-Step Instructions

### 1. Find Record to Delete

List all records:

```bash
llmngn list
```

Find the ID of the record you want to delete.

### 2. Delete Specific Record

```bash
llmngn delete abc123-def456 --force
```

Replace `abc123-def456` with the actual record ID.

**Note**: `--force` flag is required to confirm deletion.

### 3. Delete Multiple Records

Run delete command for each record ID.

### 4. Clean Expired Records

Remove all expired (past retention date) records:

```bash
llmngn clean
```

This is safe and only removes expired data.

### 5. Delete Everything (Purge)

⚠️ **Warning**: This deletes ALL data permanently!

```bash
llmngn purge --force
```

### 6. Delete Database Folder

Alternative full reset:

```bash
rm -rf .lancedb
# or on Windows
rmdir /s .lancedb
```

## Using the Interactive Command

In OpenCode:

```
/llmngn delete record abc123
/llmngn clean up expired
```

## Best Practices

**Export first**: Always backup before bulk deletion

```bash
llmngn export --output backup.json
llmngn purge --force
```

**Clean regularly**: Run `llmngn clean` monthly to remove expired

**Review before delete**: Use `llmngn list` to verify what you're deleting

## Troubleshooting

**Problem**: Delete command fails
- Ensure you have correct record ID
- Add `--force` flag to confirm

**Problem**: Can't find record ID
- Run `llmngn list` to see all IDs
- Use `llmngn get <id>` to verify

**Problem**: Accidentally deleted
- Restore from backup: `llmngn import backup.json`

## Related Guides

- [How to Store Decisions](store-decisions.md)
- [How to Export Data](export-data.md)
- [How to Search Context](search-context.md)
