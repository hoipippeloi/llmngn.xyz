# How to Store Decisions and Notes

This guide shows you how to store important decisions, notes, and context using LLMNGN.

## Before You Start

- Make sure LLMNGN is installed (see [Getting Started](../getting-started.md))
- All data is stored locally in your project
- Context expires automatically based on type (30-365 days)

## Step-by-Step Instructions

### 1. Open Your Terminal

Open your terminal or command prompt in your project folder.

### 2. Store a Decision

Use the `llmngn add` command:

```bash
llmngn add "Decided to use PostgreSQL for the database"
```

That's it! Your decision is now stored and will be available in future sessions.

### 3. Add Context Type (Optional)

Specify what kind of context you're storing:

```bash
# Architectural decision
llmngn add "Using microservices architecture" --type decision

# File change
llmngn add "Refactored authentication module" --type file_change

# Task or todo
llmngn add "Need to add rate limiting" --type task

# Technical debt
llmngn add "Tech debt: Optimize database queries" --type debt

# Command you ran
llmngn add "Ran migration script" --type command

# Architecture note
llmngn add "System uses event-driven pattern" --type architecture
```

### 4. Add Metadata (Optional)

Include extra information like file paths:

```bash
llmngn add "Updated auth logic" --type file_change --metadata '{"file":"src/auth.ts"}'
```

### 5. Verify Your Storage

List all stored items:

```bash
llmngn list
```

List only decisions:

```bash
llmngn list --type decision
```

## Using the Interactive Command

In OpenCode, use natural language:

```
/llmngn store that we decided to use Redis for caching
```

This automatically stores your decision without typing the full command.

## Context Types Reference

| Type | Use For | Retention |
|------|---------|-----------|
| `decision` | Important choices | 180 days |
| `architecture` | System design | 365 days |
| `debt` | Technical debt | 90 days |
| `file_change` | Code changes | 90 days |
| `task` | Todos | 60 days |
| `command` | Commands run | 30 days |

## Troubleshooting

**Problem**: Command not found
- Run `llmngn --version` to verify installation
- Reinstall: `cd .opencode && bun install`

**Problem**: Data not persisting
- Check `.lancedb/` folder exists
- Verify `.opencode/plugins/llmngn.json` has `"enabled": true`

**Problem**: Can't see stored items in OpenCode
- Start a new session
- Context is injected at session start

## Related Guides

- [How to Search Context](search-context.md)
- [How to Export Data](export-data.md)
- [How to Delete Records](delete-records.md)
