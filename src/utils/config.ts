import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { PluginConfig, ContextType } from '../types/index.js'

const DEFAULT_CONFIG: PluginConfig = {
  enabled: true,
  embeddingModel: 'nomic-embed-text',
  embeddingProvider: 'local',
  apiKey: undefined,
  lancedbPath: '.lancedb',
  maxContextTokens: 4096,
  queryLatencyMs: 500,
  salienceDecay: 0.95,
  retentionDays: 90,
  contextTypes: ['file_change', 'decision', 'debt', 'task', 'architecture', 'command'],
  weights: {
    file_change: 0.8,
    decision: 1.0,
    debt: 0.9,
    task: 0.7,
    architecture: 1.0,
    command: 0.5
  },
  filters: {
    excludePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.min.js',
      '**/.env*',
      '**/package-lock.json'
    ],
    sensitiveDataRedaction: true
  },
  llm: {
    enabled: false,
    provider: 'openai',
    model: 'gpt-4o-mini',
    extractionConfidenceThreshold: 0.7
  }
}

const CONFIG_FILE = 'llmngn.json'

export class ConfigManager {
  private projectDir: string
  private configPath: string

  constructor(projectDir: string) {
    this.projectDir = projectDir
    this.configPath = join(projectDir, '.opencode', 'plugins', CONFIG_FILE)
  }

  async load(): Promise<PluginConfig> {
    try {
      const content = await readFile(this.configPath, 'utf-8')
      const userConfig = JSON.parse(content)
      return this.mergeWithDefaults(userConfig)
    } catch {
      await this.ensureConfigDir()
      return { ...DEFAULT_CONFIG }
    }
  }

  async save(config: PluginConfig): Promise<void> {
    await this.ensureConfigDir()
    await writeFile(this.configPath, JSON.stringify(config, null, 2))
  }

  validate(config: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (typeof config !== 'object' || config === null) {
      return { valid: false, errors: ['Config must be an object'] }
    }

    const c = config as Record<string, unknown>

    if ('enabled' in c && typeof c.enabled !== 'boolean') {
      errors.push('enabled must be boolean')
    }

    if ('maxContextTokens' in c && (typeof c.maxContextTokens !== 'number' || c.maxContextTokens <= 0)) {
      errors.push('maxContextTokens must be a positive number')
    }

    if ('embeddingProvider' in c && c.embeddingProvider !== 'cloud' && c.embeddingProvider !== 'local') {
      errors.push('embeddingProvider must be "cloud" or "local"')
    }

    if ('salienceDecay' in c && (typeof c.salienceDecay !== 'number' || c.salienceDecay < 0 || c.salienceDecay > 1)) {
      errors.push('salienceDecay must be between 0 and 1')
    }

    if ('retentionDays' in c && (typeof c.retentionDays !== 'number' || c.retentionDays <= 0)) {
      errors.push('retentionDays must be a positive number')
    }

    if ('weights' in c && typeof c.weights === 'object') {
      const validTypes: ContextType[] = ['file_change', 'decision', 'debt', 'task', 'architecture', 'command']
      for (const [key, value] of Object.entries(c.weights as Record<string, unknown>)) {
        if (!validTypes.includes(key as ContextType)) {
          errors.push(`Invalid weight type: ${key}`)
        }
        if (typeof value !== 'number' || value < 0 || value > 1) {
          errors.push(`Weight for ${key} must be between 0 and 1`)
        }
      }
    }

    if ('llm' in c && typeof c.llm === 'object' && c.llm !== null) {
      const llm = c.llm as Record<string, unknown>
      if ('provider' in llm && !['openai', 'anthropic', 'ollama', 'local'].includes(llm.provider as string)) {
        errors.push('llm.provider must be openai, anthropic, ollama, or local')
      }
      if ('model' in llm && typeof llm.model !== 'string') {
        errors.push('llm.model must be a string')
      }
      if ('extractionConfidenceThreshold' in llm) {
        const threshold = llm.extractionConfidenceThreshold
        if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
          errors.push('llm.extractionConfidenceThreshold must be between 0 and 1')
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  getConfigPath(): string {
    return this.configPath
  }

  private mergeWithDefaults(userConfig: Partial<PluginConfig>): PluginConfig {
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      weights: {
        ...DEFAULT_CONFIG.weights,
        ...(userConfig.weights ?? {})
      },
      filters: {
        ...DEFAULT_CONFIG.filters,
        ...(userConfig.filters ?? {})
      },
      llm: {
        ...DEFAULT_CONFIG.llm,
        ...(userConfig.llm ?? {})
      }
    }
  }

  private async ensureConfigDir(): Promise<void> {
    const configDir = join(this.projectDir, '.opencode', 'plugins')
    await mkdir(configDir, { recursive: true })
  }
}
