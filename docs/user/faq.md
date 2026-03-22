# Frequently Asked Questions (FAQ)

## Installation & Setup

### How do I install LLMNGN?

Run this in your project folder:

```bash
npx degit hoipippeloi/llmngn.xyz/opencode .opencode && cd .opencode && bun install && cd ..
```

See [Getting Started](getting-started.md) for details.

### Do I need to configure anything?

No! LLMNGN works out of the box with sensible defaults. You can customize settings in `.opencode/plugins/llmngn.json` if needed.

### How do I verify it's installed?

1. Start OpenCode in your project
2. The plugin auto-loads
3. Run `llmngn stats` in terminal to see database info

### Can I use LLMNGN with any LLM?

LLMNGN is designed for OpenCode CLI. It works with any model supported by OpenCode.

## Usage

### How do I store a decision?

```bash
llmngn add "Your decision text" --type decision
```

Or in OpenCode:
```
/llmngn store that we decided to use Redis
```

### How do I search my context?

```bash
llmngn query "your search term"
```

Or in OpenCode:
```
/llmngn find anything about authentication
```

### How do I see all my stored items?

```bash
llmngn list
```

### What are context types?

Context types categorize your stored information:

| Type | Use For | Retention |
|------|---------|-----------|
| `decision` | Important choices | 180 days |
| `architecture` | System design | 365 days |
| `debt` | Technical debt | 90 days |
| `file_change` | Code changes | 90 days |
| `task` | Todos | 60 days |
| `command` | Commands run | 30 days |

### How do I delete a record?

```bash
llmngn delete <record-id> --force
```

Get the ID from `llmngn list`.

### How do I backup my data?

```bash
llmngn export --output backup.json
```

Restore with:
```bash
llmngn import backup.json
```

## Technical

### Where is my data stored?

All data is stored locally in `.lancedb/` folder in your project directory. No cloud upload.

### Is my data secure?

Yes! Data stays on your machine. The plugin also auto-redacts:
- API keys
- Passwords
- Tokens
- Secrets

### How long is context kept?

Depends on type:
- Architecture: 365 days
- Decisions: 180 days
- File changes: 90 days
- Tasks: 60 days
- Commands: 30 days

Expired records auto-delete with `llmngn clean`.

### Can I use LLMNGN offline?

Yes! Everything runs locally. No internet required after installation.

### What if I delete the `.lancedb` folder?

You can recreate it by running `llmngn init` again. All data will be lost unless you have a backup.

### How do I reset everything?

```bash
rm -rf .lancedb
```

Then reinstall if needed.

### Can I share context with my team?

Export and share JSON files:

```bash
llmngn export --output team-context.json
```

Team members can import:
```bash
llmngn import team-context.json
```

### Why isn't context showing in OpenCode?

Context is injected at session start. Try:
1. Start a new OpenCode session
2. Verify data exists: `llmngn list`
3. Check plugin is enabled in `.opencode/plugins/llmngn.json`

### How does semantic search work?

LLMNGN uses vector embeddings to find conceptually related context, not just keyword matches. "Database" finds "PostgreSQL", "SQL", "data storage", etc.

## Billing

### Is LLMNGN free?

Yes! LLMNGN is completely free and open source (MIT license).

### Are there premium features?

No. All features are free.

## Support

### How do I report a bug?

Create an issue at: https://github.com/hoipippeloi/llmngn.xyz/issues

### How do I get help?

- 📧 Email: support@llmngn.xyz
- 🐛 [GitHub Issues](https://github.com/hoipippeloi/llmngn.xyz/issues)
- 📚 [Technical Docs](../tech/README.md)

### Can I contribute?

Yes! Check [Development Guide](../tech/development.md) for contributing information.

## Still Have Questions?

- 📧 Email: support@llmngn.xyz
- 🐛 [GitHub Issues](https://github.com/hoipippeloi/llmngn.xyz/issues)
- 📚 [Technical Documentation](../tech/)
