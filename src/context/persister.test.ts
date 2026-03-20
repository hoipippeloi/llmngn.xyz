import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContextPersister } from './persister.js'
import type { LanceDBClient } from '../database/client.js'
import type { EmbeddingProvider, SessionSummary, PluginConfig } from '../types/index.js'

describe('ContextPersister', () => {
  let persister: ContextPersister
  let mockDb: LanceDBClient
  let mockEmbedder: EmbeddingProvider
  let config: PluginConfig

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      getStats: vi.fn(),
      insert: vi.fn().mockResolvedValue(undefined),
      deleteExpired: vi.fn(),
      initialize: vi.fn(),
      close: vi.fn(),
      getTable: vi.fn()
    } as any

    mockEmbedder = {
      name: 'test',
      encode: vi.fn().mockResolvedValue({ vector: new Array(768).fill(0), model: 'test', tokens: 10 }),
      encodeBatch: vi.fn().mockResolvedValue([{ vector: new Array(768).fill(0), model: 'test', tokens: 10 }]),
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
        excludePatterns: ['**/node_modules/**', '**/.env*'],
        sensitiveDataRedaction: true
      }
    }

    persister = new ContextPersister(mockDb, mockEmbedder, config)
  })

  describe('persistSession', () => {
    it('should persist session summary to database', async () => {
      const summary: SessionSummary = {
        sessionId: 'session-1',
        projectPath: '/project',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        changes: [{
          filePath: '/src/test.ts',
          changeType: 'create',
          diffSummary: 'Created file',
          linesAdded: 10,
          linesRemoved: 0,
          relatedTasks: []
        }],
        decisions: [],
        tasks: [],
        commands: [],
        debt: []
      }

      await persister.persistSession(summary, 'test-project')

      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should redact sensitive data before persisting', () => {
      const sensitiveContent = 'API_KEY=sk-12345 password=secret123'
      
      const redacted = persister.redactSensitiveData(sensitiveContent)
      
      expect(redacted).not.toContain('sk-12345')
      expect(redacted).not.toContain('secret123')
      expect(redacted).toContain('[REDACTED]')
    })

    it('should apply exclude patterns to file changes', async () => {
      const summary: SessionSummary = {
        sessionId: 'session-1',
        projectPath: '/project',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        changes: [
          { filePath: '/src/app.ts', changeType: 'create', diffSummary: 'Created', linesAdded: 10, linesRemoved: 0, relatedTasks: [] },
          { filePath: '/project/node_modules/lib/index.js', changeType: 'create', diffSummary: 'Should exclude', linesAdded: 10, linesRemoved: 0, relatedTasks: [] }
        ],
        decisions: [],
        tasks: [],
        commands: [],
        debt: []
      }

      await persister.persistSession(summary, 'test-project')

      const insertCalls = vi.mocked(mockDb.insert).mock.calls
      const persistedPaths = insertCalls.map(call => (call[0] as any).metadata?.filePath).filter(Boolean)

      expect(persistedPaths).toContain('/src/app.ts')
      expect(persistedPaths).not.toContain('/project/node_modules/lib/index.js')
      expect(persistedPaths.length).toBe(1)
    })
  })

  describe('persistFileChange', () => {
    it('should persist file change with embedding', async () => {
      await persister.persistFileChange({
        filePath: '/src/test.ts',
        changeType: 'modify',
        diffSummary: 'Updated function',
        linesAdded: 5,
        linesRemoved: 2,
        relatedTasks: ['task-1']
      }, 'session-1', 'project-1')

      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('persistDecision', () => {
    it('should persist decision with high salience', async () => {
      await persister.persistDecision({
        decisionType: 'architecture',
        rationale: 'Need better scalability',
        alternatives: ['Option A', 'Option B'],
        stakeholders: ['team-lead']
      }, 'session-1', 'project-1')

      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('deduplication', () => {
    it('should detect and skip duplicate content', async () => {
      const content = 'This is repeated content'

      await persister.persistFileChange({
        filePath: '/src/test.ts',
        changeType: 'modify',
        diffSummary: content,
        linesAdded: 5,
        linesRemoved: 0,
        relatedTasks: []
      }, 'session-1', 'project-1')

      await persister.persistFileChange({
        filePath: '/src/test.ts',
        changeType: 'modify',
        diffSummary: content,
        linesAdded: 5,
        linesRemoved: 0,
        relatedTasks: []
      }, 'session-1', 'project-1')

      expect(mockDb.insert).toHaveBeenCalledTimes(1)
    })
  })
})
