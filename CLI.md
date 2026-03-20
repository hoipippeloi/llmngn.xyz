# CLI Reference for llmngn

Quick reference for all commands available in this project.

## Development

| Command | When/Why |
|---------|----------|
| `npm run dev` | Start TypeScript watch mode during development |
| `npm run build` | Compile TypeScript to `dist/` before publishing or testing |
| `npm run typecheck` | Check types without emitting - run before committing |

## Testing

| Command | When/Why |
|---------|----------|
| `npm test` | Run all tests once (CI/pre-commit) |
| `npm run test:watch` | Run tests interactively during development |
| `npm run test:coverage` | Generate coverage report |

## LLMNGN CLI

The `llmngn` binary for managing the context database:

| Command | When/Why |
|---------|----------|
| `llmngn init` | Initialize plugin in a new project |
| `llmngn query <text>` | Search stored context from previous sessions |
| `llmngn history` | View session history with context counts |
| `llmngn stats` | Check database size and record counts |
| `llmngn export -o backup.json` | Backup context before major changes |
| `llmngn import backup.json` | Restore from backup |
| `llmngn purge --force` | Clear all stored context |
| `llmngn config list` | View current plugin settings |
| `llmngn config set <key> <value>` | Update a config setting |
| `llmngn config get <key>` | Get a specific config value |

## Plugin Setup

| Command | When/Why |
|---------|----------|
| `cd .opencode && bun install && cd ..` | Install plugin dependencies |

## Examples

```bash
# Start development
npm run dev

# In another terminal, run tests on change
npm run test:watch

# Before committing
npm run typecheck && npm test

# Build for production
npm run build

# Search for past decisions about authentication
llmngn query "authentication" --types decision

# Export context as backup before refactor
llmngn export --output backup.json

# Check database health
llmngn stats

# Clear all stored context
llmngn purge --force
```
