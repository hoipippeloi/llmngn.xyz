# How to Search Your Context

This guide shows you how to find stored decisions, notes, and context using LLMNGN.

## Before You Start

- You need stored context (see [Store Decisions](store-decisions.md))
- Search uses semantic matching (finds related concepts, not just keywords)

## Step-by-Step Instructions

### 1. Open Your Terminal

Open your terminal or command prompt in your project folder.

### 2. Search for Context

Use the `llmngn query` command:

```bash
llmngn query "database"
```

This finds all context related to databases, even if the word "database" isn't exact.

### 3. Limit Results

Show only top 10 results:

```bash
llmngn query "authentication" --limit 10
```

### 4. Filter by Type

Search only decisions:

```bash
llmngn query "caching" --type decision
```

Search multiple types:

```bash
llmngn query "auth" --types decision,file_change
```

### 5. View All Records

List everything:

```bash
llmngn list
```

List with limit:

```bash
llmngn list --limit 20
```

List only specific type:

```bash
llmngn list --type task
```

### 6. Get Specific Record

If you know the ID:

```bash
llmngn get abc123-def456
```

## Using the Interactive Command

In OpenCode, use natural language:

```
/llmngn find anything about authentication
/llmngn show me my latest records
/llmngn what's in my database?
```

## Search Tips

**Be specific**: "Redis caching" finds better results than just "cache"

**Use quotes**: Search exact phrases when needed

**Try synonyms**: If "auth" doesn't work, try "authentication" or "login"

**Filter by type**: Narrow results with `--type decision`

## Example Workflow

```bash
# Search for database decisions
llmngn query "database" --type decision

# Find recent file changes
llmngn list --type file_change --limit 10

# Search authentication across all types
llmngn query "auth" --types decision,file_change,architecture
```

## Troubleshooting

**Problem**: No results found
- Try different keywords
- Check if context exists: `llmngn list`
- Semantic search may not match exact words

**Problem**: Too many results
- Add `--limit 5` to show fewer
- Filter by type: `--type decision`
- Be more specific in search

**Problem**: Results not relevant
- Try synonyms
- Use more specific query
- Check context type weights (decisions ranked higher)

## Related Guides

- [How to Store Decisions](store-decisions.md)
- [How to Export Data](export-data.md)
- [How to Delete Records](delete-records.md)
