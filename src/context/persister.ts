import { v4 as uuidv4 } from 'uuid'
import type { LanceDBClient } from '../database/client.js'
import type { 
  EmbeddingProvider, 
  SessionSummary, 
  PluginConfig, 
  ContextRecord,
  FileChangeMetadata,
  DecisionMetadata,
  ContextType
} from '../types/index.js'

const REDACTION_PATTERNS = [
  /API_KEY=\S+/gi,
  /api[_-]?key[:\s]*=\s*\S+/gi,
  /password[:\s]*=\s*\S+/gi,
  /secret[:\s]*=\s*\S+/gi,
  /Bearer\s+\S+/gi,
  /AWS_SECRET_ACCESS_KEY=\S+/gi,
  /token[:\s]*=\s*\S+/gi,
  /private[_-]?key[:\s]*=\s*\S+/gi
]

export class ContextPersister {
  private db: LanceDBClient
  private embedder: EmbeddingProvider
  private config: PluginConfig
  private recentHashes: Set<string> = new Set()

  constructor(db: LanceDBClient, embedder: EmbeddingProvider, config: PluginConfig) {
    this.db = db
    this.embedder = embedder
    this.config = config
  }

  async persistSession(summary: SessionSummary, projectId: string): Promise<void> {
    const tasks: Promise<void>[] = []

    for (const change of summary.changes) {
      if (this.shouldExclude(change.filePath)) continue
      tasks.push(this.persistFileChange(change, summary.sessionId, projectId))
    }

    for (const decision of summary.decisions) {
      tasks.push(this.persistDecision(decision, summary.sessionId, projectId))
    }

    for (const task of summary.tasks) {
      tasks.push(this.persistTask(task, summary.sessionId, projectId))
    }

    for (const cmd of summary.commands) {
      tasks.push(this.persistCommand(cmd, summary.sessionId, projectId))
    }

    for (const debt of summary.debt) {
      tasks.push(this.persistDebt(debt, summary.sessionId, projectId))
    }

    await Promise.all(tasks)
  }

  async persistFileChange(
    metadata: FileChangeMetadata, 
    sessionId: string, 
    projectId: string
  ): Promise<void> {
    const content = this.redactSensitiveData(metadata.diffSummary)
    const hash = this.hashContent(content + metadata.filePath)

    if (this.recentHashes.has(hash)) {
      return
    }
    this.recentHashes.add(hash)

    const embedding = await this.embedder.encode(content)
    const expiresAt = this.calculateExpiry('file_change')

    const record: ContextRecord = {
      id: uuidv4(),
      vector: embedding.vector,
      projectId,
      contextType: 'file_change',
      content,
      metadata,
      sessionId,
      createdAt: new Date().toISOString(),
      expiresAt,
      salience: 1.0
    }

    await this.db.insert(record)
  }

  async persistDecision(
    metadata: DecisionMetadata,
    sessionId: string,
    projectId: string
  ): Promise<void> {
    const content = this.redactSensitiveData(metadata.rationale)
    const embedding = await this.embedder.encode(content)
    const expiresAt = this.calculateExpiry('decision')

    const record: ContextRecord = {
      id: uuidv4(),
      vector: embedding.vector,
      projectId,
      contextType: 'decision',
      content,
      metadata,
      sessionId,
      createdAt: new Date().toISOString(),
      expiresAt,
      salience: 1.0
    }

    await this.db.insert(record)
  }

  async persistTask(
    metadata: any,
    sessionId: string,
    projectId: string
  ): Promise<void> {
    const content = metadata.blockedReason ?? `Task: ${metadata.taskId}`
    const embedding = await this.embedder.encode(content)
    const expiresAt = this.calculateExpiry('task')

    const record: ContextRecord = {
      id: uuidv4(),
      vector: embedding.vector,
      projectId,
      contextType: 'task',
      content,
      metadata,
      sessionId,
      createdAt: new Date().toISOString(),
      expiresAt,
      salience: 0.7
    }

    await this.db.insert(record)
  }

  async persistCommand(
    metadata: any,
    sessionId: string,
    projectId: string
  ): Promise<void> {
    const content = metadata.commandLine
    const embedding = await this.embedder.encode(content)
    const expiresAt = this.calculateExpiry('command')

    const record: ContextRecord = {
      id: uuidv4(),
      vector: embedding.vector,
      projectId,
      contextType: 'command',
      content,
      metadata,
      sessionId,
      createdAt: new Date().toISOString(),
      expiresAt,
      salience: 0.5
    }

    await this.db.insert(record)
  }

  async persistDebt(
    metadata: any,
    sessionId: string,
    projectId: string
  ): Promise<void> {
    const content = `Technical debt: ${metadata.debtType}`
    const embedding = await this.embedder.encode(content)

    const record: ContextRecord = {
      id: uuidv4(),
      vector: embedding.vector,
      projectId,
      contextType: 'debt',
      content,
      metadata,
      sessionId,
      createdAt: new Date().toISOString(),
      salience: 0.9
    }

    await this.db.insert(record)
  }

  redactSensitiveData(content: string): string {
    if (!this.config.filters.sensitiveDataRedaction) {
      return content
    }

    let redacted = content
    for (const pattern of REDACTION_PATTERNS) {
      redacted = redacted.replace(pattern, '[REDACTED]')
    }
    return redacted
  }

  hashContent(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(16)
  }

  private shouldExclude(filePath: string): boolean {
    for (const pattern of this.config.filters.excludePatterns) {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
      if (regex.test(filePath)) {
        return true
      }
    }
    return false
  }

  private calculateExpiry(contextType: ContextType): string {
    const retentionDays = this.getRetentionDays(contextType)
    const expiry = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
    return expiry.toISOString()
  }

  private getRetentionDays(contextType: ContextType): number {
    const defaultRetention = this.config.retentionDays
    const retentionMap: Partial<Record<ContextType, number>> = {
      decision: 180,
      architecture: 365,
      debt: defaultRetention,
      file_change: 90,
      task: 60,
      command: 30
    }
    return retentionMap[contextType] ?? defaultRetention
  }
}