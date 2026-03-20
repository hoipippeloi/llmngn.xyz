import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { LanceDBClient } from './client.js'
import type { ContextRecord } from '../types/index.js'

describe('LanceDBClient', () => {
  let client: LanceDBClient
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `lancedb-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    client = new LanceDBClient(testDir)
  })

  afterEach(async () => {
    await client.close()
    await rm(testDir, { recursive: true, force: true })
  })

  describe('initialize', () => {
    it('should create database connection', async () => {
      await expect(client.initialize()).resolves.not.toThrow()
    })

    it('should create context table with correct schema', async () => {
      await client.initialize()
      const table = await client.getTable()
      expect(table).toBeDefined()
    })
  })

  describe('insert', () => {
    it('should insert a context record', async () => {
      await client.initialize()
      const record: ContextRecord = {
        id: 'test-id-1',
        vector: new Array(768).fill(0),
        projectId: 'test-project',
        contextType: 'file_change',
        content: 'Test content',
        metadata: {
          filePath: '/src/test.ts',
          changeType: 'create',
          diffSummary: 'Created new file',
          linesAdded: 10,
          linesRemoved: 0,
          relatedTasks: []
        },
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        salience: 1.0
      }

      await expect(client.insert(record)).resolves.not.toThrow()
    })

    it('should handle multiple inserts', async () => {
      await client.initialize()
      const record: ContextRecord = {
        id: 'test-id-dup',
        vector: new Array(768).fill(0),
        projectId: 'test-project',
        contextType: 'decision',
        content: 'Decision content',
        metadata: {
          decisionType: 'architecture',
          rationale: 'Test rationale',
          alternatives: [],
          stakeholders: []
        },
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        salience: 1.0
      }

      await client.insert(record)
      await expect(client.insert({ ...record, id: 'test-id-dup2' })).resolves.not.toThrow()
    })
  })

  describe('query', () => {
    beforeEach(async () => {
      await client.initialize()
    })

    it('should query by vector similarity', async () => {
      const queryVector = new Array(768).fill(0)
      const results = await client.query(queryVector, { limit: 10 })
      expect(Array.isArray(results)).toBe(true)
    })

    it('should return empty results for empty db', async () => {
      const queryVector = new Array(768).fill(0)
      const results = await client.query(queryVector, { limit: 10 })
      expect(results.length).toBe(0)
    })
  })

  describe('delete', () => {
    it('should delete records older than retention period', async () => {
      await client.initialize()
      const deleted = await client.deleteExpired()
      expect(typeof deleted).toBe('number')
    })
  })

  describe('stats', () => {
    it('should return database statistics', async () => {
      await client.initialize()
      const stats = await client.getStats()
      expect(stats).toHaveProperty('recordCount')
      expect(stats).toHaveProperty('sizeBytes')
    })
  })
})