# Getting Started with LLMNGN

Welcome to LLMNGN! This guide will help you get up and running in 5 minutes.

## What is LLMNGN?

LLMNGN is a context persistence plugin for OpenCode that remembers your coding decisions, changes, and patterns across sessions. No more starting from scratch every time you open a new session!

## Step 1: Install the Plugin

1. Open your terminal or command prompt
2. Navigate to your project folder
3. Run this command:

```bash
npx degit hoipippeloi/llmngn.xyz/.opencode .opencode && cd .opencode && bun install && cd ..
```

**For PowerShell users:**

```powershell
npx degit hoipippeloi/llmngn.xyz/.opencode .opencode; cd .opencode; bun install; cd ..
```

This installs:
- Plugin hooks (`.opencode/plugins/llmngn.ts`)
- Configuration (`.opencode/plugins/llmngn.json`)
- Interactive command (`.opencode/commands/llmngn.md`)

## Step 2: Verify Installation

1. Start OpenCode in your project
2. The plugin auto-loads automatically
3. No additional setup required!

## Step 3: Store Your First Decision

1. Open your terminal
2. Run this command:

```bash
llmngn add "This is my first decision note" --type decision
```

3. Verify it was stored:

```bash
llmngn list
```

🎉 Congratulations! You're ready to start using LLMNGN.

## Step 4: Use the Interactive Command

In OpenCode, you can now use:

```
/llmngn store that we decided to use Redis for caching
/llmngn show me my latest records
/llmngn find anything about authentication
```

## Next Steps

- [Learn how to search your context](how-to/search-context.md)
- [Explore all CLI commands](how-to/use-cli.md)
- [Understand context types](concepts/context-types.md)

## Need Help?

- 📧 Email: support@llmngn.xyz
- 🐛 [Report an issue](https://github.com/hoipippeloi/llmngn.xyz/issues)
- 📚 [Technical Docs](../tech/README.md)
