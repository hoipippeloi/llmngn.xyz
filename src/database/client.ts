import * as lancedb from '@lancedb/lancedb'
import type { ContextRecord, ContextType } from '../types/index.js'
import { SCHEMA_VERSION, SCHEMA_FIELDS, DB_FIELD_NAMES, toDBRow, fromDBRow } from './schema.js'

export { SCHEMA_VERSION, SCHEMA_FIELDS, DB_FIELD_NAMES, toDBRow, fromDBRow }

interface DBStats {
  recordCount: number
  sizeBytes: number
}

const VECTOR_SIZE = 768

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
    
    const initialRecord = {
      id: '__init__',
      vector: new Array(VECTOR_SIZE).fill(0).map(() => Math.random() * 0.01),
      [DB_FIELD_NAMES.projectId]: '',
      [DB_FIELD_NAMES.contextType]: 'file_change',
      [DB_FIELD_NAMES.content]: '',
      [DB_FIELD_NAMES.metadata]: '{}',
      [DB_FIELD_NAMES.sessionId]: '',
      [DB_FIELD_NAMES.createdAt]: Date.now(),
      [DB_FIELD_NAMES.expiresAt]: Date.now() + 365 * 24 * 60 * 60 * 1000,
      [DB_FIELD_NAMES.salience]: 1.0
    }
    
    if (!tableNames.includes(this.tableName)) {
      this.table = await this.db.createTable(this.tableName, [initialRecord])
    } else {
      this.table = await this.db.openTable(this.tableName)
    }
  }
  
  async validateSchema(): Promise<{ valid: boolean; message: string; fields?: string[] }> {
    if (!this.table) {
      return { valid: false, message: 'Database not initialized' }
    }
    
    try {
      const schema = await this.table.schema()
      const dbFields = schema.fields.map(f => f.name).sort()
      const expectedFields = [...SCHEMA_FIELDS].sort()
      
      const missing = expectedFields.filter((f: string) => !dbFields.includes(f))
      const unexpected = dbFields.filter((f: string) => !expectedFields.includes(f))
      
      if (missing.length === 0 && unexpected.length === 0) {
        return { valid: true, message: `Schema v${SCHEMA_VERSION} valid`, fields: dbFields }
      }
      
      let message = `Schema mismatch (expected v${SCHEMA_VERSION})`
      if (missing.length > 0) message += ` - missing: ${missing.join(', ')}`
      if (unexpected.length > 0) message += ` - unexpected: ${unexpected.join(', ')}`
      
      return { valid: false, message, fields: dbFields }
    } catch (e) {
      return { valid: false, message: `Schema validation error: ${e}` }
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

    const row = toDBRow({
      ...record,
      metadata: record.metadata as Record<string, unknown>
    })
    await this.table.add([row])
  }

  private mapRecord(r: Record<string, unknown>): ContextRecord {
    const mapped = fromDBRow(r)
    return {
      ...mapped,
      contextType: mapped.contextType as ContextType,
      metadata: mapped.metadata as ContextRecord['metadata']
    }
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
      .map((row: unknown) => this.mapRecord(row as Record<string, unknown>))
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
      .where(`${DB_FIELD_NAMES.expiresAt} < ${now}`)
      .toArray()
    
    if (results.length === 0) {
      return 0
    }

    const ids = results.map((row: unknown) => (row as Record<string, unknown>)['id'] as string)
    await this.table.delete(`id IN (${ids.map((id: string) => `'${id}'`).join(', ')})`)
    
    return ids.length
  }

  async getById(id: string): Promise<ContextRecord | null> {
    if (!this.table) {
      throw new Error('Database not initialized')
    }

    const results = await this.table.query()
      .where(`id = '${id}'`)
      .limit(1)
      .toArray()

    if (results.length === 0) {
      return null
    }

    const r = results[0] as Record<string, unknown>
    if (r['id'] === '__init__') return null

    return this.mapRecord(r)
  }

  async deleteById(id: string): Promise<boolean> {
    if (!this.table) {
      throw new Error('Database not initialized')
    }

    const record = await this.getById(id)
    if (!record) return false

    await this.table.delete(`id = '${id}'`)
    return true
  }

  async list(options: { limit?: number; type?: ContextType; sessionId?: string } = {}): Promise<ContextRecord[]> {
    if (!this.table) {
      throw new Error('Database not initialized')
    }

    const count = await this.table.countRows()
    if (count === 0 || (count === 1 && await this.hasOnlyInitRecord())) {
      return []
    }

    let query = this.table.query()

    if (options.type) {
      query = query.where(`${DB_FIELD_NAMES.contextType} = '${options.type}'`) as any
    }
    if (options.sessionId) {
      query = query.where(`${DB_FIELD_NAMES.sessionId} = '${options.sessionId}'`) as any
    }

    const results = await query.limit(options.limit ?? 100).toArray()

    return results
      .filter((row: unknown) => (row as Record<string, unknown>)['id'] !== '__init__')
      .map((row: unknown) => this.mapRecord(row as Record<string, unknown>))
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
