<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# what hooks can we use for opencode.ai plugins to inject, intercept and add logic to the agents?

**OpenCode.ai plugins use specific hooks to inject, intercept, and add logic to agents through a JavaScript/TypeScript module system.**[^1_1]

These hooks allow modification of chat flows, tool executions, parameters, permissions, and event handling in the agent's lifecycle.

## Key Interception Hooks

Use these for injecting or blocking agent actions:

- `'chat.message'`: Intercept and log/modify messages before LLM processing.
- `'chat.params'`: Adjust LLM parameters like temperature or options based on context.
- `'tool.execute.before'`: Modify tool arguments or block execution (e.g., prevent .env reads).[^1_2]
- `'tool.execute.after'`: Process or log tool outputs post-execution.
- `'permission.ask'`: Auto-approve/deny permissions for agent requests.


## Event Subscription Hooks

Subscribe to agent lifecycle events for reactive logic:

- Session: `'session.created'`, `'session.updated'`, `'session.error'`.[^1_1]
- Message: `'message.updated'`, `'message.part.updated'`.[^1_1]
- File: `'file.edited'`, `'file.watcher.updated'`.[^1_1]
- Tool: `'tool.execute.before/after'` (as above).[^1_1]


## Custom Tool Injection

Add agent-callable tools via the `tool` helper:

```typescript
tool({
  description: 'Custom action',
  args: { input: tool.schema.string() },
  async execute(args) { /* Logic here */ }
})
```

This extends agent capabilities seamlessly.[^1_2][^1_1]

## Implementation Example

```typescript
export const AgentInterceptor: Plugin = async (ctx) => ({
  'tool.execute.before': async ({ tool }, { args }) => {
    if (tool === 'read' && args.filePath?.includes('.env')) {
      throw new Error('Blocked sensitive file');
    }
  },
  'chat.params': async (_, { temperature }) => {
    temperature = 0.7;  // Inject lower creativity
  }
});
```

Place in `.opencode/plugins/` or `opencode.json`.[^1_2][^1_1]
<span style="display:none">[^1_10][^1_3][^1_4][^1_5][^1_6][^1_7][^1_8][^1_9]</span>

<div align="center">⁂</div>

[^1_1]: https://opencode.ai/docs/plugins/

[^1_2]: https://gist.github.com/rstacruz/946d02757525c9a0f49b25e316fbe715

[^1_3]: https://www.youtube.com/watch?v=tnBQL9fo470

[^1_4]: https://lobehub.com/skills/fkxxyz-cclover-skills-opencode-plugin-development

[^1_5]: https://github.com/anomalyco/opencode/issues/14451

[^1_6]: https://opencode.ai/docs/

[^1_7]: https://dev.to/einarcesar/does-opencode-support-hooks-a-complete-guide-to-extensibility-k3p

[^1_8]: https://github.com/sst/opencode/issues/5894

[^1_9]: https://docs.z.ai/devpack/tool/opencode

[^1_10]: https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a


---

# How to create a basic plugin file for opencode.ai

OpenCode.ai plugins are simple JavaScript or TypeScript modules placed in specific directories for automatic loading.[^2_1]

They export an async `Plugin` function that returns hooks, tools, or other extensions.[^2_2]

## File Locations

Choose project or global scope:

- Project-level: `.opencode/plugins/` (loaded per project).
- Global: `~/.config/opencode/plugins/` (loaded everywhere).[^2_3][^2_1]

Files auto-load on startup as JS/TS modules.[^2_1]

## Basic Structure

Create `basic-plugin.ts` (or `.js`):

```typescript
import type { Plugin } from '@opencode-ai/plugin'  // Optional for types

export const BasicPlugin: Plugin = async (ctx) => {
  console.log('Plugin loaded!')
  return {
    // Hooks, tools here
    'chat.message': async ({}, { message }) => {
      console.log('Message:', message.content)
    },
  }
}
```

The `ctx` provides access to `project`, `client`, `$` (Bun shell), etc.[^2_4][^2_2]

## Setup Steps

