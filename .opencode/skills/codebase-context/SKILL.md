name: codebase-context
description: Document and structure codebases for optimal LLM understanding using graph-based context. Use this skill whenever working with large codebases, refactoring legacy code, onboarding to new projects, or when you need to provide efficient code context to LLMs. This skill helps reduce token consumption by 70% while improving accuracy. Always use this skill when the user mentions code comprehension, codebase documentation, LLM context optimization, or working with complex multi-file projects.

---

# Codebase Context Skill

## Purpose

This skill helps you document and structure codebases in a way that optimizes LLM understanding and reduces token consumption. Based on graph-based context architecture, it treats source code as a rich, hierarchical, referential system rather than flat text.

## Why Graph-Based Context Matters

Source code is not flat text. It contains:
- **Symbols**: functions, types, variables, modules
- **Relationships**: calls, imports, inherits, uses
- **Scope boundaries**: lexical and module boundaries
- **Type hierarchies**: inheritance and composition

When you flatten this structure into plain token sequences, you strip away the very structure that enables understanding. This skill helps you preserve that structure in your documentation and context delivery.

## Core Architecture

### 1. Code Symbolization & Graph Ingestion

When documenting a codebase, extract and catalog:

```
Symbol Types:
- Functions (with signatures and call sites)
- Classes/Types (with properties and methods)
- Variables (with scope and lifetime)
- Modules (with imports and exports)
- Interfaces (with implementations)

Relationships:
- Function A calls Function B
- Class X extends Class Y
- Module M imports Module N
- Variable V is used in Function F
```

**Action**: When analyzing a codebase, start by creating a symbol inventory. Use tools like `grep`, `find`, or language-specific AST parsers to extract this information.

### 2. Semantic Overlay

Augment symbolic reasoning with semantic search:

```
For each symbol, capture:
- Definition text (for embedding)
- Comments and docstrings
- Usage examples
- Related symbols (via graph edges)
```

**Action**: Create an index file (`CODEBASE_INDEX.md`) that maps symbols to their locations and provides semantic descriptions.

### 3. Context Retrieval Strategy

When providing context to an LLM:

```
DO:
- Query the symbol graph for relevant neighborhoods
- Include only the minimum necessary context
- Preserve relationship information (imports, calls)
- Use structured snippets with clear boundaries

DON'T:
- Dump entire files into context
- Lose import/dependency information
- Strip away type definitions
- Remove scope boundary markers
```

## Implementation Workflow

### Step 1: Discover the Codebase Structure

```bash
# Get directory structure
find . -type f -name "*.ts" -o -name "*.js" -o -name "*.py" | head -50

# Find entry points
grep -r "export.*default" src/
grep -r "main\|index" src/

# Map dependencies
cat package.json | grep -A 20 "dependencies"
```

### Step 2: Create Symbol Graph Documentation

Create `.codebase-context/CODEBASE_GRAPH.md`:

```markdown
# Codebase Symbol Graph

## Entry Points
- `src/main.ts` - Application bootstrap
- `src/index.ts` - Public API exports

## Core Modules
| Module | Location | Imports | Exports |
|--------|----------|---------|---------|
| DataLayer | src/data/ | utils, types | Repository, Query |
| API Layer | src/api/ | data, auth | Router, Handlers |

## Function Call Graph
```
main.ts
  └── initApp()
        └── createDataLayer()
              └── connectDatabase()
        └── setupRoutes()
              └── registerHandlers()
```

## Type Hierarchy
```
BaseEntity
  ├── User
  ├── Session
  └── Transaction
```
```

### Step 3: Build Semantic Index

Create `.codebase-context/SEMANTIC_INDEX.md`:

```markdown
# Semantic Code Index

## Authentication Domain
| Symbol | Location | Purpose | Related |
|--------|----------|---------|---------|
| verifyToken | src/auth/jwt.ts | Validates JWT tokens | getToken, decodePayload |
| SessionManager | src/auth/session.ts | Manages user sessions | createSession, invalidate |

## Data Access Domain
| Symbol | Location | Purpose | Related |
|--------|----------|---------|---------|
| Repository | src/data/repo.ts | Generic CRUD operations | QueryBuilder, Transaction |
| QueryBuilder | src/data/query.ts | Composable query construction | Filter, Sort |
```

### Step 4: Create Context Retrieval Guide

Create `.codebase-context/CONTEXT_GUIDE.md`:

```markdown
# LLM Context Retrieval Guide

## When to Use This Guide
Use this guide when:
- Adding new features to existing modules
- Debugging cross-module issues
- Refactoring legacy code
- Onboarding to the codebase

## Context Selection Rules

1. **Start from the entry point** - Trace from main/entry through the call graph
2. **Include one level of dependencies** - For each symbol, include its direct imports
3. **Stop at abstraction boundaries** - Don't follow into well-documented library calls
4. **Prioritize recent changes** - Weight context toward recently modified files

## Token Budget Allocation

| Context Type | Budget | Priority |
|--------------|--------|----------|
| Current working file | 40% | High |
| Direct dependencies | 30% | High |
| Type definitions | 20% | Medium |
| Related utilities | 10% | Low |
```

## Output Deliverables

When running this skill, produce all files in a timestamped subfolder inside `.codebase-context/`:

```
.codebase-context/
  └── YYYYMMDD_HHMMSS/  # Timestamped folder (e.g., 20250115_143022)
        ├── README.md          # Summary and references entry point
        ├── CODEBASE_GRAPH.md
        ├── SEMANTIC_INDEX.md
        ├── CONTEXT_GUIDE.md
        └── ... (other generated files)
```

