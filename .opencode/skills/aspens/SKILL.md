---
name: aspens
description: CLI for managing AI-ready documentation across repos. Use when generating, syncing, or maintaining Claude Code skill files. Triggers: (1) "generate skills for this codebase", (2) "update documentation after commits", (3) "scan repo for tech stack", (4) "create .claude/skills", (5) "aspens scan/doc/sync commands".
---

# Aspens

CLI for generating and maintaining AI-ready documentation. Scans repos, uses Claude to produce structured skill files, and keeps them updated on every commit.

## Commands

### aspens scan [path]

Detect tech stack, frameworks, structure, and domains. No LLM calls.

```bash
npx aspens scan .           # Scan current directory
npx aspens scan . --json    # JSON output
```

Output includes: languages, frameworks, entry points, structure, key directories, detected domains.

### aspens doc init [path]

Generate skills and CLAUDE.md. Claude gets read-only access to explore patterns, conventions, and critical rules.

```bash
npx aspens doc init .                    # Interactive mode
npx aspens doc init . --mode all         # Generate all at once
npx aspens doc init . --mode base-only   # Base skill only
npx aspens doc init . --force            # Overwrite existing
npx aspens doc init . --verbose          # Real-time progress
```

Options:
- `--dry-run` - Preview without writing
- `--force` - Overwrite existing skills
- `--timeout <seconds>` - Claude timeout (default: 300)
- `--mode <all|chunked|base-only>` - Generation mode
- `--strategy <improve|rewrite|skip>` - For existing docs
- `--model <model>` - Claude model (sonnet, opus, haiku)
- `--verbose` - Show Claude's reading in real time

### aspens doc sync [path]

Update skills based on recent git commits. Reads diff, maps changes to affected skills, updates only what changed.

```bash
npx aspens doc sync .                    # Sync last commit
npx aspens doc sync . --commits 5        # Last 5 commits
npx aspens doc sync . --install-hook     # Auto-sync on commit
```

Options:
- `--commits <n>` - Number of commits (default: 1)
- `--install-hook` - Install git post-commit hook
- `--dry-run` - Preview without writing
- `--timeout <seconds>` - Claude timeout
- `--model <model>` - Claude model
- `--verbose` - Real-time progress

### aspens add [name]

Add individual components from bundled library.

```bash
npx aspens add agent all              # All 9 AI agents
npx aspens add agent code-reviewer    # Specific agent
npx aspens add agent --list           # Browse agents
npx aspens add hook skill-activation  # Auto-triggering hooks
npx aspens add command dev-docs       # Slash commands
```

### aspens customize agents

Inject project's tech stack, conventions, and file paths into installed agents.

```bash
npx aspens customize agents           # Customize all
npx aspens customize agents --dry-run # Preview changes
```

## Workflow

```
Your Repo -> Scanner -> Claude -> .claude/skills/
            (detect    (explore   (skill files
            stack,      code,      Claude Code
            domains)    generate)  loads auto)
```

1. **Scanner** - Detects tech stack, frameworks, structure, domains (deterministic, no LLM)
2. **Claude** - Explores codebase with read-only tools, generates skills
3. **Skills** - Written to `.claude/skills/`, discovered automatically by Claude Code

## Skill File Structure

Generated skills are ~35 lines with YAML frontmatter:

```markdown
---
name: billing
description: Stripe billing integration - subscriptions, usage tracking, webhooks
---

## Activation
Triggers when editing billing/payment files: `**/billing*.ts`, `**/stripe*.ts`

## Key Files
- `src/services/billing/stripe.ts` - Stripe SDK wrapper
- `src/services/billing/usage.ts` - Usage counters

## Key Concepts
- Webhook-driven state changes
- Usage gating with `checkLimit(userId, type)`

## Critical Rules
- Webhook endpoint: NO auth middleware (Stripe signature only)
- Cancel = `cancel_at_period_end: true`
```

## Requirements

- Node.js 18+
- Claude Code CLI: `npm install -g @anthropic-ai/claude-code`

## Quick Start

```bash
npx aspens scan .                    # See what's in repo
npx aspens doc init .                # Generate skills + CLAUDE.md
npx aspens doc sync --install-hook   # Auto-update on commit
```
