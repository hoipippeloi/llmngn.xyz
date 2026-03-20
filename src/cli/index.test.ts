import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CLI } from './index.js'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('../database/client.js')
vi.mock('../embedding/embedding.js')

describe('CLI', () => {
  let cli: CLI
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `cli-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    cli = new CLI(testDir)
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('init', () => {
    it('should initialize plugin configuration', async () => {
      await cli.init({})
      
      const config = await cli.getConfig()
      expect(config.enabled).toBe(true)
    })

    it('should accept custom embedding model', async () => {
      await cli.init({ embeddingModel: 'text-embedding-3-small' })
      
      const config = await cli.getConfig()
      expect(config.embeddingModel).toBe('text-embedding-3-small')
    })
  })

  describe('query', () => {
    it('should query context with text', async () => {
      await cli.init({})
      
      const results = await cli.query({ text: 'auth module', limit: 10 })
      expect(Array.isArray(results)).toBe(true)
    })

    it('should filter by context type', async () => {
      await cli.init({})
      
      const results = await cli.query({
        text: 'test',
        limit: Number(10),
        types: ['file_change', 'decision'] as any
      })
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('history', () => {
    it('should show session history', async () => {
      await cli.init({})
      
      const history = await cli.history({ sessions: 5 })
      expect(Array.isArray(history)).toBe(true)
    })
  })

  describe('export', () => {
    it('should export context to file', async () => {
      await cli.init({})
      
      const outputPath = join(testDir, 'export.json')
      await cli.export({ output: outputPath })
      
    })

    it('should import context from file', async () => {
      await cli.init({})
      
      const importPath = join(testDir, 'import.json')
      await expect(cli.import({ path: importPath })).resolves.not.toThrow()
    })
  })

  describe('purge', () => {
    it('should clear database', async () => {
      await cli.init({})
      
      await cli.purge({ force: true })
    })
  })

  describe('stats', () => {
    it('should show database statistics', async () => {
      await cli.init({})
      
      const stats = await cli.stats()
      expect(stats).toHaveProperty('recordCount')
      expect(stats).toHaveProperty('sizeBytes')
    })
  })

  describe('config', () => {
    it('should set config value', async () => {
      await cli.init({})
      
      await cli.configSet('maxContextTokens', '8192')
      
      const config = await cli.getConfig()
      expect(config.maxContextTokens).toBe(8192)
    })

    it('should get config value', async () => {
      await cli.init({})
      await cli.configSet('retentionDays', '60')
      
      const value = await cli.configGet('retentionDays')
      expect(value).toBe(60)
    })

    it('should list all config values', async () => {
      await cli.init({})
      
      const config = await cli.configList()
      expect(config).toHaveProperty('enabled')
      expect(config).toHaveProperty('embeddingModel')
    })
  })
})