# Tutorial: Your First LLMNGN Workflow

In this tutorial, you'll learn how to use LLMNGN to maintain context across your coding sessions.

**Time**: 10 minutes
**Difficulty**: Beginner
**Prerequisites**: OpenCode installed

## What You'll Learn

- Store architectural decisions
- Search context semantically
- Maintain continuity between sessions
- Backup your data

## Step 1: Install LLMNGN

Open terminal in your project:

```bash
npx degit hoipippeloi/llmngn.xyz/.opencode .opencode && cd .opencode && bun install && cd ..
```

Verify:

```bash
llmngn stats
```

## Step 2: Start Your First Session

1. Open OpenCode in your project
2. Begin working on a feature
3. Make an architectural decision

For example: "I'll use JWT for authentication"

## Step 3: Store the Decision

In your terminal:

```bash
llmngn add "Using JWT for stateless authentication" --type decision
```

Or in OpenCode:

```
/llmngn store that we're using JWT for auth
```

## Step 4: Add More Context

As you work, store more decisions:

```bash
# Database choice
llmngn add "PostgreSQL for primary database with Redis cache" --type architecture

# Task tracking
llmngn add "Need to implement rate limiting" --type task

# File change
llmngn add "Created auth middleware in src/middleware/auth.ts" --type file_change
```

## Step 5: Start a New Session

Close OpenCode and start a new session later.

LLMNGN automatically:
1. Queries your stored context
2. Finds relevant decisions
3. Injects them into the new session

The AI now knows about your JWT decision without you explaining it again!

## Step 6: Search Your Context

Find all authentication-related context:

```bash
llmngn query "authentication"
```

Or in OpenCode:

```
/llmngn find anything about auth
```

## Step 7: View All Records

See everything you've stored:

```bash
llmngn list
```

Filter by type:

```bash
llmngn list --type decision
```

## Step 8: Backup Your Data

Before making major changes:

```bash
llmngn export --output backup.json
```

You can restore later:

```bash
llmngn import backup.json
```

## Step 9: Clean Expired Data

Remove old expired records:

```bash
llmngn clean
```

## What You've Built

You now have a persistent memory system that:

✅ Remembers your architectural decisions
✅ Tracks file changes
✅ Maintains task lists
✅ Survives across sessions
✅ Backs up safely

## Next Steps

Now that you've learned the workflow, try:

- [Search context effectively](../how-to/search-context.md)
- [Use advanced CLI options](../how-to/use-cli.md)
- [Understand context types](concepts/context-types.md)

## Pro Tips

**Be consistent**: Store decisions as you make them

**Use types**: Categorize with `--type decision` for better organization

**Search smart**: Use semantic queries, not just keywords

**Backup often**: Export before major refactors

## Congratulations!

You've mastered the LLMNGN workflow. Happy coding with persistent context! 🎉
