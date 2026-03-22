# Tutorial: Team Collaboration with LLMNGN

In this tutorial, you'll learn how to share context and decisions with your team using LLMNGN.

**Time**: 15 minutes
**Difficulty**: Intermediate
**Prerequisites**: LLMNGN installed, team project

## What You'll Build

A shared context workflow where team members can:
- Export project decisions
- Import team knowledge
- Maintain consistent architecture
- Onboard new developers quickly

## Step 1: Capture Team Decisions

During a team meeting or planning session, store key decisions:

```bash
# Architecture decision
llmngn add "Microservices with API gateway pattern" --type architecture

# Technology choice
llmngn add "React frontend, Node.js backend, PostgreSQL database" --type decision

# Coding standards
llmngn add "ESLint + Prettier with Airbnb config" --type decision

# Technical debt
llmngn add "Refactor legacy auth module in Q2" --type debt
```

## Step 2: Export Team Context

Create a shareable backup:

```bash
llmngn export --output team-context.json
```

This file contains:
- All decisions
- Architecture notes
- File changes
- Tasks and debt tracking

## Step 3: Share with Team

**Options:**

1. **Git repository**: Commit to version control
   ```bash
   git add team-context.json
   git commit -m "Add team context backup"
   ```

2. **Shared drive**: Place in team shared folder

3. **Direct transfer**: Send via email/chat

## Step 4: Team Member Imports

New team member or different machine:

```bash
llmngn import team-context.json
```

Verify:

```bash
llmngn list
```

All team decisions are now available!

## Step 5: Onboard New Developer

New team member joins:

1. Install LLMNGN:
   ```bash
   npx degit hoipippeloi/llmngn.xyz/opencode .opencode && cd .opencode && bun install && cd ..
   ```

2. Import team context:
   ```bash
   llmngn import team-context.json
   ```

3. Search to learn:
   ```bash
   llmngn query "architecture"
   llmngn query "authentication"
   ```

They now understand all past decisions without lengthy handover meetings!

## Step 6: Maintain Living Documentation

**Weekly workflow:**

```bash
# Each developer stores their work
llmngn add "Implemented user roles" --type file_change --metadata '{"file":"src/roles.ts"}'

# Team lead exports monthly
llmngn export --output team-context-2025-01.json

# Commit to git for history
git add team-context-2025-01.json
git commit -m "January team context"
```

## Step 7: Use in OpenCode Sessions

Team members in OpenCode:

```
/llmngn show me authentication decisions
/llmngn what architecture patterns do we have?
/llmngn find recent file changes
```

Everyone has access to the same context!

## Best Practices

### Regular Exports

```bash
# Monthly backup
llmngn export --output team-context-$(date +%Y-%m).json
```

### Decision Reviews

```bash
# Review all architecture decisions
llmngn list --type architecture
```

### Clean Expired

```bash
# Monthly cleanup
llmngn clean
```

### Merge Contexts

Multiple team members can export and merge:

```bash
# Export individual contexts
llmngn export --output dev1-context.json
llmngn export --output dev2-context.json

# Merge manually or use script
```

## Troubleshooting

**Problem**: Import fails
- Ensure JSON is valid
- Check file path
- Verify LLMNGN version compatibility

**Problem**: Context conflicts
- Review before importing
- Merge manually if needed
- Export baseline first

**Problem**: Team member can't see context
- Verify import succeeded: `llmngn list`
- Check file permissions
- Re-import if needed

## Next Steps

- [Export/Import Guide](../how-to/export-data.md)
- [Search Context](../how-to/search-context.md)
- [CLI Reference](../how-to/use-cli.md)

## Congratulations!

You've set up team collaboration with LLMNGN. Your team now shares persistent context across all members! 🎉
