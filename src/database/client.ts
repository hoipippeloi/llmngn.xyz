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
  private readonly tableName = 'codebase_context'

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  async initialize(): Promise<void> {
    this.db = await lancedb.connect(this.dbPath)
    
    const tableNames = await this.db.tableNames()
    
    if (!tableNames.includes(this.tableName)) {
      const initialData = [{
        id: '',
        vector: new Float32Array(768),
        project_id: '',
        context_type: 'file_change',
        content: '',
        metadata: '{}',
        session_id: '',
        created_at: Date.now(),
        expires_at: null as number | null,
        salience: 1.0
      }]
      
      this.table = await this.db.createTable(this.tableName, initialData)
      await this.table.delete('id = \'\'')
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

    const row: Record<string, unknown> = {
      id: record.id,
      vector: new Float32Array(record.vector),
      project_id: record.projectId,
      context_type: record.contextType,
      content: record.content,
      metadata: JSON.stringify(record.metadata),
      session_id: record.sessionId,
      created_at: new Date(record.createdAt).getTime(),
      expires_at: record.expiresAt ? new Date(record.expiresAt).getTime() : null,
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

    const query = this.table.vectorSearch(new Float32Array(queryVector))
      .limit(options.limit ?? 50)

    const results = await query.toArray()
    
    return results.map((row: unknown) => {
      const r = row as Record<string, unknown>
      return {
        id: r['id'] as string,
        vector: Array.from(r['vector'] as Float32Array),
        projectId: r['project_id'] as string,
        contextType: r['context_type'] as ContextType,
        content: r['content'] as string,
        metadata: JSON.parse(r['metadata'] as string),
        sessionId: r['session_id'] as string,
        createdAt: new Date(r['created_at'] as number).toISOString(),
        expiresAt: r['expires_at'] ? new Date(r['expires_at'] as number).toISOString() : undefined,
        salience: r['salience'] as number
      }
    })
  }

  async deleteExpired(): Promise<number> {
    if (!this.table) {
      throw new Error('Database not initialized')
    }

    const now = Date.now()
    const results = await this.table.query()
      .where(`expires_at IS NOT NULL AND expires_at < ${now}`)
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

    const count = await this.table.countRows()
    
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