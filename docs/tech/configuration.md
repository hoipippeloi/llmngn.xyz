# Configuration

Complete guide to configuring LLMNGN.

## Configuration File

Configuration is stored in `.opencode/plugins/llmngn.json`:

```json
{
  "enabled": true,
  "embeddingModel": "text-embedding-3-small",
  "embeddingProvider": "cloud",
  "lancedbPath": ".lancedb",
  "maxContextTokens": 4096,
  "queryLatencyMs": 100,
  "salienceDecay": 0.1,
  "retentionDays": 90,
  "contextTypes": [
    "decision",
    "architecture",
    "debt",
    "file_change",
    "task",
    "command"
  ],
  "weights": {
    "decision": 1.0,
    "architecture": 1.0,
    "debt": 0.9,
    "file_change": 0.8,
    "task": 0.7,
    "command": 0.5
  },
  "filters": {
    "excludePatterns": [
      "**/node_modules/**",
      "**/.env*",
      "**/dist/**",
      "**/.git/**"
    ],
    "sensitiveDataRedaction": true
  }
}
```

---

## Configuration Options

### Core Settings

#### `enabled`

| Type | Default |
|------|---------|
| boolean | `true` |

Enable or disable the plugin entirely.

```json
{
  "enabled": false
}
```

---

#### `embeddingProvider`

| Type | Options | Default |
|------|---------|---------|
| string | `"cloud"`, `"local"` | `"cloud"` |

Select the embedding provider.

- **cloud**: Uses OpenAI's embedding API (requires `OPENAI_API_KEY`)
- **local**: Uses local Ollama instance (no API key needed)

```json
{
  "embeddingProvider": "local"
}
```

---

#### `embeddingModel`

| Type | Default |
|------|---------|
| string | `"text-embedding-3-small"` |

The embedding model to use.

**Cloud options:**
- `text-embedding-3-small` - 1536 dimensions, fast, cheap
- `text-embedding-3-large` - 3072 dimensions, higher quality

**Local options (Ollama):**
- `nomic-embed-text` - 768 dimensions
- `mxbai-embed-large` - 1024 dimensions

```json
{
  "embeddingModel": "text-embedding-3-large"
}
```

---

#### `lancedbPath`

| Type | Default |
|------|---------|
| string | `".lancedb"` |

Path to the LanceDB database directory. Relative to project root.

```json
{
  "lancedbPath": ".data/lancedb"
}
```

---

### Context Retrieval

#### `maxContextTokens`

| Type | Default |
|------|---------|
| number | `4096` |

Maximum tokens of context to inject into the prompt.

```json
{
  "maxContextTokens": 8192
}
```

---

#### `queryLatencyMs`

| Type | Default |
|------|---------|
| number | `100` |

Target latency for context queries in milliseconds. Lower values may return fewer results.

```json
{
  "queryLatencyMs": 50
}
```

---

### Retention & Decay

#### `retentionDays`

| Type | Default |
|------|---------|
| number | `90` |

Default number of days before records expire. Can be overridden per context type.

```json
{
  "retentionDays": 180
}
```

---

#### `salienceDecay`

| Type | Default |
|------|---------|
| number | `0.1` |

Rate at which salience decays over time (0-1). Higher values mean faster decay.

```json
{
  "salienceDecay": 0.05
}
```

---

### Context Types

#### `contextTypes`

| Type | Default |
|------|---------|
| string[] | All types |

Which context types to capture. Remove types you don't want tracked.

```json
{
  "contextTypes": [
    "decision",
    "architecture",
    "file_change"
  ]
}
```

---

#### `weights`

| Type | Default |
|------|---------|
| object | See below |

Importance weights for each context type (0-1). Higher values prioritize the type in search results.

**Default weights:**

| Type | Weight |
|------|--------|
| decision | 1.0 |
| architecture | 1.0 |
| debt | 0.9 |
| file_change | 0.8 |
| task | 0.7 |
| command | 0.5 |

```json
{
  "weights": {
    "decision": 1.0,
    "command": 0.3
  }
}
```

---

### Filters

#### `filters.excludePatterns`

| Type | Default |
|------|---------|
| string[] | See below |

Glob patterns for files/directories to exclude from tracking.

**Default patterns:**
- `**/node_modules/**`
- `**/.env*`
- `**/dist/**`
- `**/.git/**`

```json
{
  "filters": {
    "excludePatterns": [
      "**/node_modules/**",
      "**/.env*",
      "**/secrets/**"
    ]
  }
}
```

---

#### `filters.sensitiveDataRedaction`

| Type | Default |
|------|---------|
| boolean | `true` |

Automatically redact sensitive data before storing. Patterns include:
- API keys (`sk-*`, `xoxb-*`, etc.)
- Passwords
- Tokens
- Private keys

```json
{
  "filters": {
    "sensitiveDataRedaction": false
  }
}
```

---

## Environment Variables

Override configuration with environment variables:

| Variable | Config Key |
|----------|------------|
| `LLMNGN_ENABLED` | enabled |
| `LLMNGN_DB_PATH` | lancedbPath |
| `LLMNGN_EMBEDDING_PROVIDER` | embeddingProvider |
| `LLMNGN_EMBEDDING_MODEL` | embeddingModel |
| `LLMNGN_MAX_TOKENS` | maxContextTokens |
| `LLMNGN_RETENTION_DAYS` | retentionDays |
| `OPENAI_API_KEY` | API key for cloud provider |

```bash
export LLMNGN_EMBEDDING_PROVIDER=local
export LLMNGN_RETENTION_DAYS=180
```

---

## Configuration Profiles

### Minimal Configuration

For lightweight tracking:

```json
{
  "enabled": true,
  "embeddingProvider": "local",
  "contextTypes": ["decision", "architecture"],
  "maxContextTokens": 2048
}
```

### Maximum Context

For comprehensive tracking:

```json
{
  "enabled": true,
  "embeddingProvider": "cloud",
  "embeddingModel": "text-embedding-3-large",
  "maxContextTokens": 8192,
  "retentionDays": 365,
  "salienceDecay": 0.05
}
```

### Performance Optimized

For fast queries:

```json
{
  "enabled": true,
  "embeddingProvider": "local",
  "queryLatencyMs": 50,
  "maxContextTokens": 2048,
  "contextTypes": ["decision", "debt"]
}
```

### Privacy Focused

No external API calls:

```json
{
  "enabled": true,
  "embeddingProvider": "local",
  "filters": {
    "sensitiveDataRedaction": true,
    "excludePatterns": [
      "**/node_modules/**",
      "**/.env*",
      "**/credentials/**",
      "**/secrets/**"
    ]
  }
}
```

---

## CLI Configuration

Manage settings via CLI:

```bash
# View all settings
llmngn config list

# Update a setting
llmngn config set retentionDays 180

# Reset to defaults
llmngn config reset
```

---

## Validation

The plugin validates configuration on startup:

- Invalid values fall back to defaults
- Warnings are logged for misconfigurations
- Required fields are checked before operations

```typescript
// Validation errors appear in logs
[llmngn] Warning: Invalid maxContextTokens (must be positive), using default: 4096
[llmngn] Warning: Unknown context type 'custom', ignoring
```
