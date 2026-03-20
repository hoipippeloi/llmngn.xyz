# OpenCode Events & Hooks Reference

This document provides a comprehensive reference for all available events/hooks in OpenCode plugins, including their timing, context, and usage patterns.

## Overview

Plugins in OpenCode extend functionality by hooking into various events throughout the application lifecycle. Each hook receives context about the current state and can optionally modify behavior before or after an action occurs.

---

## Plugin Context Object

When a plugin initializes, it receives the following context object:

```typescript
{
  project:     // Current project information
  directory:   // Current working directory path
  worktree:    // Git worktree path
  client:      // OpenCode SDK client for AI interactions
  $:           // Bun's shell API for executing commands
}
```

### Example Plugin Structure

```typescript
export const MyPlugin = async ({ project, client, $, directory, worktree }) => {
  console.log("Plugin initialized!")
  
  return {
    // Hook implementations go here
  }
}
```

---

## Event Categories

### Command Events

| Event | Timing | Context |
|-------|--------|---------|
| `command.executed` | After a command finishes execution | Command execution details |

---

### File Events

| Event | Timing | Context |
|-------|--------|---------|
| `file.edited` | When a file is modified | File path and change details |
| `file.watcher.updated` | When the file watcher detects changes | Watcher update information |

---

### Installation Events

| Event | Timing | Context |
|-------|--------|---------|
| `installation.updated` | When OpenCode installation is updated | Installation details |

---

### LSP Events (Language Server Protocol)

| Event | Timing | Context |
|-------|--------|---------|
| `lsp.client.diagnostics` | When LSP reports diagnostics/errors | Diagnostic information from the language server |
| `lsp.updated` | When LSP configuration/state changes | LSP update details |

---

### Message Events

| Event | Timing | Context |
|-------|--------|---------|
| `message.part.removed` | When a message part is removed | Message part identifier |
| `message.part.updated` | When a message part changes | Updated part content |
| `message.removed` | When an entire message is removed | Message identifier |
| `message.updated` | When a message is modified | Updated message content |

---

### Permission Events

| Event | Timing | Context |
|-------|--------|---------|
| `permission.asked` | When OpenCode requests user permission | Permission request details |
| `permission.replied` | When user responds to permission request | User's permission response |

---

### Server Events

| Event | Timing | Context |
|-------|--------|---------|
| `server.connected` | When connection to server is established | Connection information |

---

### Session Events

| Event | Timing | Context |
|-------|--------|---------|
| `session.created` | When a new session starts | Session initialization data |
| `session.compacted` | After session context is compacted | Compacted session summary |
| `session.deleted` | When a session is removed | Session identifier |
| `session.diff` | When session changes are detected | Diff information |
| `session.error` | When a session encounters an error | Error details |
| `session.idle` | When session becomes idle/inactive | Idle state information |
| `session.status` | When session status changes | Status update |
| `session.updated` | When session content is modified | Updated session data |

---

### Todo Events

| Event | Timing | Context |
|-------|--------|---------|
| `todo.updated` | When a todo item changes | Todo item details |

---

### Shell Events

| Event | Timing | Context |
|-------|--------|---------|
| `shell.env` | Before shell command execution | Current working directory; allows modifying `output.env` |

---

### Tool Events

| Event | Timing | Context |
|-------|--------|---------|
| `tool.execute.before` | **Before** a tool runs | `input` (tool name, args) and `output` (modifiable) |
| `tool.execute.after` | **After** a tool completes | Tool execution results |

#### Hook Signature

```typescript
"tool.execute.before": async (input, output) => {
  // input.tool  - tool name (e.g., "bash", "read")
  // input.args  - tool arguments
  // output      - modifiable output object
}
```

---

### TUI Events (Terminal User Interface)

| Event | Timing | Context |
|-------|--------|---------|
| `tui.prompt.append` | When appending to TUI prompt | Prompt content |
| `tui.command.execute` | When a TUI command runs | Command details |
| `tui.toast.show` | When a toast notification displays | Toast message |

---

### Experimental Hooks

