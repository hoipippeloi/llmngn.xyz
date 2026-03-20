# Aspens Skill

Skill for using [aspens](https://npmx.dev/package/aspens/v/0.1.0) - CLI for managing AI-ready documentation across repos.

## What is Aspens?

Aspens scans your codebase, uses Claude to produce structured skill files, and keeps them updated on every commit. Skills are concise markdown files (~35 lines) that Claude Code loads automatically when working in specific parts of your codebase.

## Installation

No installation required - use via npx:

```bash
npx aspens scan .
```

## Requirements

- Node.js 18+
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)

## Commands

| Command | Description |
|---------|-------------|
| `aspens scan [path]` | Detect tech stack, frameworks, domains |
| `aspens doc init [path]` | Generate skills and CLAUDE.md |
| `aspens doc sync [path]` | Update skills based on git commits |
| `aspens add [name]` | Add components from bundled library |
| `aspens customize agents` | Inject project context into agents |

## Quick Start

```bash
# 1. Scan your repo
npx aspens scan .

# 2. Generate skills
npx aspens doc init .

# 3. Enable auto-sync on commits
npx aspens doc sync --install-hook
```

## Output

Skills are generated to `.claude/skills/`:

```
.claude/
└── skills/
    ├── base/
    │   └── skill.md
    ├── auth/
    │   └── skill.md
    └── billing/
        └── skill.md
```

## License

MIT
