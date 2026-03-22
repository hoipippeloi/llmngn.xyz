import type { Plugin } from "@opencode-ai/plugin"
import { readFile, mkdir, appendFile, writeFile } from "fs/promises"
import { join, basename } from "path"

const SCHEMA_VERSION = '1.0.0'
const VECTOR_SIZE = 768

const DB_FIELD = {
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

const EXPECTED_SCHEMA_FIELDS = Object.values(DB_FIELD)

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

const RETENTION_DAYS: Record<string, number> = {
  decision: 180,
  architecture: 365,
  debt: 90,
  file_change: 90,
  task: 60,
  command: 30
}

const DEFAULT_CONFIG = {
  enabled: true,
  embeddingModel: "nomic-embed-text",
  embeddingProvider: "local",
  lancedbPath: ".lancedb",
  maxContextTokens: 4096,
  salienceDecay: 0.95,
  retentionDays: 90,
  debug: true,
  contextTypes: ["file_change", "decision", "debt", "task", "architecture", "command"],
  weights: { file_change: 0.8, decision: 1, debt: 0.9, task: 0.7, architecture: 1, command: 0.5 },
  filters: {
    excludePatterns: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/build/**", "**/*.min.js", "**/.env*", "**/package-lock.json"],
    sensitiveDataRedaction: true
  },
  llm: {
    enabled: false,
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: undefined as string | undefined,
    endpoint: undefined as string | undefined,
    extractionConfidenceThreshold: 0.7
  }
}

interface ContextRecord {
  id: string
  vector: number[]
  projectId: string
  contextType: string
  content: string
  metadata: string
  sessionId: string
  createdAt: number
  expiresAt: number
  salience: number
}

interface DBRow {
  id: string
  vector: number[]
  [DB_FIELD.projectId]: string
  [DB_FIELD.contextType]: string
  [DB_FIELD.content]: string
  [DB_FIELD.metadata]: string
  [DB_FIELD.sessionId]: string
  [DB_FIELD.createdAt]: number
  [DB_FIELD.expiresAt]: number
  [DB_FIELD.salience]: number
}

interface ExtractionResult {
  decisions: Array<{ content: string; rationale?: string; confidence: number }>
  architecture: Array<{ content: string; description?: string; confidence: number }>
  technicalDebt: Array<{ issue: string; severity: 'low' | 'medium' | 'high' | 'critical'; reason: string; confidence: number }>
  tasks: Array<{ content: string; status: 'pending' | 'in_progress' | 'completed' | 'blocked'; confidence: number }>
  fileChanges: Array<{ summary: string; filePath?: string; changeType: 'create' | 'modify' | 'delete'; confidence: number }>
}

interface SessionData {
  sessionId: string
  startTime: string
  filesEdited: Array<{ filePath: string; changes: string }>
  commands: Array<{ command: string; exitCode: number; duration: number }>
  decisions: Array<{ content: string; rationale?: string }>
  tasks: Array<{ content: string; status: string }>
  errors: Array<{ error: string; context?: string }>
}

type LLMProviderType = 'openai' | 'anthropic' | 'ollama' | 'local'

interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

let globalDb: any = null
let globalConfig: typeof DEFAULT_CONFIG | null = null
let globalProjectId: string | null = null
let globalSessionId: string | null = null
let globalLLMProvider: LLMProviderType | null = null
let debugLogPath: string | null = null

async function debugLog(message: string, data?: any): Promise<void> {
  const timestamp = new Date().toISOString()
  const entry = `[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data, null, 2) : ''}\n`
  
  if (debugLogPath) {
    try {
      await appendFile(debugLogPath, entry)
    } catch {}
  }
}

async function loadConfig(directory: string): Promise<typeof DEFAULT_CONFIG> {
  const configPath = join(directory, ".opencode", "plugins", "llmngn.json")
  try {
    const content = await readFile(configPath, "utf-8")
    const userConfig = JSON.parse(content)
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      weights: { ...DEFAULT_CONFIG.weights, ...(userConfig.weights ?? {}) },
      filters: { ...DEFAULT_CONFIG.filters, ...(userConfig.filters ?? {}) },
      llm: { ...DEFAULT_CONFIG.llm, ...(userConfig.llm ?? {}) }
    }
  } catch {
    await mkdir(join(directory, ".opencode", "plugins"), { recursive: true })
    return { ...DEFAULT_CONFIG }
  }
}

function redactSensitive(content: string): string {
  if (!globalConfig?.filters.sensitiveDataRedaction) return content
  let redacted = content
  for (const pattern of REDACTION_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]")
  }
  return redacted
}