| Event | Timing | Context |
|-------|--------|---------|
| `experimental.session.compacting` | **Before** LLM generates compaction summary | `input` (current context) and `output` (modifiable `output.context` array and `output.prompt`) |

This hook allows you to:
- Inject custom context via `output.context.push()`
- Replace the entire prompt via `output.prompt = "..."`

---

## Hook Execution Pattern

Most hooks follow an **input/output pattern**:

```typescript
"event.name": async (input, output) => {
  // Read from input
  // Modify output
  // Optionally throw to prevent action
}
```

### Throwing to Prevent Actions

You can throw an error to prevent an action from proceeding:

```typescript
"tool.execute.before": async (input, output) => {
  if (input.tool === "read" && output.args.filePath.includes(".env")) {
    throw new Error("Do not read .env files")
  }
}
```

---

## Plugin Examples

### Send Notifications

```typescript
export const NotificationPlugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      // Send notification on session completion
      if (event.type === "session.idle") {
        await $`osascript -e 'display notification "Session completed!" with title "opencode"'`
      }
    },
  }
}
```

### Environment Variable Injection

```typescript
export const InjectEnvPlugin = async () => {
  return {
    "shell.env": async (input, output) => {
      output.env.MY_API_KEY = "secret"
      output.env.PROJECT_ROOT = input.cwd
    },
  }
}
```

### Custom Tools

```typescript
import { type Plugin, tool } from "@opencode-ai/plugin"

export const CustomToolsPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      mytool: tool({
        description: "This is a custom tool",
        args: {
          foo: tool.schema.string(),
        },
        async execute(args, context) {
          const { directory, worktree } = context
          return `Hello ${args.foo} from ${directory} (worktree: ${worktree})`
        },
      }),
    },
  }
}
```

### Structured Logging

```typescript
export const MyPlugin = async ({ client }) => {
  await client.app.log({
    body: {
      service: "my-plugin",
      level: "info",
      message: "Plugin initialized",
      extra: { foo: "bar" },
    },
  })
}
```

**Log levels:** `debug`, `info`, `warn`, `error`

### Compaction Hooks

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const CompactionPlugin: Plugin = async (ctx) => {
  return {
    "experimental.session.compacting": async (input, output) => {
      // Inject additional context into the compaction prompt
      output.context.push(`## Custom Context
Include any state that should persist across compaction:
- Current task status
- Important decisions made
- Files being actively worked on`)
    },
  }
}
```

---

## Plugin Load Order

Plugins are loaded from all sources and all hooks run in sequence. The load order is:

1. **Global config** (`~/.config/opencode/opencode.json`)
2. **Project config** (`opencode.json`)
3. **Global plugin directory** (`~/.config/opencode/plugins/`)
4. **Project plugin directory** (`.opencode/plugins/`)

### Important Notes

- Duplicate npm packages with the same name and version are loaded **once**
- A local plugin and an npm plugin with similar names are **both loaded separately**
- All hooks run **in sequence** through the load order

---

## Plugin Installation Paths

### Local Files

Place JavaScript or TypeScript files in:
- `.opencode/plugins/` - Project-level plugins
- `~/.config/opencode/plugins/` - Global plugins

Files in these directories are automatically loaded at startup.

### NPM Packages

Specify npm packages in your config file `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "opencode-helicone-session",
    "opencode-wakatime",
    "@my-org/custom-plugin"
  ]
}
```

Both regular and scoped npm packages are supported.

---

## TypeScript Support

For TypeScript plugins, import types from the plugin package:

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    // Type-safe hook implementations
  }
}
```

---

## Dependencies

Local plugins can use external npm packages. Add a `package.json` to your config directory:

```json
{
  "dependencies": {
    "shescape": "^2.1.0"
  }
}
```

OpenCode runs `bun install` at startup to install these dependencies.

---

## Additional Resources

- [OpenCode Plugin Documentation](https://opencode.ai/docs/plugins/)
- [Community Plugin Examples](https://opencode.ai/docs/plugins/#examples)
- [Plugin Ecosystem](https://opencode.ai/ecosystem)