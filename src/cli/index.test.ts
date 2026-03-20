import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CLI } from './index.js'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const mocks = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue([]),
  getStats: vi.fn().mockResolvedValue({ recordCount: 0, sizeBytes: 0 }),
  insert: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  initialize: vi.fn().mockResolvedValue(undefined),
  encode: vi.fn().mockResolvedValue({ vector: new Array(768).fill(0) })
}))

vi.mock('../database/client.js', () => ({
  LanceDBClient: vi.fn().mockImplementation(() => ({
    initialize: mocks.initialize,
    query: mocks.query,
    getStats: mocks.getStats,
    insert: mocks.insert,
    close: mocks.close
  }))
}))

vi.mock('../embedding/embedding.js', () => ({
  createEmbeddingProvider: vi.fn().mockReturnValue({
    encode: mocks.encode
  })
}))

describe('CLI', () => {
  let cli: CLI
  let testDir: string

  beforeEach(async () => {
    vi.clearAllMocks()
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

  describe('add', () => {
    it('should add context record', async () => {
      await cli.init({})
      mocks.insert.mockClear()
      
      const result = await cli.add({ content: 'Test decision' })
      expect(result.id).toBeDefined()
      expect(mocks.insert).toHaveBeenCalled()
    })

    it('should add record with custom type', async () => {
      await cli.init({})
      mocks.insert.mockClear()
      
      await cli.add({ content: 'Test command', type: 'command' })
      expect(mocks.insert).toHaveBeenCalled()
      const inserted = mocks.insert.mock.calls[0][0]
      expect(inserted.contextType).toBe('command')
    })

    it('should add record with metadata', async () => {
      await cli.init({})
      mocks.insert.mockClear()
      
      await cli.add({ 
        content: 'Test', 
        metadata: '{"file":"test.ts"}' 
      })
      expect(mocks.insert).toHaveBeenCalled()
    })
  })

  describe('query', () => {
    it('should query context with text', async () => {
      await cli.init({})
      
      const results = await cli.query({ text: 'auth module', limit: 10 })
      expect(Array.isArray(results)).toBe(true)
      expect(mocks.query).toHaveBeenCalled()
    })

    it('should filter by context type', async () => {
      await cli.init({})
      
      const results = await cli.query({
        text: 'test',
        limit: 10,
        types: ['file_change', 'decision']
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
  })

  describe('import', () => {
    it('should import context from file', async () => {
      await cli.init({})
      
      const importPath = join(testDir, 'import.json')
      const importData = {
        exportedAt: new Date().toISOString(),
        project: testDir,
        recordCount: 1,
        records: [{
          id: 'test-id',
          vector: new Array(768).fill(0),
          projectId: 'test',
          contextType: 'file_change',
          content: 'test content',
          metadata: {},
          sessionId: 'session-1',
          createdAt: new Date().toISOString(),
          salience: 1.0
        }]
      }
      
      await writeFile(importPath, JSON.stringify(importData))
      await cli.import({ path: importPath })
      
      expect(mocks.insert).toHaveBeenCalled()
    })
  })

  describe('purge', () => {
    it('should require force flag', async () => {
      await cli.init({})
      
      await expect(cli.purge({})).rejects.toThrow('Purge requires --force')
    })

    it('should clear database with force', async () => {
      await cli.init({})
      
      await cli.purge({ force: true })
      expect(mocks.close).toHaveBeenCalled()
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