function shouldExclude(filePath: string): boolean {
  if (!globalConfig?.filters.excludePatterns) return false
  for (const pattern of globalConfig.filters.excludePatterns) {
    const regex = new RegExp(pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"))
    if (regex.test(filePath)) return true
  }
  return false
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function getExpiryMs(contextType: string): number {
  const days = RETENTION_DAYS[contextType] ?? globalConfig?.retentionDays ?? 90
  return days * 24 * 60 * 60 * 1000
}

async function initDatabase(dbPath: string, directory: string): Promise<any> {
  await debugLog("initDatabase: starting", { dbPath, directory })
  try {
    const lancedb = await import("@lancedb/lancedb")
    const fullPath = join(directory, dbPath)
    const dbInstance = await lancedb.connect(fullPath)
    await debugLog("initDatabase: connected", { fullPath })
    return dbInstance
  } catch (e) {
    await debugLog("initDatabase: FAILED", { error: String(e) })
    return null
  }
}

async function validateSchema(db: any): Promise<{ valid: boolean; message: string }> {
  try {
    const table = await db.openTable("llmngn_context")
    const schema = await table.schema()
    const dbFields = schema.fields.map((f: any) => f.name).sort()
    const expectedFields = [...EXPECTED_SCHEMA_FIELDS].sort() as string[]
    
    const missing = expectedFields.filter(f => !dbFields.includes(f))
    const unexpected = dbFields.filter((f: string) => !expectedFields.includes(f))
    
    if (missing.length === 0 && unexpected.length === 0) {
      return { valid: true, message: `Schema v${SCHEMA_VERSION} valid` }
    }
    
    let message = `Schema mismatch - missing: ${missing.join(', ')}`
    if (unexpected.length > 0) message += ` - unexpected: ${unexpected.join(', ')}`
    return { valid: false, message }
  } catch (e) {
    return { valid: true, message: 'New database - schema will be created' }
  }
}

async function insertRecord(db: any, record: ContextRecord): Promise<void> {
  const dbRow: DBRow = {
    id: record.id,
    vector: record.vector,
    [DB_FIELD.projectId]: record.projectId,
    [DB_FIELD.contextType]: record.contextType,
    [DB_FIELD.content]: record.content,
    [DB_FIELD.metadata]: record.metadata,
    [DB_FIELD.sessionId]: record.sessionId,
    [DB_FIELD.createdAt]: record.createdAt,
    [DB_FIELD.expiresAt]: record.expiresAt,
    [DB_FIELD.salience]: record.salience
  }
  
  try {
    const table = await db.openTable("llmngn_context")
    await table.add([dbRow])
    await debugLog("insertRecord: success", { id: record.id, type: record.contextType })
  } catch (e) {
    await debugLog("insertRecord: creating table", { error: String(e) })
    try {
      await db.createTable("llmngn_context", [
        {
          id: "init",
          vector: Array(VECTOR_SIZE).fill(0).map(() => Math.random() * 0.01),
          [DB_FIELD.projectId]: "init",
          [DB_FIELD.contextType]: "init",
          [DB_FIELD.content]: "init",
          [DB_FIELD.metadata]: "{}",
          [DB_FIELD.sessionId]: "init",
          [DB_FIELD.createdAt]: Date.now(),
          [DB_FIELD.expiresAt]: Date.now() + 86400000,
          [DB_FIELD.salience]: 1.0
        }
      ])
      const table2 = await db.openTable("llmngn_context")
      await table2.add([dbRow])
      await debugLog("insertRecord: success after create", { id: record.id })
    } catch (createErr) {
      await debugLog("insertRecord: FAILED", { error: String(createErr) })
    }
  }
}

async function queryRecords(db: any, limit: number, projectId: string): Promise<ContextRecord[]> {
  try {
    const table = await db.openTable("llmngn_context")
    const results = await table.query().limit(limit).toArray()
    return results
      .filter((r: any) => r.id !== 'init' && r.id !== '__init__')
      .filter((r: any) => r[DB_FIELD.projectId] === projectId)
      .map((r: any): ContextRecord => ({
        id: r.id,
        vector: r.vector,
        projectId: r[DB_FIELD.projectId],
        contextType: r[DB_FIELD.contextType],
        content: r[DB_FIELD.content],
        metadata: r[DB_FIELD.metadata],
        sessionId: r[DB_FIELD.sessionId],
        createdAt: r[DB_FIELD.createdAt],
        expiresAt: r[DB_FIELD.expiresAt],
        salience: r[DB_FIELD.salience]
      }))
  } catch (e) {
    await debugLog("queryRecords: FAILED", { error: String(e) })
    return []
  }
}

async function deleteExpired(db: any): Promise<void> {
  try {
    const table = await db.openTable("llmngn_context")
    const now = Date.now()
    await table.delete(`${DB_FIELD.expiresAt} < ${now}`)
  } catch {}
}

async function simpleEmbed(text: string): Promise<number[]> {
  const vector: number[] = []
  const words = text.toLowerCase().split(/\s+/).slice(0, 50)
  for (let i = 0; i < VECTOR_SIZE; i++) {
    let sum = 0
    for (const word of words) {
      const charCodes = word.split('').map(c => c.charCodeAt(0))
      sum += charCodes[i % charCodes.length] * (i + 1) / 1000
    }
    vector.push(Math.tanh(sum / Math.max(words.length, 1)))
  }
  return vector
}

async function persistContext(
  db: any,
  content: string,
  contextType: string,
  sessionId: string,
  projectId: string,
  metadata: Record<string, unknown> = {},
  salience?: number
): Promise<void> {
  if (!content || content.trim().length === 0) return
  
  const redacted = redactSensitive(content)
  const vector = await simpleEmbed(redacted)
  const now = Date.now()
  const weight = globalConfig?.weights[contextType as keyof typeof globalConfig.weights] ?? 0.5
  
  const record: ContextRecord = {
    id: generateId(),
    vector,
    projectId,
    contextType,
    content: redacted,
    metadata: JSON.stringify(metadata),
    sessionId,
    createdAt: now,
    expiresAt: now + getExpiryMs(contextType),
    salience: salience ?? weight
  }
  
  await insertRecord(db, record)
}

async function llmComplete(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<string> {
  const provider = globalConfig?.llm?.provider ?? 'openai'
  const model = globalConfig?.llm?.model ?? 'gpt-4o-mini'
  const apiKey = globalConfig?.llm?.apiKey

  if (provider === 'openai' || provider === 'local') {
    const endpoint = globalConfig?.llm?.endpoint ?? 'https://api.openai.com/v1/chat/completions'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey ?? ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 2048
      })
    })
    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`)
    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices[0]?.message?.content ?? ''
  }

  if (provider === 'anthropic') {
    const endpoint = globalConfig?.llm?.endpoint ?? 'https://api.anthropic.com/v1/messages'
    const systemMsg = messages.find(m => m.role === 'system')
    const otherMessages = messages.filter(m => m.role !== 'system')
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey ?? '',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        system: systemMsg?.content,
        messages: otherMessages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 2048
      })
    })
    if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`)
    const data = await response.json() as { content: Array<{ text: string }> }
    return data.content[0]?.text ?? ''
  }

  if (provider === 'ollama') {
    const baseUrl = globalConfig?.llm?.endpoint ?? 'http://localhost:11434'
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.3,
          num_predict: options?.maxTokens ?? 2048
        }
      })
    })
    if (!response.ok) throw new Error(`Ollama API error: ${response.status}`)
    const data = await response.json() as { message: { content: string } }
    return data.message?.content ?? ''
  }

  throw new Error(`Unsupported LLM provider: ${provider}`)
}

