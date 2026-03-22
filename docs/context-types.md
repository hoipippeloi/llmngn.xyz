# Context Types

| Type | When Stored | Purpose |
|------|-------------|---------|
| `file_change` | On file edits (create/modify/delete) | Track code modifications with diffs, affected paths, and related tasks |
| `decision` | When architectural/pattern choices are made | Preserve rationale, alternatives considered, and decision context |
| `debt` | When technical debt is identified | Record debt type, severity, estimated effort, and blocking status |
| `task` | When tasks are tracked | Monitor task status, dependencies, and blockers |
| `architecture` | On project init or architectural changes | Store component relationships, layers, and system constraints |
| `command` | After shell command execution | Log CLI commands run, exit codes, duration, and side effects |
| `completion` | When actions finish (fixed/created/implemented/refactored) | Record completed work for session continuity |

## Retention Periods

| Type | Days |
|------|------|
| architecture | 365 |
| decision | 180 |
| file_change | 90 |
| task | 60 |
| completion | 60 |
| debt | configured default |
| command | 30 |

## Default Salience Weights

| Type | Weight |
|------|--------|
| decision | 1.0 |
| file_change | 1.0 |
| debt | 0.9 |
| completion | 0.85 |
| task | 0.7 |
| command | 0.5 |