1. Create directory: `mkdir .opencode/plugins` (or global path).[^2_1]
2. Add your `.ts`/`.js` file with the export above.
3. Restart OpenCode; it loads automatically (Bun handles TS).[^2_1]
4. For dependencies: Add `package.json` in config dir; Bun installs on start.[^2_1]

## Testing

- Log in hooks to verify loading.
- Use `'chat.message'` for simple interception.
- Check console or agent output for effects.[^2_2]

Example adds a log on every message—extend with tools or params as needed.[^2_2]
<span style="display:none">[^2_10][^2_5][^2_6][^2_7][^2_8][^2_9]</span>

<div align="center">⁂</div>

[^2_1]: https://opencode.ai/docs/plugins/

[^2_2]: https://gist.github.com/rstacruz/946d02757525c9a0f49b25e316fbe715

[^2_3]: https://opencode.ai/docs/config/

[^2_4]: https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a

[^2_5]: https://github.com/awesome-opencode/awesome-opencode

[^2_6]: https://www.nxcode.io/resources/news/opencode-tutorial-2026

[^2_7]: https://www.youtube.com/watch?v=Wu3G1QwM81M

[^2_8]: https://github.com/zenobi-us/opencode-plugin-template

[^2_9]: https://opencode.ai/docs/ecosystem/

[^2_10]: https://lobehub.com/skills/fkxxyz-cclover-skills-opencode-plugin-development


---

# How to add a custom tool to an OpenCode plugin

Creating a custom tool in an OpenCode plugin is straightforward using the `tool()` helper from `@opencode-ai/plugin`.[^3_1]

Tools become available to the agent alongside built-ins like `read` or `bash`, with the filename often influencing the tool name.[^3_3]

## File Setup

Place in `.opencode/plugins/my-tool.ts` (or global `~/.config/opencode/plugins/`).

Add `package.json` nearby for deps (Bun auto-installs on start).[^3_8][^3_1]

## Basic Tool Example

```typescript
import { tool } from '@opencode-ai/plugin'

export const MyPlugin: Plugin = async (ctx) => ({
  tool: {
    calculator: tool({
      description: 'Add two numbers',
      args: {
        a: tool.schema.number().describe('First number'),
        b: tool.schema.number().describe('Second number')
      },
      async execute(args, ctx) {
        return { result: args.a + args.b }
      }
    })
  }
})
```

This creates a `calculator` tool the agent can call.[^3_4][^3_1]

## Multiple Tools per File

Export several under one plugin:

```typescript
export const MathTools: Plugin = async (ctx) => ({
  tool: {
    add: tool({
      description: 'Add numbers',
      args: { a: tool.schema.number(), b: tool.schema.number() },
      async execute({a, b}) { return a + b }
    }),
    multiply: tool({
      description: 'Multiply numbers',
      args: { a: tool.schema.number(), b: tool.schema.number() },
      async execute({a, b}) { return a * b }
    })
  }
})
```

Yields `mathtools_add` and `mathtools_multiply` tools.[^3_3]

## Advanced: External Script

Invoke Python/other langs via `Bun.$`:

```typescript
// tools/python-add.py (separate file)
#!/usr/bin/env python3
import sys, json
a, b = map(int, sys.argv[1:])
print(json.dumps({"result": a + b}))

export const PythonAdd: Plugin = async () => ({
  tool: {
    pyadd: tool({
      args: { a: tool.schema.number(), b: tool.schema.number() },
      async execute({a, b}, { $ }) {
        const result = await $`python tools/python-add.py ${a} ${b}`
        return JSON.parse(await result.text())
      }
    })
  }
})
```

Restart OpenCode to load; agent now uses your tools automatically.[^3_3]
<span style="display:none">[^3_2][^3_5][^3_6][^3_7][^3_9]</span>

<div align="center">⁂</div>

[^3_1]: https://opencode.ai/docs/plugins/

[^3_2]: https://www.youtube.com/watch?v=jFnrRTNwMLM

[^3_3]: https://opencode.ai/docs/custom-tools/

[^3_4]: https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a