async function llmExtractStructured<T>(messages: LLMMessage[], schema: object, retries: number = 2): Promise<T> {
  const schemaStr = JSON.stringify(schema, null, 2)
  const threshold = globalConfig?.llm?.extractionConfidenceThreshold ?? 0.7
  
  const systemWithSchema = `You are a structured data extraction specialist. 
Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
${schemaStr}

Rules:
- Output must be valid JSON
- All required fields must be present
- Confidence scores must be between 0 and 1
- Only include items with confidence >= ${threshold}
- Use null for optional fields when not applicable`

  const extractionMessages: LLMMessage[] = [
    { role: 'system', content: systemWithSchema },
    ...messages.slice(-3)
  ]

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await llmComplete(extractionMessages, { temperature: 0.1, maxTokens: 4096 })
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim()
      return JSON.parse(cleaned) as T
    } catch (e) {
      if (attempt === retries) throw e
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  throw new Error('Unreachable')
}

type ExtractionContext = 'message' | 'error' | 'command_result' | 'file_diff' | 'session_summary'

const EXTRACTION_PROMPTS: Record<ExtractionContext, string> = {
  message: `You are a context extraction specialist for an AI coding assistant session.

Analyze the conversation/response and extract:

1. DECISIONS - Architectural choices, library selections, pattern decisions, "we will use X because Y", explicit decisions made
2. ARCHITECTURE - System design mentions, component relationships, data flow descriptions
3. TECHNICAL DEBT - Performance concerns, security issues, maintainability problems, code smells
4. TASKS - Explicit todo items, planned features, work to be done
5. FILE CHANGES - Any mentions of files being created/modified/deleted

Be specific and concise. Only extract items with confidence >= 0.7.`,

  error: `You are a technical debt analyst for an AI coding assistant.

Analyze this error and extract:
1. What specifically went wrong (the technical issue)
2. The likely root cause
3. Recommended fix approach
4. Severity: low/medium/high/critical

Return empty arrays for types not applicable.`,

  command_result: `You are a devops analyst for an AI coding assistant session.

Analyze this command execution and extract:
1. What the command accomplished
2. Any significant outputs or results
3. Whether it succeeded or failed
4. Any follow-up actions needed`,

  file_diff: `You are a code change analyst for an AI coding assistant session.

Analyze this file change and extract:
1. A concise summary of what changed (1-2 sentences)
2. The nature of change: feature/bugfix/refactor/chore/docs
3. Any notable patterns or concerns`,

  session_summary: `You are a session summarizer for an AI coding assistant.

Extract for long-term memory:
1. KEY DECISIONS - Major architectural choices
2. ARCHITECTURE - System design elements
3. TECHNICAL DEBT - Issues identified
4. TASKS - Work completed and remaining
5. FILE CHANGES - Summary of files modified

Focus on information valuable for future sessions.`
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          rationale: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['content', 'confidence']
      }
    },
    architecture: {
      type: 'array', 
      items: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          description: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['content', 'confidence']
      }
    },
    technicalDebt: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          issue: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          reason: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['issue', 'severity', 'reason', 'confidence']
      }
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'blocked'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['content', 'status', 'confidence']
      }
    },
    fileChanges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          filePath: { type: 'string' },
          changeType: { type: 'string', enum: ['create', 'modify', 'delete'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['summary', 'changeType', 'confidence']
      }
    }
  }
}

