import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ContextRetriever } from './retriever.js'
import type { LanceDBClient } from '../database/client.js'
import type { EmbeddingProvider, PluginConfig, ContextRecord } from '../types/index.js'

describe('ContextRetriever', () => {
  let retriever: ContextRetriever
  let mockDb: LanceDBClient
  let mockEmbedder: EmbeddingProvider
  let config: PluginConfig

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockResolvedValue([]),
      getStats: vi.fn(),
      insert: vi.fn(),
      deleteExpired: vi.fn(),
      initialize: vi.fn(),
      close: vi.fn(),
      getTable: vi.fn()
    } as any

    mockEmbedder = {
      name: 'test',
      encode: vi.fn().mockResolvedValue({ vector: new Array(768).fill(0), model: 'test', tokens: 10 }),
      encodeBatch: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true)
    }

    config = {
      enabled: true,
      embeddingModel: 'nomic-embed-text',
      embeddingProvider: 'local',
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
        excludePatterns: [],
        sensitiveDataRedaction: true
      }
    } as PluginConfig

    retriever = new ContextRetriever(mockDb, mockEmbedder, config)
  })

  describe('retrieve', () => {
    it('should retrieve relevant context for a query', async () => {
      const mockRecords: ContextRecord[] = [{
        id: '1',
        vector: new Array(768).fill(0),
        projectId: 'test-project',
        contextType: 'file_change',
        content: 'Created new auth module',
        metadata: {
          filePath: '/src/auth.ts',
          changeType: 'create',
          diffSummary: 'Added authentication',
          linesAdded: 100,
          linesRemoved: 0,
          relatedTasks: []
        },
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        salience: 1.0
      }]

      vi.mocked(mockDb.query).mockResolvedValue(mockRecords)

      const results = await retriever.retrieve('auth module', {
        projectId: 'test-project',
        limit: 10
      })

      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)
    })

    it('should apply weighting to results', async () => {
      vi.mocked(mockDb.query).mockResolvedValue([])

      await retriever.retrieve('test query', { projectId: 'test' })

      expect(mockDb.query).toHaveBeenCalled()
    })

    it('should truncate context to max tokens', async () => {
      const longRecords: ContextRecord[] = Array(100).fill(null).map((_, i) => ({
        id: `${i}`,
        vector: new Array(768).fill(0),
        projectId: 'test',
        contextType: 'decision' as const,
        content: 'A'.repeat(1000),
        metadata: {
          decisionType: 'architecture' as const,
          rationale: 'rationale',
          alternatives: [],
          stakeholders: []
        },
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        salience: 1.0
      }))

      vi.mocked(mockDb.query).mockResolvedValue(longRecords)

      const results = await retriever.retrieve('test', { projectId: 'test' })

      const totalTokens = results.reduce((sum, r) => sum + retriever.countTokens(r.record.content), 0)
      expect(totalTokens).toBeLessThanOrEqual(config.maxContextTokens)
    })

    it('should handle empty results gracefully', async () => {
      vi.mocked(mockDb.query).mockResolvedValue([])

      const results = await retriever.retrieve('nonexistent', { projectId: 'test' })

      expect(results).toEqual([])
    })
  })

  describe('calculateScore', () => {
    it('should calculate priority score correctly', () => {
      const record: ContextRecord = {
        id: '1',
        vector: new Array(768).fill(0.1),
        projectId: 'test',
        contextType: 'decision',
        content: 'test',
        metadata: { decisionType: 'architecture', rationale: '', alternatives: [], stakeholders: [] },
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        salience: 1.0
      }

      const score = retriever.calculateScore(record, new Array(768).fill(0), config.weights)

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })

    it('should apply recency decay', () => {
      const oldRecord: ContextRecord = {
        id: '1',
        vector: new Array(768).fill(0.1),
        projectId: 'test',
        contextType: 'decision',
        content: 'test',
        metadata: { decisionType: 'architecture', rationale: '', alternatives: [], stakeholders: [] },
        sessionId: 'session-1',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        salience: 1.0
      }

      const recentRecord: ContextRecord = {
        ...oldRecord,
        id: '2',
        createdAt: new Date().toISOString()
      }

      const oldScore = retriever.calculateScore(oldRecord, new Array(768).fill(0), config.weights)
      const recentScore = retriever.calculateScore(recentRecord, new Array(768).fill(0), config.weights)

      expect(recentScore).toBeGreaterThan(oldScore)
    })
  })

  describe('countTokens', () => {
    it('should count tokens approximately', () => {
      const text = 'This is a test sentence with multiple words'
      const tokens = retriever.countTokens(text)
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(text.length)
    })
  })
})