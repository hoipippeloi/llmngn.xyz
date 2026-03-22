export const SCHEMA_VERSION = '1.0.0'

export const DB_FIELD_NAMES = {
  id: 'id',
  vector: 'vector',
  projectId: 'project_id',
  contextType: 'context_type',
  content: 'content',
  metadata: 'metadata',
  sessionId: 'session_id',
  createdAt: 'created_at',
  expiresAt: 'expires_at',
  salience: 'salience'
} as const

export const SCHEMA_FIELDS: string[] = Object.values(DB_FIELD_NAMES)

export type DBFieldName = typeof DB_FIELD_NAMES[keyof typeof DB_FIELD_NAMES]

export interface DBRow extends Record<string, unknown> {
  id: string
  vector: number[]
  project_id: string
  context_type: string
  content: string
  metadata: string
  session_id: string
  created_at: number
  expires_at: number
  salience: number
}

export interface RecordInput {
  id: string
  vector: number[]
  projectId: string
  contextType: string
  content: string
  metadata: Record<string, unknown> | string
  sessionId: string
  createdAt: string | number
  expiresAt?: string | number
  salience: number
}

export function toDBRow(record: RecordInput): Record<string, unknown> {
  return {
    id: record.id,
    vector: record.vector,
    project_id: record.projectId,
    context_type: record.contextType,
    content: record.content,
    metadata: typeof record.metadata === 'string' ? record.metadata : JSON.stringify(record.metadata),
    session_id: record.sessionId,
    created_at: typeof record.createdAt === 'number' ? record.createdAt : new Date(record.createdAt).getTime(),
    expires_at: record.expiresAt 
      ? (typeof record.expiresAt === 'number' ? record.expiresAt : new Date(record.expiresAt).getTime())
      : Date.now() + 365 * 24 * 60 * 60 * 1000,
    salience: record.salience
  }
}

export function fromDBRow(row: Record<string, unknown>): {
  id: string
  vector: number[]
  projectId: string
  contextType: string
  content: string
  metadata: Record<string, unknown>
  sessionId: string
  createdAt: string
  expiresAt: string
  salience: number
} {
  const expiresAt = row[DB_FIELD_NAMES.expiresAt] as number | undefined
  const createdAtVal = row[DB_FIELD_NAMES.createdAt] as number | undefined
  
  let vector = row[DB_FIELD_NAMES.vector]
  if (vector && typeof vector === 'object' && !Array.isArray(vector)) {
    vector = Array.from(vector as unknown as Iterable<number>)
  }
  
  return {
    id: row[DB_FIELD_NAMES.id] as string,
    vector: vector as number[],
    projectId: row[DB_FIELD_NAMES.projectId] as string,
    contextType: row[DB_FIELD_NAMES.contextType] as string,
    content: row[DB_FIELD_NAMES.content] as string,
    metadata: JSON.parse(row[DB_FIELD_NAMES.metadata] as string || '{}'),
    sessionId: row[DB_FIELD_NAMES.sessionId] as string,
    createdAt: createdAtVal ? new Date(createdAtVal).toISOString() : new Date().toISOString(),
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    salience: (row[DB_FIELD_NAMES.salience] as number) ?? 1.0
  }
}