async function extractWithLLM(
  content: string,
  context: ExtractionContext
): Promise<ExtractionResult | null> {
  if (!globalConfig?.llm?.enabled || !content || content.length < 20) {
    return null
  }

  const prompt = EXTRACTION_PROMPTS[context]
  const messages: LLMMessage[] = [
    { role: 'system', content: prompt },
    { role: 'user', content: content.substring(0, 4000) }
  ]

  try {
    await debugLog(`extractWithLLM: calling LLM for ${context}`, { contentLength: content.length })
    const result = await llmExtractStructured<ExtractionResult>(messages, EXTRACTION_SCHEMA)
    await debugLog(`extractWithLLM: success`, { 
      decisions: result.decisions?.length ?? 0,
      architecture: result.architecture?.length ?? 0,
      debt: result.technicalDebt?.length ?? 0
    })
    return result
  } catch (e) {
    await debugLog(`extractWithLLM: failed`, { error: String(e), context })
    return null
  }
}

async function storeExtractedContext(
  db: any,
  extraction: ExtractionResult,
  sessionId: string,
  projectId: string
): Promise<void> {
  const threshold = globalConfig?.llm?.extractionConfidenceThreshold ?? 0.7

  for (const decision of extraction.decisions ?? []) {
    if (decision.confidence >= threshold) {
      await persistContext(
        db, decision.content, "decision",
        sessionId, projectId,
        { rationale: decision.rationale, confidence: decision.confidence },
        decision.confidence
      )
    }
  }

  for (const arch of extraction.architecture ?? []) {
    if (arch.confidence >= threshold) {
      await persistContext(
        db, arch.content, "architecture",
        sessionId, projectId,
        { description: arch.description, confidence: arch.confidence },
        arch.confidence
      )
    }
  }

  const severityWeight: Record<string, number> = { low: 0.5, medium: 0.7, high: 0.85, critical: 1.0 }
  for (const debt of extraction.technicalDebt ?? []) {
    if (debt.confidence >= threshold) {
      await persistContext(
        db, `${debt.issue} - ${debt.reason}`, "debt",
        sessionId, projectId,
        { severity: debt.severity, confidence: debt.confidence },
        severityWeight[debt.severity] * debt.confidence
      )
    }
  }

  for (const task of extraction.tasks ?? []) {
    if (task.confidence >= threshold) {
      await persistContext(
        db, task.content, "task",
        sessionId, projectId,
        { status: task.status, confidence: task.confidence },
        task.confidence
      )
    }
  }

  for (const change of extraction.fileChanges ?? []) {
    if (change.confidence >= threshold) {
      await persistContext(
        db, change.summary, "file_change",
        sessionId, projectId,
        { filePath: change.filePath, changeType: change.changeType, confidence: change.confidence },
        change.confidence * 0.8
      )
    }
  }
}

