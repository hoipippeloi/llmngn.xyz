import * as lancedb from '@lancedb/lancedb'
import type { ContextRecord, ContextType } from '../types/index.js'

interface DBStats {
  recordCount: number
  sizeBytes: number
}

export class LanceDBClient {
  private db: lancedb.Connection | null = null
  private table: lancedb.Table | null = null
  private readonly dbPath: string
  private readonly tableName = 'llmngn_context'

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  async initialize(): Promise<void> {
    this.db = await lancedb.connect(this.dbPath)
    
    const tableNames = await this.db.tableNames()
    
    // Create table with proper vector column - all fields must have non-null values for arrow infer
    const initialRecord = {
      id: '__init__',
      vector: new Array(768).fill(0).map(() => Math.random() * 0.01),
      project_id: '',
      context_type: 'file_change',
      content: '',
      metadata: '{}',
      session_id: '',
      created_at: Date.now(),
      expires_at: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year from now
      salience: 1.0
    }
    
    if (!tableNames.includes(this.tableName)) {
      this.table = await this.db.createTable(this.tableName, [initialRecord])
    } else {
      this.table = await this.db.openTable(this.tableName)
    }
  }

  async getTable(): Promise<lancedb.Table> {
    if (!this.table) {
      throw new Error('Database not initialized')
    }
    return this.table
  }

  async insert(record: ContextRecord): Promise<void> {
    if (!this.table) {
      throw new Error('Database not initialized')
    }

    const row = {
      id: record.id,
      vector: record.vector,
      project_id: record.projectId,
      context_type: record.contextType,
      content: record.content,
      metadata: JSON.stringify(record.metadata),
      session_id: record.sessionId,
      created_at: new Date(record.createdAt).getTime(),
      expires_at: record.expiresAt ? new Date(record.expiresAt).getTime() : Date.now() + 365 * 24 * 60 * 60 * 1000,
      salience: record.salience
    }

    await this.table.add([row])
  }

  async query(
    queryVector: number[],
    options: { limit?: number; projectId?: string; types?: ContextType[]; since?: string } = {}
  ): Promise<ContextRecord[]> {
    if (!this.table) {
      throw new Error('Database not initialized')
    }

    const count = await this.table.countRows()
    if (count === 0 || (count === 1 && await this.hasOnlyInitRecord())) {
      return []
    }

    const query = this.table.vectorSearch(new Float32Array(queryVector))
      .limit(options.limit ?? 50)

    const results = await query.toArray()
    
    return results
      .filter((row: unknown) => (row as Record<string, unknown>)['id'] !== '__init__')
      .map((row: unknown) => {
        const r = row as Record<string, unknown>
        const expiresAt = r['expires_at'] as number
        return {
          id: r['id'] as string,
          vector: r['vector'] as number[],
          projectId: r['project_id'] as string,
          contextType: r['context_type'] as ContextType,
          content: r['content'] as string,
          metadata: JSON.parse(r['metadata'] as string),
          sessionId: r['session_id'] as string,
          createdAt: new Date(r['created_at'] as number).toISOString(),
          expiresAt: expiresAt > Date.now() + 300 * 24 * 60 * 60 * 1000 ? undefined : new Date(expiresAt).toISOString(),
          salience: r['salience'] as number
        }
      })
  }

  private async hasOnlyInitRecord(): Promise<boolean> {
    if (!this.table) return true
    const results = await this.table.query().limit(1).toArray()
    return results.length === 1 && (results[0] as Record<string, unknown>)['id'] === '__init__'
  }

  async deleteExpired(): Promise<number> {
    if (!this.table) {
      throw new Error('Database not initialized')
    }

    const now = Date.now()
    const results = await this.table.query()
      .where(`expires_at < ${now}`)
      .toArray()
    
    if (results.length === 0) {
      return 0
    }

    const ids = results.map((row: unknown) => (row as Record<string, unknown>)['id'] as string)
    await this.table.delete(`id IN (${ids.map((id: string) => `'${id}'`).join(', ')})`)
    
    return ids.length
  }

  async getStats(): Promise<DBStats> {
    if (!this.table) {
      throw new Error('Database not initialized')
    }

    let count = await this.table.countRows()
    if (count > 0 && await this.hasOnlyInitRecord()) {
      count = 0
    }
    
    return {
      recordCount: count,
      sizeBytes: 0
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.table = null
      this.db = null
    }
  }
}