1. **README.md** - Summary and reference entry point for the LLM. This file provides an overview of the codebase context with links to detailed files, allowing the LLM to quickly understand the structure and navigate to specific details as needed.
2. **CODEBASE_GRAPH.md** - Symbol and relationship documentation
3. **SEMANTIC_INDEX.md** - Searchable symbol catalog
4. **CONTEXT_GUIDE.md** - Retrieval rules for future LLM sessions
5. **Updated .agents/skills/** - Any skill updates needed for the codebase

**Note**: Always create a new timestamped folder for each skill execution to maintain version history and enable comparison between runs. The LLM should start by reading `README.md` first, then use the references to dive into detailed files as needed.

## Best Practices

### Documentation Hygiene
- Keep documentation files under 300 lines each
- Use tables for symbol inventories (easier to scan)
- Include code snippets with location markers
- Update docs when code changes

### Token Efficiency
- Reference symbols by name + file path instead of including full definitions
- Use code fences with line number markers: `path/to/file.ts#L10-50`
- Prefer abbreviated signatures over full implementations
- Cache frequently-used context in dedicated files

### Relationship Preservation
- Always include import statements in context
- Document call chains, not just isolated functions
- Mark scope boundaries clearly
- Track type definitions with their usage sites

## Example Output

Here's what a well-documented codebase context looks like:

```
.codebase-context/
  └── 20250115_143022/
        ├── README.md              # Entry point with summary and refs
        ├── CODEBASE_GRAPH.md      # Symbol graph documentation
        ├── SEMANTIC_INDEX.md      # Searchable symbol catalog
        ├── CONTEXT_GUIDE.md       # Retrieval rules
        └── evals/
              └── evals.json
```

**README.md Content Structure**:

```markdown
# Codebase Context Summary

## Overview
Brief description of the codebase purpose and architecture.

## Quick Navigation
| File | Purpose | Key Sections |
|------|---------|--------------|
| [CODEBASE_GRAPH.md](./CODEBASE_GRAPH.md) | Symbol relationships | Entry Points, Call Graph |
| [SEMANTIC_INDEX.md](./SEMANTIC_INDEX.md) | Symbol catalog | Auth Domain, Data Domain |
| [CONTEXT_GUIDE.md](./CONTEXT_GUIDE.md) | Retrieval rules | Selection Rules, Token Budget |

## Entry Points
- `src/main.ts` - Application bootstrap
- `src/index.ts` - Public API

## Key Domains
- Authentication: [See SEMANTIC_INDEX.md#Authentication Domain](./SEMANTIC_INDEX.md)
- Data Access: [See SEMANTIC_INDEX.md#Data Access Domain](./SEMANTIC_INDEX.md)
- API Layer: [See CODEBASE_GRAPH.md#Core Modules](./CODEBASE_GRAPH.md)

## Change Summary
Files modified in this context run and their purposes.
```

```markdown
# Feature: User Authentication

## Files Modified
- src/auth/jwt.ts (token verification)
- src/api/routes.ts (route registration)
- src/middleware/auth.ts (request validation)

## Symbol Changes
| Symbol | Change | Impact |
|--------|--------|--------|
| verifyToken | Added expiry check | All authenticated routes |
| authMiddleware | Now async | Request pipeline |

## Test Coverage
- src/auth/__tests__/jwt.test.ts
- src/api/__tests__/routes.test.ts

## Related Context
- See: .codebase-context/SEMANTIC_INDEX.md#Authentication Domain
- See: .codebase-context/CODEBASE_GRAPH.md#Function Call Graph
```

## Anti-Patterns to Avoid

❌ **Flat File Dumps**
```
Don't paste entire files without structure
```

✅ **Structured Snippets**
```
Do use targeted snippets with context markers
```

❌ **Lost Dependencies**
```
Don't include code without its imports
```

✅ **Preserved Relationships**
```
Do show import chains and call relationships
```

❌ **No Navigation**
```
Don't leave symbols unindexed
```

✅ **Clear Indexing**
```
Do provide searchable symbol catalogs
```

## Test Cases

Save test cases to `evals/evals.json`:

```json
{
  "skill_name": "codebase-context",
  "evals": [
    {
      "id": 1,
      "prompt": "I need to understand this codebase before adding a new feature. Create documentation that helps an LLM efficiently navigate the code structure.",
      "expected_output": "CODEBASE_GRAPH.md, SEMANTIC_INDEX.md, and CONTEXT_GUIDE.md with symbol inventories, relationship mappings, and retrieval rules",
      "files": ["src/", "package.json"]
    },
    {
      "id": 2,
      "prompt": "We're refactoring the authentication module. Document the call graph and dependencies so the LLM can understand all affected code.",
      "expected_output": "Function call graph showing auth module dependencies, list of affected files, and token-efficient context snippets",
      "files": ["src/auth/", "src/api/", "src/middleware/"]
    },
    {
      "id": 3,
      "prompt": "This codebase is too large to fit in context. Create a retrieval strategy that lets the LLM work with specific modules without loading everything.",
      "expected_output": "CONTEXT_GUIDE.md with selection rules, token budget allocation, and indexed symbol catalog for targeted retrieval",
      "files": ["src/", ".codebase-context/"]
    }
  ]
}
```

## Related Skills

- **skill-creator**: For creating new skills from this workflow
- **code-documentation**: For generating API docs from the symbol graph
- **refactoring-assistant**: For using context graphs during code changes

## References

- Original methodology: https://www.waleed.de/posts/graph-database-llm-context
- Key benefits: 70% token reduction, improved accuracy, near-zero hallucinations
- Architecture layers: Symbolization, Semantic Overlay, Model Control Plane