export default async ({ project, client, directory }: Parameters<Plugin>[0]) => {
  debugLogPath = join(directory, ".opencode", "plugins", "llmngn-debug.log")
  
  await writeFile(debugLogPath, `=== NEW SESSION ${new Date().toISOString()} ===\n`)
  await debugLog("Plugin initialized", { directory })

  globalConfig = await loadConfig(directory)
  await debugLog("Config loaded", { 
    enabled: globalConfig.enabled, 
    llmEnabled: globalConfig.llm.enabled,
    llmProvider: globalConfig.llm.provider 
  })

  if (!globalConfig.enabled) {
    return {
      "experimental.chat.system.transform": async (_input: any, output: any) => {
        output.system.push(`[LLMNGN] DISABLED by config`)
      }
    }
  }

  globalProjectId = basename(directory)

  try {
    globalDb = await initDatabase(globalConfig.lancedbPath, directory)

    if (!globalDb) {
      return {
        "experimental.chat.system.transform": async (_input: any, output: any) => {
          output.system.push(`[LLMNGN] LanceDB not available`)
        }
      }
    }

    const schemaCheck = await validateSchema(globalDb)
    if (!schemaCheck.valid) {
      await debugLog("Schema mismatch", { message: schemaCheck.message })
    }

    if (globalConfig.llm.enabled) {
      globalLLMProvider = globalConfig.llm.provider
      await debugLog("LLM extraction enabled", { provider: globalLLMProvider, model: globalConfig.llm.model })
    }

    await debugLog("Database initialized successfully")
  } catch (error) {
    await debugLog("Database init failed", { error: String(error) })
    return {
      "experimental.chat.system.transform": async (_input: any, output: any) => {
        output.system.push(`[LLMNGN] Init error: ${error}`)
      }
    }
  }

  const sessionData: SessionData = {
    sessionId: `session-${Date.now()}`,
    startTime: new Date().toISOString(),
    filesEdited: [],
    commands: [],
    decisions: [],
    tasks: [],
    errors: []
  }

  return {
    "experimental.chat.system.transform": async (_input: any, output: any) => {
      if (!globalDb || !globalProjectId || !globalSessionId) return

      try {
        const records = await queryRecords(globalDb, 100, globalProjectId)
        const now = Date.now()
        const validRecords = records.filter(r => !r.expiresAt || r.expiresAt > now)

        if (validRecords.length > 0) {
          const grouped: Record<string, ContextRecord[]> = {}
          for (const r of validRecords) {
            if (!grouped[r.contextType]) grouped[r.contextType] = []
            grouped[r.contextType].push(r)
          }

          output.system.push(`[LLMNGN - ${validRecords.length} records from prior sessions]:`)

          if (grouped["decision"]?.length) {
            output.system.push(`## Decisions (${grouped["decision"].length})`)
            grouped["decision"].slice(-5).reverse().forEach(d => output.system.push(`- ${d.content}`))
          }

          if (grouped["architecture"]?.length) {
            output.system.push(`## Architecture (${grouped["architecture"].length})`)
            grouped["architecture"].slice(-3).reverse().forEach(a => output.system.push(`- ${a.content}`))
          }

          if (grouped["debt"]?.length) {
            output.system.push(`## Technical Debt (${grouped["debt"].length})`)
            grouped["debt"].slice(-3).reverse().forEach(d => output.system.push(`- ${d.content}`))
          }

          if (grouped["task"]?.length) {
            output.system.push(`## Tasks (${grouped["task"].length})`)
            grouped["task"].slice(-5).reverse().forEach(t => output.system.push(`- ${t.content}`))
          }

          if (grouped["file_change"]?.length) {
            output.system.push(`## Recent Changes (${grouped["file_change"].length})`)
            grouped["file_change"].slice(-10).reverse().forEach(c => output.system.push(`- ${c.content}`))
          }

          if (grouped["command"]?.length) {
            output.system.push(`## Recent Commands (${grouped["command"].length})`)
            grouped["command"].slice(-5).reverse().forEach(c => output.system.push(`- ${c.content}`))
          }

          output.system.push(`---`)
        }
      } catch (error) {
        await debugLog("system.transform ERROR", { error: String(error) })
      }
    },

    "session.created": async (input: any) => {
      await debugLog("session.created", { sessionId: input?.session?.sessionId })
      if (input?.session?.sessionId) {
        globalSessionId = input.session.sessionId
        sessionData.sessionId = input.session.sessionId
      }
    },

    "session.idle": async () => {
      await debugLog("session.idle", { 
        files: sessionData.filesEdited.length,
        commands: sessionData.commands.length,
        decisions: sessionData.decisions.length,
        tasks: sessionData.tasks.length,
        errors: sessionData.errors.length
      })
      
      if (!globalDb || !globalProjectId || !globalSessionId) return

      try {
        if (globalConfig?.llm.enabled && (sessionData.decisions.length > 0 || sessionData.tasks.length > 0 || sessionData.errors.length > 0)) {
          const summary = [
            ...sessionData.decisions.map(d => `DECISION: ${d.content}${d.rationale ? ` - ${d.rationale}` : ''}`),
            ...sessionData.tasks.map(t => `TASK: ${t.content} [${t.status}]`),
            ...sessionData.errors.map(e => `ERROR: ${e.error}${e.context ? ` - ${e.context}` : ''}`)
          ].join('\n')

          const extraction = await extractWithLLM(summary, 'session_summary')
          if (extraction) {
            await storeExtractedContext(globalDb, extraction, globalSessionId, globalProjectId)
          }
        } else {
          for (const f of sessionData.filesEdited) {
            if (shouldExclude(f.filePath)) continue
            await persistContext(globalDb, f.changes, "file_change", globalSessionId, globalProjectId, { filePath: f.filePath })
          }

          for (const cmd of sessionData.commands) {
            await persistContext(globalDb, cmd.command, "command", globalSessionId, globalProjectId, { exitCode: cmd.exitCode, duration: cmd.duration })
          }

          for (const d of sessionData.decisions) {
            await persistContext(globalDb, d.content, "decision", globalSessionId, globalProjectId, { rationale: d.rationale })
          }

          for (const t of sessionData.tasks) {
            await persistContext(globalDb, t.content, "task", globalSessionId, globalProjectId, { status: t.status })
          }

          for (const e of sessionData.errors) {
            await persistContext(globalDb, e.error, "debt", globalSessionId, globalProjectId, { context: e.context })
          }
        }

        await deleteExpired(globalDb)
        await debugLog("session.idle: complete")
      } catch (error) {
        await debugLog("session.idle ERROR", { error: String(error) })
      }
    },

    "session.error": async (input: any) => {
      const errorMsg = input?.error?.message || input?.error || input?.message || "Unknown error"
      await debugLog("session.error", { error: errorMsg })
      
      if (!globalDb || !globalProjectId || !globalSessionId) return

      sessionData.errors.push({
        error: String(errorMsg),
        context: input?.stack
      })

      if (globalConfig?.llm.enabled) {
        const extraction = await extractWithLLM(errorMsg, 'error')
        if (extraction) {
          await storeExtractedContext(globalDb, extraction, globalSessionId, globalProjectId)
        }
      } else {
        await persistContext(globalDb, errorMsg, "debt", globalSessionId, globalProjectId, { stack: input?.stack }, 0.9)
      }
    },

    "file.edited": async (input: any) => {
      await debugLog("file.edited", { filePath: input?.filePath })
      
      if (!input?.filePath || !globalDb || !globalProjectId || !globalSessionId) return
      if (shouldExclude(input.filePath)) return

      const content = String(input.changes ?? `File modified: ${input.filePath}`)
      
      sessionData.filesEdited.push({ filePath: input.filePath, changes: content })

      if (globalConfig?.llm.enabled) {
        const extraction = await extractWithLLM(content, 'file_diff')
        if (extraction) {
          for (const change of extraction.fileChanges ?? []) {
            if (change.confidence >= (globalConfig.llm.extractionConfidenceThreshold ?? 0.7)) {
              await persistContext(
                globalDb, change.summary, "file_change",
                globalSessionId, globalProjectId,
                { filePath: input.filePath, changeType: change.changeType },
                change.confidence * 0.8
              )
            }
          }
        }
      }

      await persistContext(
        globalDb, content, "file_change",
        globalSessionId, globalProjectId,
        { filePath: input.filePath }
      )
    },

    "command.executed": async (input: any) => {
      await debugLog("command.executed", { command: input?.command?.substring(0, 50) })
      
      if (!input?.command || !globalDb || !globalProjectId || !globalSessionId) return

      const result = input.result as { exitCode?: number; duration?: number } | undefined

      sessionData.commands.push({
        command: input.command,
        exitCode: result?.exitCode ?? 0,
        duration: result?.duration ?? 0
      })

      await persistContext(
        globalDb, input.command, "command",
        globalSessionId, globalProjectId,
        { exitCode: result?.exitCode, duration: result?.duration }
      )
    },

    "message.updated": async (input: any) => {
      const message = input?.message
      await debugLog("message.updated", { 
        messageId: message?.id,
        role: message?.role,
        contentLength: message?.content?.length 
      })
      
      if (!globalDb || !globalProjectId || !globalSessionId || !client) return
      if (message?.role !== "assistant" || !message?.content) return

      if (globalConfig?.llm.enabled) {
        const extraction = await extractWithLLM(message.content, 'message')
        if (extraction) {
          await storeExtractedContext(globalDb, extraction, globalSessionId, globalProjectId)
        }
      }
    },

    "todo.updated": async (input: any) => {
      await debugLog("todo.updated", { todos: input?.todos?.length })
      
      if (!globalDb || !globalProjectId || !globalSessionId) return

      const todos = input?.todos || []
      for (const todo of todos) {
        if (todo.content) {
          sessionData.tasks.push({
            content: todo.content,
            status: todo.status || 'pending'
          })

          await persistContext(
            globalDb, todo.content, "task",
            globalSessionId, globalProjectId,
            { status: todo.status, priority: todo.priority }
          )
        }
      }
    },

    "tool.execute.after": async (input: any, output: any) => {
      const toolName = input?.tool
      await debugLog("tool.execute.after", { tool: toolName })
      
      if (!globalDb || !globalProjectId) return
      
      const effectiveSessionId = globalSessionId || `session-${Date.now()}`

      if (toolName === "bash") {
        const command = output?.args?.command || input?.args?.command
        if (command && !sessionData.commands.some(c => c.command === command)) {
          sessionData.commands.push({ command: String(command), exitCode: 0, duration: 0 })
          await persistContext(
            globalDb, String(command), "command",
            effectiveSessionId, globalProjectId,
            { tool: "bash" }
          )
        }
      }

      if (toolName === "write" || toolName === "edit") {
        const filePath = output?.args?.filePath || input?.args?.filePath
        if (filePath && !shouldExclude(filePath) && !sessionData.filesEdited.some(f => f.filePath === filePath)) {
          const changes = input?.changes || `File ${toolName === 'write' ? 'created' : 'edited'}`
          sessionData.filesEdited.push({ filePath, changes })
          await persistContext(
            globalDb, changes, "file_change",
            effectiveSessionId, globalProjectId,
            { filePath, changeType: toolName === 'write' ? 'create' : 'modify' }
          )
        }
      }
    },

    "experimental.session.compacting": async (input: any, output: any) => {
      await debugLog("session.compacting", { sessionId: input?.sessionId })
      
      if (!globalDb || !globalProjectId) return

      try {
        const records = await queryRecords(globalDb, 50, globalProjectId)
        const now = Date.now()
        const persistentRecords = records
          .filter(r => !r.expiresAt || r.expiresAt > now)
          .filter(r => ["decision", "architecture", "debt"].includes(r.contextType))

        if (persistentRecords.length > 0) {
          output.context.push(`## Persistent Context from LLMNGN`)
          
          const decisions = persistentRecords.filter(r => r.contextType === "decision")
          if (decisions.length > 0) {
            output.context.push(`### Key Decisions`)
            decisions.slice(-5).forEach(d => output.context.push(`- ${d.content}`))
          }

          const architecture = persistentRecords.filter(r => r.contextType === "architecture")
          if (architecture.length > 0) {
            output.context.push(`### Architecture Notes`)
            architecture.slice(-3).forEach(a => output.context.push(`- ${a.content}`))
          }

          const debt = persistentRecords.filter(r => r.contextType === "debt")
          if (debt.length > 0) {
            output.context.push(`### Technical Debt`)
            debt.slice(-3).forEach(d => output.context.push(`- ${d.content}`))
          }
        }
      } catch (error) {
        await debugLog("session.compacting ERROR", { error: String(error) })
      }
    },

    "event": async (input: any) => {
      const eventType = input?.event?.type
      const props = input?.event?.properties

      if (!eventType) return

      switch (eventType) {
        case "session.created": {
          const info = props?.info
          const sessionId = info?.id
          await debugLog("event:session.created", { sessionId })
          if (sessionId) {
            globalSessionId = sessionId
            sessionData.sessionId = sessionId
          }
          break
        }

        case "session.idle": {
          await debugLog("event:session.idle", {
            sessionId: props?.sessionID,
            files: sessionData.filesEdited.length,
            commands: sessionData.commands.length,
            decisions: sessionData.decisions.length,
            tasks: sessionData.tasks.length,
            errors: sessionData.errors.length
          })

          if (!globalDb || !globalProjectId || !globalSessionId) return

          try {
            if (globalConfig?.llm?.enabled && (sessionData.decisions.length > 0 || sessionData.tasks.length > 0 || sessionData.errors.length > 0)) {
              const summary = [
                ...sessionData.decisions.map(d => `DECISION: ${d.content}${d.rationale ? ` - ${d.rationale}` : ''}`),
                ...sessionData.tasks.map(t => `TASK: ${t.content} [${t.status}]`),
                ...sessionData.errors.map(e => `ERROR: ${e.error}${e.context ? ` - ${e.context}` : ''}`)
              ].join('\n')

              const extraction = await extractWithLLM(summary, 'session_summary')
              if (extraction) {
                await storeExtractedContext(globalDb, extraction, globalSessionId, globalProjectId)
              }
            } else {
              for (const f of sessionData.filesEdited) {
                if (shouldExclude(f.filePath)) continue
                await persistContext(globalDb, f.changes, "file_change", globalSessionId, globalProjectId, { filePath: f.filePath })
              }

              for (const cmd of sessionData.commands) {
                await persistContext(globalDb, cmd.command, "command", globalSessionId, globalProjectId, { exitCode: cmd.exitCode, duration: cmd.duration })
              }

              for (const d of sessionData.decisions) {
                await persistContext(globalDb, d.content, "decision", globalSessionId, globalProjectId, { rationale: d.rationale })
              }

              for (const t of sessionData.tasks) {
                await persistContext(globalDb, t.content, "task", globalSessionId, globalProjectId, { status: t.status })
              }

              for (const e of sessionData.errors) {
                await persistContext(globalDb, e.error, "debt", globalSessionId, globalProjectId, { context: e.context })
              }
            }

            await deleteExpired(globalDb)
            sessionData.filesEdited = []
            sessionData.commands = []
            sessionData.decisions = []
            sessionData.tasks = []
            sessionData.errors = []
            await debugLog("event:session.idle: complete")
          } catch (error) {
            await debugLog("event:session.idle ERROR", { error: String(error) })
          }
          break
        }

        case "session.error": {
          const errorMsg = props?.error?.message || props?.error || "Unknown error"
          await debugLog("event:session.error", { error: errorMsg })

          if (!globalDb || !globalProjectId) return

          sessionData.errors.push({
            error: String(errorMsg),
            context: props?.stack
          })

          const effectiveSessionId = globalSessionId || `session-${Date.now()}`

          if (globalConfig?.llm?.enabled) {
            const extraction = await extractWithLLM(String(errorMsg), 'error')
            if (extraction) {
              await storeExtractedContext(globalDb, extraction, effectiveSessionId, globalProjectId)
            }
          } else {
            await persistContext(globalDb, String(errorMsg), "debt", effectiveSessionId, globalProjectId, { stack: props?.stack }, 0.9)
          }
          break
        }

        case "message.updated": {
          const info = props?.info
          const role = info?.role
          const content = info?.content
          const messageId = info?.id
          await debugLog("event:message.updated", { messageId, role, contentLength: content?.length })

          if (!globalDb || !globalProjectId) return

          if (role === "assistant" && content && globalConfig?.llm?.enabled) {
            const effectiveSessionId = globalSessionId || `session-${Date.now()}`
            const extraction = await extractWithLLM(content, 'message')
            if (extraction) {
              await storeExtractedContext(globalDb, extraction, effectiveSessionId, globalProjectId)
            }
          }
          break
        }

        case "file.edited": {
          const filePath = props?.file || props?.filePath
          await debugLog("event:file.edited", { filePath })

          if (!filePath || !globalDb || !globalProjectId) return
          if (shouldExclude(filePath)) return

          const effectiveSessionId = globalSessionId || `session-${Date.now()}`
          const content = props?.changes || `File modified: ${filePath}`

          if (!sessionData.filesEdited.some(f => f.filePath === filePath)) {
            sessionData.filesEdited.push({ filePath, changes: content })
          }

          if (globalConfig?.llm?.enabled) {
            const extraction = await extractWithLLM(content, 'file_diff')
            if (extraction) {
              for (const change of extraction.fileChanges ?? []) {
                if (change.confidence >= (globalConfig.llm.extractionConfidenceThreshold ?? 0.7)) {
                  await persistContext(
                    globalDb, change.summary, "file_change",
                    effectiveSessionId, globalProjectId,
                    { filePath, changeType: change.changeType },
                    change.confidence * 0.8
                  )
                }
              }
            }
          }

          await persistContext(globalDb, content, "file_change", effectiveSessionId, globalProjectId, { filePath })
          break
        }

        case "file.watcher.updated": {
          const filePath = props?.file
          if (!filePath || shouldExclude(filePath)) return
          await debugLog("event:file.watcher.updated", { filePath, event: props?.event })
          break
        }

        case "command.executed": {
          const command = props?.command
          await debugLog("event:command.executed", { command: command?.substring(0, 50) })

          if (!command || !globalDb || !globalProjectId) return

          const effectiveSessionId = globalSessionId || `session-${Date.now()}`

          if (!sessionData.commands.some(c => c.command === command)) {
            sessionData.commands.push({ command, exitCode: props?.exitCode ?? 0, duration: props?.duration ?? 0 })
          }

          await persistContext(globalDb, command, "command", effectiveSessionId, globalProjectId, { exitCode: props?.exitCode, duration: props?.duration })
          break
        }

        case "todo.updated": {
          const todos = props?.todos || []
          await debugLog("event:todo.updated", { count: todos.length })

          if (!globalDb || !globalProjectId) return

          const effectiveSessionId = globalSessionId || `session-${Date.now()}`

          for (const todo of todos) {
            if (todo.content) {
              if (!sessionData.tasks.some(t => t.content === todo.content)) {
                sessionData.tasks.push({
                  content: todo.content,
                  status: todo.status || 'pending'
                })
              }

              await persistContext(
                globalDb, todo.content, "task",
                effectiveSessionId, globalProjectId,
                { status: todo.status, priority: todo.priority }
              )
            }
          }
          break
        }

        default:
          await debugLog(`event:${eventType}`, { hasProperties: !!props })
          break
      }
    }
  }
}