[^3_5]: https://lobehub.com/en/skills/sandgardenhq-sgai-opencode-plugin-development

[^3_6]: https://agentskills.so/skills/igorwarzocha-opencode-workflows-create-opencode-plugin

[^3_7]: https://www.youtube.com/watch?v=Wu3G1QwM81M

[^3_8]: https://opencode.ai/docs/config/

[^3_9]: https://www.reddit.com/r/opencodeCLI/comments/1qgkk1d/any_tips_on_how_to_setup_in_opencode_a_open/


---

# Example of a complete OpenCode plugin file

OpenCode plugins are TypeScript/JavaScript modules that combine hooks, custom tools, and event handlers in a single file.[^4_1]

Here's a complete example file demonstrating multiple features for a practical workflow.[^4_2]

## Complete Plugin Example

Save as `.opencode/plugins/commit-guard.ts`:

```typescript
import type { Plugin } from '@opencode-ai/plugin'

interface SessionState {
  filesModified: string[]
  commitMade: boolean
}

const sessions = new Map<string, SessionState>()

export const CommitGuard: Plugin = async ({ client, $ }) => {
  console.log('CommitGuard plugin loaded!')

  return {
    // Custom tool: Smart commit message generator
    tool: {
      smartCommit: tool({
        description: 'Generate git commit message from changed files',
        args: {
          files: tool.schema.array(tool.schema.string()).optional().describe('Files to summarize')
        },
        async execute({ files }, { sessionID }) {
          const state = sessions.get(sessionID!)
          const changedFiles = files || state?.filesModified || []
          
          if (changedFiles.length === 0) {
            return { message: 'No changes detected' }
          }

          // Analyze changes
          const summaries = await Promise.all(
            changedFiles.slice(0, 3).map(async (file) => {
              const content = await $`cat ${file}`.text()
              return `${file}: ${content.slice(0, 100)}...`
            })
          )

          return { 
            message: `feat: update ${changedFiles.length} files\n\n${summaries.join('\n')}` 
          }
        }
      })
    },

    // Track file modifications
    'tool.execute.after': async (input) => {
      const { tool, args, sessionID } = input
      const state = sessions.get(sessionID) || { filesModified: [], commitMade: false }
      
      if ((tool === 'edit' || tool === 'write') && args?.filePath) {
        const path = args.filePath as string
        if (!state.filesModified.includes(path)) {
          state.filesModified.push(path)
          sessions.set(sessionID, state)
        }
      }
      
      // Detect commits
      if (tool === 'bash' && /git\s+commit/.test((args?.command as string) || '')) {
        state.commitMade = true
        sessions.set(sessionID, state)
      }
    },

    // Warn on session end if uncommitted
    stop: async (input) => {
      const sessionId = (input as any).sessionID || (input as any).session_id
      const state = sessions.get(sessionId)
      
      if (state?.filesModified.length > 0 && !state.commitMade) {
        await client.session.prompt({
          path: { id: sessionId },
          body: {
            parts: [{
              type: 'text',
              text: `⚠️ You modified ${state.filesModified.length} files but haven't committed.\n\nUse \`smartCommit\` tool or \`git commit\` before stopping.`
            }]
          }
        })
      }
      sessions.delete(sessionId)
    },

    // Log all messages (debug hook)
    'chat.message': async ({}, { message }) => {
      console.log(`[MSG] ${message.role}: ${message.content.slice(0, 100)}...`)
    },

    // Adjust LLM params for code generation
    'chat.params': async (_, { temperature }) => {
      return { temperature: 0.1 }  // Lower creativity for code
    }
  }
}
```


## Features Demonstrated

- **Custom tool** (`smartCommit`): Agent-callable with Zod schema validation.[^4_1]
- **File tracking**: Monitors `edit`/`write` tools across session.[^4_2]
- **Event hooks**: `tool.execute.after`, `chat.message`, `chat.params`.[^4_1]
- **Session state**: Persistent tracking with Map cleanup.[^4_2]
- **Shell access**: Uses `$` for file reads and commands.[^4_1]
- **Client interaction**: Sends prompts via `client.session.prompt`.[^4_2]

Restart OpenCode to load. Agent gains `smartCommit` tool and automatic commit reminders.[^4_1]
<span style="display:none">[^4_3][^4_4][^4_5][^4_6][^4_7][^4_8][^4_9]</span>

<div align="center">⁂</div>

[^4_1]: https://opencode.ai/docs/plugins/

[^4_2]: https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a

[^4_3]: https://www.youtube.com/watch?v=t5RALu8TbaU

[^4_4]: https://lobehub.com/skills/fkxxyz-cclover-skills-opencode-plugin-development

[^4_5]: https://opencode.ai/docs/config/

[^4_6]: https://www.youtube.com/watch?v=Wu3G1QwM81M

[^4_7]: https://github.com/awesome-opencode/awesome-opencode

[^4_8]: https://agentskills.so/skills/igorwarzocha-opencode-workflows-create-opencode-plugin

[^4_9]: https://cefboud.com/posts/coding-agents-internals-opencode-deepdive/


---

# How to test a complete OpenCode plugin locally

Testing OpenCode plugins locally is done through live reloading and console logging since there's no formal test runner. Plugins load automatically from standard directories on startup.

## Quick Setup \& Load

1. Place your plugin file (e.g., `commit-guard.ts`) in `.opencode/plugins/`.
2. Add `console.log('Plugin loaded!')` at the top of your plugin function.
3. Restart OpenCode: `opencode` (CLI) or quit/reopen desktop app.
4. Check terminal for your log message—confirms loading.[^5_1][^5_3]

## Live Testing Steps

**Verify tool registration:**

```
@ Ask agent: "Use smartCommit tool"
```

Agent should list/execute your custom tool if registered correctly.[^5_3]

**Test hooks interactively:**

- Add logs to `'chat.message'`, `'tool.execute.before'` hooks
- Chat normally; watch console for trigger logs

```
[MSG] user: Hello
[TOOL] read: ./src/index.ts
```

**Trigger specific scenarios:**

```
# Test file tracking (from commit-guard example)
@ Edit a file, then stop session
# Should see commit warning prompt
```


## Debug Workflow

```
# 1. Enable verbose logging
OPENCODE_LOG=debug opencode

