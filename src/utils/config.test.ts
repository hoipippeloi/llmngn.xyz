import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ConfigManager } from './config.js'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { PluginConfig, ContextType } from '../types/index.js'

describe('ConfigManager', () => {
  let configManager: ConfigManager
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `llmngn-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    configManager = new ConfigManager(testDir)
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('load', () => {
    it('should load config from file', async () => {
      const config: Partial<PluginConfig> = {
        enabled: true,
        embeddingModel: 'test-model',
        embeddingProvider: 'local'
      }
      
      await mkdir(join(testDir, '.opencode', 'plugins'), { recursive: true })
      await writeFile(
        join(testDir, '.opencode', 'plugins', 'llmngn.json'),
        JSON.stringify(config)
      )

      const loaded = await configManager.load()

      expect(loaded.enabled).toBe(true)
      expect(loaded.embeddingModel).toBe('test-model')
    })

    it('should create default config if not exists', async () => {
      const loaded = await configManager.load()

      expect(loaded.enabled).toBe(true)
      expect(loaded.embeddingModel).toBe('nomic-embed-text')
      expect(loaded.maxContextTokens).toBe(4096)
    })

    it('should merge user config with defaults', async () => {
      await mkdir(join(testDir, '.opencode', 'plugins'), { recursive: true })
      await writeFile(
        join(testDir, '.opencode', 'plugins', 'llmngn.json'),
        JSON.stringify({ maxContextTokens: 8192 })
      )

      const loaded = await configManager.load()

      expect(loaded.maxContextTokens).toBe(8192)
      expect(loaded.embeddingModel).toBe('nomic-embed-text')
    })
  })

  describe('save', () => {
    it('should save config to file', async () => {
      const config: Partial<PluginConfig> = {
        enabled: false,
        embeddingModel: 'new-model'
      }

      await configManager.save(config as PluginConfig)

      const loaded = await configManager.load()
      expect(loaded.enabled).toBe(false)
      expect(loaded.embeddingModel).toBe('new-model')
    })
  })

  describe('validate', () => {
    it('should validate valid config', () => {
      const validConfig: PluginConfig = {
        enabled: true,
        embeddingModel: 'nomic-embed-text',
        embeddingProvider: 'local',
        lancedbPath: '.lancedb',
        maxContextTokens: 4096,
        queryLatencyMs: 500,
        salienceDecay: 0.95,
        retentionDays: 90,
        contextTypes: ['file_change'] as ContextType[],
        weights: { file_change: 0.8 } as Record<ContextType, number>,
        filters: { excludePatterns: [], sensitiveDataRedaction: true }
      }

      const result = configManager.validate(validConfig)
      expect(result.valid).toBe(true)
    })

    it('should reject invalid config', () => {
      const invalidConfig = {
        enabled: 'yes',
        maxContextTokens: -100
      }

      const result = configManager.validate(invalidConfig as any)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
