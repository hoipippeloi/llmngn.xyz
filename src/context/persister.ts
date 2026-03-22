import { createHash } from 'crypto'
import type { LanceDBClient } from '../database/client.js'
import type { 
  EmbeddingProvider, 
  SessionSummary, 
  PluginConfig, 
  ContextRecord,
  FileChangeMetadata,
  DecisionMetadata,
  ContextType,
  CompletionMetadata
} from '../types/index.js'
import { SemanticExtractor, extractionResultToContextRecords } from './extractor.js'

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
  private extractor?: SemanticExtractor

  constructor(db: LanceDBClient, embedder: EmbeddingProvider, config: PluginConfig, extractor?: SemanticExtractor) {
    this.db = db
    this.embedder = embedder
    this.config = config
    this.extractor = extractor
  }

  setExtractor(extractor: SemanticExtractor): void {
    this.extractor = extractor
  }

  private generateId(content: string, contextType: ContextType): string {
    const hash = createHash('sha256')
    hash.update(content + contextType + Date.now().toString())
    return hash.digest('hex').slice(0, 24)
  }

  async persistSession(summary: SessionSummary, projectId: string): Promise<void> {
    const tasks: Promise<void>[] = []

    if (this.extractor) {
      const sessionText = this.sessionToText(summary)
      const extraction = await this.extractor.summarizeSession(sessionText)
      const contentHash = this.hashContent(sessionText)
      
      const extractedRecords = extractionResultToContextRecords(
        extraction,
        summary.sessionId,
        projectId,
        contentHash
      )
      
      for (const record of extractedRecords) {
        tasks.push(this.persistFromExtraction(record, summary.sessionId, projectId))
      }
    } else {
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
    }

    await Promise.all(tasks)
  }

  private sessionToText(summary: SessionSummary): string {
    const parts: string[] = []
    
    if (summary.changes.length > 0) {
      parts.push('FILE CHANGES:')
      for (const c of summary.changes) {
        parts.push(`- ${c.changeType} ${c.filePath}: ${c.diffSummary}`)
      }
    }
    
    if (summary.decisions.length > 0) {
      parts.push('DECISIONS:')
      for (const d of summary.decisions) {
        parts.push(`- ${d.decisionType}: ${d.rationale}`)
      }
    }
    
    if (summary.tasks.length > 0) {
      parts.push('TASKS:')
      for (const t of summary.tasks) {
        parts.push(`- [${t.status}] ${t.taskId}: ${t.blockedReason ?? ''}`)
      }
    }
    
    if (summary.commands.length > 0) {
      parts.push('COMMANDS:')
      for (const c of summary.commands) {
        parts.push(`- ${c.commandLine} (exit: ${c.exitCode})`)
      }
    }
    
    if (summary.debt.length > 0) {
      parts.push('TECHNICAL DEBT:')
      for (const d of summary.debt) {
        parts.push(`- ${d.debtType} (${d.severity}): ${d.estimatedEffort}`)
      }
    }
    
    return parts.join('\n')
  }

  private async persistFromExtraction(
    record: { type: ContextType; content: string; metadata: Record<string, unknown>; salience: number },
    sessionId: string,
    projectId: string
  ): Promise<void> {
    const content = this.redactSensitiveData(record.content)
    const embedding = await this.embedder.encode(content)
    const expiresAt = this.calculateExpiry(record.type)
    const id = this.generateId(content, record.type)

    const dbRecord: ContextRecord = {
      id,
      vector: embedding.vector,
      projectId,
      contextType: record.type,
      content,
      metadata: record.metadata,
      sessionId,
      createdAt: new Date().toISOString(),
      expiresAt,
      salience: record.salience
    }

    await this.db.insert(dbRecord)
  }

  async persistFromLLM(
    content: string,
    contextType: ContextType,
    sessionId: string,
    projectId: string,
    _metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.extractor) return

    const extraction = await this.extractor.extract(content, contextType as any)
    const contentHash = this.hashContent(content)
    const records = extractionResultToContextRecords(extraction, sessionId, projectId, contentHash)

    for (const record of records) {
      await this.persistFromExtraction(record, sessionId, projectId)
    }
  }

  async persistFileChange(
    metadata: FileChangeMetadata, 
    sessionId: string, 
    projectId: string
  ): Promise<void> {
    const content = this.redactSensitiveData(metadata.diffSummary)
    const embedding = await this.embedder.encode(content)
    const expiresAt = this.calculateExpiry('file_change')
    const id = this.generateId(content + metadata.filePath, 'file_change')

    const record: ContextRecord = {
      id,
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
    const id = this.generateId(content, 'decision')

    const record: ContextRecord = {
      id,
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
    const id = this.generateId(content, 'task')

    const record: ContextRecord = {
      id,
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
    const content = String(metadata.commandLine ?? '')
    const embedding = await this.embedder.encode(content)
    const expiresAt = this.calculateExpiry('command')
    const id = this.generateId(content, 'command')

    const record: ContextRecord = {
      id,
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
    const debtType = typeof metadata?.debtType === 'object' 
      ? JSON.stringify(metadata.debtType) 
      : String(metadata?.debtType ?? 'unknown')
    const severity = typeof metadata?.severity === 'object'
      ? JSON.stringify(metadata.severity)
      : String(metadata?.severity ?? 'medium')
    const content = `Technical debt [${severity}]: ${debtType}`
    const embedding = await this.embedder.encode(content)
    const id = this.generateId(content, 'debt')

    const record: ContextRecord = {
      id,
      vector: embedding.vector,
      projectId,
      contextType: 'debt',
      content,
      metadata: {
        debtType,
        severity,
        introducedIn: metadata?.introducedIn,
        estimatedEffort: metadata?.estimatedEffort,
        blockingRelease: metadata?.blockingRelease
      },
      sessionId,
      createdAt: new Date().toISOString(),
      salience: 0.9
    }

    await this.db.insert(record)
  }

  async persistCompletion(
    metadata: CompletionMetadata,
    sessionId: string,
    projectId: string
  ): Promise<void> {
    const content = `${metadata.action}: ${metadata.target}`
    const embedding = await this.embedder.encode(content)
    const expiresAt = this.calculateExpiry('completion')
    const id = this.generateId(content, 'completion')

    const record: ContextRecord = {
      id,
      vector: embedding.vector,
      projectId,
      contextType: 'completion',
      content,
      metadata,
      sessionId,
      createdAt: new Date().toISOString(),
      expiresAt,
      salience: 0.85
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
    return createHash('sha256').update(content).digest('hex').slice(0, 16)
  }

  private shouldExclude(filePath: string): boolean {
    for (const pattern of this.config.filters.excludePatterns) {
      let regexPattern = pattern
        .replace(/\*\*/g, '«DOUBLESTAR»')
        .replace(/\*/g, '[^/]*')
        .replace(/«DOUBLESTAR»/g, '.*')
      
      const regex = new RegExp(regexPattern, 'i')
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
      command: 30,
      completion: 60
    }
    return retentionMap[contextType] ?? defaultRetention
  }
}