# 2. Watch plugin dir for changes (Bun hot-reloads TS)
# Save file → auto-reload on next agent action

# 3. Check plugin errors
~/.cache/opencode/logs/  # Full logs
```


## Isolation Testing

**Test in clean project:**

```
mkdir test-plugin
cd test-plugin
mkdir .opencode/plugins
cp your-plugin.ts .opencode/plugins/
opencode
```

**bun link for package testing:**

```
# In plugin package dir
bun link

# In test project
bun link your-plugin-package
# Add to opencode.json: "plugins": ["your-plugin-package"]
```


## Common Issues

| Issue | Fix |
| :-- | :-- |
| Plugin not loading | Check `.opencode/plugins/` path, restart |
| TS errors | Add `package.json` with `"typescript": "latest"` |
| Tool not found | Verify `tool()` export format, check logs |
| Hook not firing | Console.log inputs, verify hook name spelling |

Start with simple `console.log` in plugin body, then add tool calls and complex hooks progressively.[^5_2][^5_1]
<span style="display:none">[^5_4][^5_5][^5_6][^5_7][^5_8][^5_9]</span>

<div align="center">⁂</div>

[^5_1]: https://gist.github.com/rstacruz/946d02757525c9a0f49b25e316fbe715

[^5_2]: https://dev.to/einarcesar/does-opencode-support-hooks-a-complete-guide-to-extensibility-k3p

[^5_3]: https://opencode.ai/docs/plugins/

[^5_4]: https://opencode.ai/docs/troubleshooting/

[^5_5]: https://www.youtube.com/watch?v=Wu3G1QwM81M

[^5_6]: https://www.reddit.com/r/opencodeCLI/comments/1qssabi/the_definitive_guide_to_opencode_from_first/

[^5_7]: https://opencode.ai/docs/config/

[^5_8]: https://www.youtube.com/watch?v=WXffHkvfRpM

[^5_9]: https://opencode.ai/docs/ecosystem/


---

# Examples of tool.execute.before hook in action

The `tool.execute.before` hook intercepts tool calls right before execution, letting you inspect, modify args, log activity, or block dangerous operations.[^6_11]

It receives `{ tool, args }` and can return modified args or throw to cancel.[^6_12]

## Security Block Example

```typescript
export const SecurityPlugin: Plugin = async () => ({
  'tool.execute.before': async ({ tool, args }, { sessionID }) => {
    console.log(`[SECURITY] ${tool}(${JSON.stringify(args)})`)
    
    // Block .env reads
    if (tool === 'read' && args.filePath?.includes('.env')) {
      throw new Error('Cannot read sensitive files')
    }
    
    // Block destructive bash
    if (tool === 'bash' && args.command?.includes('rm -rf')) {
      throw new Error('Dangerous command blocked')
    }
    
    // Log large edits
    if (tool === 'write' && args.content?.length > 10000) {
      console.warn(`Large write (${args.content.length} chars) to ${args.filePath}`)
    }
    
    return args  // Continue with original args
  }
})
```

**Console output when agent tries `read .env`:**

```
[SECURITY] read({filePath: ".env"})
Error: Cannot read sensitive files
```


## Argument Modification Example

```typescript
export const SafeBash: Plugin = async () => ({
  'tool.execute.before': async ({ tool, args }) => {
    if (tool === 'bash') {
      const cmd = args.command as string
      // Add --dry-run to risky commands
      if (cmd.includes('git push') || cmd.includes('npm publish')) {
        args.command = cmd + ' --dry-run'
        console.log('Added --dry-run safety flag')
      }
    }
    return args
  }
})
```

**Before:** `git push origin main`
**After:** `git push origin main --dry-run`

## Logging \& Analytics Example

```typescript
export const ToolLogger: Plugin = async () => ({
  'tool.execute.before': async ({ tool, args }, ctx) => {
    const timestamp = new Date().toISOString()
    const usage = { tool, args: { ...args, content: args.content?.slice(0, 50) + '...' }, sessionID: ctx.sessionID }
    console.log(`[${timestamp}] TOOL:`, JSON.stringify(usage))
    
    // Could send to analytics service
    // await fetch('/api/track-tool', { method: 'POST', body: JSON.stringify(usage) })
    
    return args
  }
})
```

**Sample log:**

```
[2026-03-22T13:57:00Z] TOOL: {"tool":"edit","args":{"filePath":"src/index.ts","content":"export function hello() {...}"},"sessionID":"abc123"}
```


## Conditional Logic Example

```typescript
export const DevModePlugin: Plugin = async ({ $ }) => {
  const isDev = await $`cat .env`.text().then(t => t.includes('DEV=true'))
  
  return {
    'tool.execute.before': async ({ tool, args }) => {
      if (!isDev && (tool === 'bash' || tool === 'write')) {
        throw new Error('Tools disabled in production')
      }
      return args
    }
  }
}
```

These examples show blocking (`throw`), modifying (`return args`), and logging (side effects). Place in `.opencode/plugins/` and restart to test.[^6_11][^6_12]
<span style="display:none">[^6_1][^6_10][^6_2][^6_3][^6_4][^6_5][^6_6][^6_7][^6_8][^6_9]</span>

<div align="center">⁂</div>

[^6_1]: https://support.smartbear.com/testcomplete/docs/bdd/hooks.html

[^6_2]: https://github.com/webdriverio/webdriverio/issues/6119

[^6_3]: https://code.claude.com/docs/en/hooks-guide

[^6_4]: https://docs.qitasc.com/intactbasics/scenariohooks/

[^6_5]: https://stackoverflow.com/questions/71495785/call-before-hook-once-for-test-with-a-set-of-examples-in-cucumber

[^6_6]: https://docs.browser-use.com/open-source/customize/hooks

[^6_7]: https://www.kloia.com/blog/effective-use-of-hooks-in-cucumber

[^6_8]: https://toolset.com/documentation/programmer-reference/toolset-hooks/

[^6_9]: https://www.reddit.com/r/ExperiencedDevs/comments/144fcqo/what_are_your_precommit_hooks/

[^6_10]: https://testcafe.io/documentation/403435/guides/intermediate-guides/hooks

[^6_11]: https://opencode.ai/docs/plugins/

[^6_12]: https://gist.github.com/rstacruz/946d02757525c9a0f49b25e316fbe715


---

# How to add custom tools via plugins for agents

Custom tools in OpenCode plugins extend agent capabilities using the `tool()` helper from `@opencode-ai/plugin`.[^7_11]

Agents automatically discover and use these tools alongside built-ins like `read`, `write`, and `bash`.[^7_12]

## Basic Custom Tool

Create `.opencode/plugins/math-tools.ts`:

```typescript
import { tool } from '@opencode-ai/plugin'

