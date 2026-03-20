# LLMNGN - Installation Guide

## Quick Install

```bash
# Clone or use as template
npx degit hoipippeloi/llmngn.xyz/.opencode .opencode

# Install dependencies
cd .opencode && bun install && cd ..
```

## Manual Installation

### 1. Create plugin directory

```bash
mkdir -p .opencode/plugins
```

### 2. Download plugin files

Download these files from [llmngn.xyz](https://github.com/hoipippeloi/llmngn.xyz):

- `.opencode/plugins/llmngn.ts` - Main plugin
- `.opencode/plugins/llmngn.json` - Configuration
- `.opencode/package.json` - Dependencies

### 3. Install dependencies

```bash
cd .opencode && bun install && cd ..
```

Or with npm:
```bash
cd .opencode && npm install && cd ..
```

### 4. Verify

Start OpenCode in the project directory. The plugin auto-loads.

## CLI Installation (Optional)

To use the `llmngn` CLI globally:

```bash
# From the repository
npm link

# Or install from npm (when published)
npm install -g llmngn
```

## Configuration

Edit `.opencode/plugins/llmngn.json`:

```json
{
  "enabled": true,
  "embeddingModel": "nomic-embed-text",
  "embeddingProvider": "local",
  "lancedbPath": ".lancedb",
  "maxContextTokens": 4096,
  "salienceDecay": 0.95,
  "retentionDays": 90,
  "contextTypes": [
    "file_change",
    "decision",
    "debt",
    "task",
    "architecture",
    "command"
  ],
  "weights": {
    "file_change": 0.8,
    "decision": 1,
    "debt": 0.9,
    "task": 0.7,
    "architecture": 1,
    "command": 0.5
  },
  "filters": {
    "excludePatterns": [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.min.js",
      "**/.env*",
      "**/package-lock.json"
    ],
    "sensitiveDataRedaction": true
  }
}
```

## Requirements

- Node.js 18+
- OpenCode CLI
- Bun (recommended) or npm

## Troubleshooting

### Plugin not loading

```bash
ls .opencode/node_modules/@lancedb
cd .opencode && bun install
```

### Reset all context

```bash
rm -rf .lancedb
```

## Support

- GitHub: https://github.com/hoipippeloi/llmngn.xyz/issues