export const MathTools: Plugin = async () => ({
  tool: {
    add: tool({
      description: 'Add two numbers reliably',
      args: {
        a: tool.schema.number().describe('First number'),
        b: tool.schema.number().describe('Second number')
      },
      async execute({ a, b }) {
        return { result: a + b, explanation: `${a} + ${b} = ${a + b}` }
      }
    }),
    
    isPrime: tool({
      description: 'Check if number is prime',
      args: { n: tool.schema.number().min(2) },
      async execute({ n }) {
        for (let i = 2; i * i <= n; i++) {
          if (n % i === 0) return { isPrime: false }
        }
        return { isPrime: true }
      }
    })
  }
})
```


## Agent Usage

After restart, ask:

```
@ "What's 23 + 47? Is 47 prime?"
```

**Agent response:**

```
23 + 47 = 70 (using add tool)
47 is prime ✓ (using isPrime tool)
```


## Advanced Tool with Context

```typescript
export const ProjectAnalyzer: Plugin = async ({ project, $ }) => ({
  tool: {
    analyzeProject: tool({
      description: 'Analyze project structure and dependencies',
      async execute() {
        const pkg = JSON.parse(await $`cat package.json`.text())
        const files = await $`find src -name "*.ts" -o -name "*.js"`.json()
        
        return {
          dependencies: Object.keys(pkg.dependencies || {}),
          fileCount: files.length,
          avgFileSize: files.reduce((sum, f) => sum + f.size, 0) / files.length
        }
      }
    })
  }
})
```


## External API Tool

```typescript
export const WeatherTool: Plugin = async () => ({
  tool: {
    getWeather: tool({
      description: 'Get current weather',
      args: { city: tool.schema.string() },
      async execute({ city }) {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true&current_weather_only=true`)
        const data = await res.json()
        return { 
          city, 
          temperature: `${data.current_weather.temperature}°C`,
          condition: data.current_weather.weathercode 
        }
      }
    })
  }
})
```


## Key Points

- **Schema validation**: `tool.schema.*` auto-validates args
- **Async execute**: Full async/await support with Bun `$` shell
- **Rich returns**: JSON objects become structured tool responses
- **Auto-discovery**: Filename prefixes tools (`math-tools_add`)
- **Context access**: `ctx` provides `project`, `client`, `sessionID`, `$`

Tools appear in agent tool lists automatically. Test by asking agent to use them explicitly.[^7_13][^7_11][^7_12]
<span style="display:none">[^7_1][^7_10][^7_2][^7_3][^7_4][^7_5][^7_6][^7_7][^7_8][^7_9]</span>

<div align="center">⁂</div>

[^7_1]: https://help.teamai.com/en/articles/9572018-built-in-and-custom-plugins-in-agents-custom-gpts

[^7_2]: https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-tools-custom-agent

[^7_3]: https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/tools/custom-tools

[^7_4]: https://www.youtube.com/watch?v=3eU9kA-qfmg

[^7_5]: https://learn.microsoft.com/en-us/microsoft-copilot-studio/advanced-plugin-actions

[^7_6]: https://www.youtube.com/watch?v=MRpExvcdxGs

[^7_7]: https://code.visualstudio.com/docs/copilot/agents/agent-tools

[^7_8]: https://www.youtube.com/watch?v=940EmjVuj2I

[^7_9]: https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-agent-custom-tool.html?context=wx

[^7_10]: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents

[^7_11]: https://opencode.ai/docs/plugins/

[^7_12]: https://opencode.ai/docs/custom-tools/

[^7_13]: https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a


---

# How agents decide which plugin tool to call

OpenCode agents decide which plugin tools to call through standard LLM function calling (tool use) mechanisms. The LLM receives all available tool definitions and semantically matches them against the user's intent.

## Decision Process

1. **Tool Discovery**: OpenCode collects all tools from loaded plugins (`.opencode/plugins/*.ts`) and built-ins (`read`, `write`, `bash`, etc.). Each tool provides:
    - Name (e.g., `smartCommit`)
    - Description ("Generate git commit message...")
    - JSON Schema for args (`{a: number, b: number}`)
2. **Prompt Injection**: Tool specs are injected into the LLM prompt alongside conversation history:

```
You have access to these tools:
- smartCommit: Generate git commit message from changed files
  Args: {files: string[] (optional)}

Use tools when needed by generating exact JSON calls.
```

3. **Semantic Matching**: LLM compares user input against tool descriptions:

```
User: "Help me commit my changes"
↓ LLM reasoning ↓
"smartCommit description matches 'commit' + 'changes' intent"
↓ Generates ↓
{"tool": "smartCommit", "args": {}}
```


## Key Factors Influencing Selection

| Factor | Impact |
| :-- | :-- |
| **Description quality** | Primary matching signal. "Add numbers" > "math tool" |
| **Arg schema match** | Rejects if user request can't fit schema |
| **Specificity** | "Weather for city" beats generic "API call" |
| **Context** | Recent file edits favor `smartCommit` over generic tools |

## Multiple Tool Selection

```
User: "What's 15+27? Also check if prime."
↓ Agent selects ↓
1. add(a=15, b=27) → {result: 42}
2. isPrime(n=42) → {isPrime: false}
↓ Synthesizes ↓
"15+27=42. 42 is not prime."
```


## Common Issues \& Fixes

- **Tool never called**: Weak description. Use action verbs: "Calculate sum" not "Math function"
- **Wrong tool chosen**: Overlapping descriptions. Add unique keywords
- **No tools used**: LLM can answer from context. Force with: "Always use tools for calculations"

The LLM predicts tool calls as next tokens, not through explicit if/else logic—quality descriptions = quality decisions.[^8_11][^8_12]
<span style="display:none">[^8_1][^8_10][^8_2][^8_3][^8_4][^8_5][^8_6][^8_7][^8_8][^8_9]</span>

<div align="center">⁂</div>

[^8_1]: https://netfoundry.io/ai/how-an-ai-agent-decides-to-call-mcp-tools/

[^8_2]: https://apxml.com/courses/intro-llm-agents/chapter-4-equipping-agents-with-tools/agent-tool-selection-logic

[^8_3]: https://www.youtube.com/watch?v=VZNdcbOpaIk

[^8_4]: https://dev.to/muskanfatim/do-agents-call-tools-every-time-heres-the-truth-and-how-to-control-it-6o6

[^8_5]: https://www.onesixsolutions.com/insights/agentic-ai-tool-calling/

[^8_6]: https://aiagentslist.com/blog/what-is-tool-calling

[^8_7]: https://spartner.software/kennisbank/ai-agents-tool-calling

[^8_8]: https://www.reddit.com/r/LangChain/comments/1je31zp/do_you_have_to_let_the_llm_choose_the_tools_to/

[^8_9]: https://www.linkedin.com/posts/pauliusztin_every-engineer-knows-tool-calling-is-what-activity-7394365996637171712-r0cs

[^8_10]: https://auth0.com/blog/genai-tool-calling-intro/

[^8_11]: https://opencode.ai/docs/plugins/

[^8_12]: https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a

