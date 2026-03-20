import type { Plugin } from "@opencode-ai/plugin"
import { readFile, mkdir, appendFile, writeFile } from "fs/promises"
import { join, basename } from "path"

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

interface SessionData {
  sessionId: string
  startTime: string
  filesEdited: Array<{ filePath: string; changes: string }>
  commands: Array<{ command: string; exitCode: number; duration: number }>
}

let globalDb: any = null
let globalConfig: typeof DEFAULT_CONFIG | null = null
let globalProjectId: string | null = null
let debugLogPath: string | null = null
let hookCalls: string[] = []

async function debugLog(message: string, data?: any): Promise<void> {
  const timestamp = new Date().toISOString()
  const entry = `[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`
  hookCalls.push(entry)
  
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
      filters: { ...DEFAULT_CONFIG.filters, ...(userConfig.filters ?? {}) }
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

function getExpiry(contextType: string): string {
  const retentionDays: Record<string, number> = {
    decision: 180,
    architecture: 365,
    debt: globalConfig?.retentionDays ?? 90,
    file_change: 90,
    task: 60,
    command: 30
  }
  const days = retentionDays[contextType] ?? globalConfig?.retentionDays ?? 90
  const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  return expiry.toISOString()
}

async function initDatabase(dbPath: string, directory: string): Promise<any> {
  await debugLog("initDatabase: starting", { dbPath, directory })
  try {
    const lancedb = await import("@lancedb/lancedb")
    await debugLog("initDatabase: lancedb imported successfully")
    const fullPath = join(directory, dbPath)
    const dbInstance = await lancedb.connect(fullPath)
    await debugLog("initDatabase: connected successfully", { fullPath })
    return dbInstance
  } catch (e) {
    await debugLog("initDatabase: FAILED", { error: String(e), stack: (e as Error).stack })
    return null
  }
}

async function insertRecord(db: any, record: ContextRecord): Promise<void> {
  try {
    const table = await db.openTable("llmngn_context")
    await table.add([record])
    await debugLog("insertRecord: added to existing table", { id: record.id, type: record.contextType })
  } catch (e) {
    await debugLog("insertRecord: openTable failed, trying createTable", { error: String(e) })
    try {
      await db.createTable("llmngn_context", [
        {
          id: "init",
          vector: Array(128).fill(0),
          projectId: "init",
          contextType: "init",
          content: "init",
          metadata: "{}",
          sessionId: "init",
          createdAt: Date.now(),
          expiresAt: Date.now() + 86400000,
          salience: 1.0
        }
      ])
      await debugLog("insertRecord: created new table, now adding record")
      const table2 = await db.openTable("llmngn_context")
      await table2.add([record])
      await debugLog("insertRecord: added to new table", { id: record.id, type: record.contextType })
    } catch (createErr) {
      await debugLog("insertRecord: FAILED", { error: String(createErr) })
    }
  }
}

async function queryRecords(db: any, limit: number, projectId: string): Promise<ContextRecord[]> {
  await debugLog("queryRecords: starting", { limit, projectId })
  try {
    const table = await db.openTable("llmngn_context")
    const results = await table.query().limit(limit).toArray()
    await debugLog("queryRecords: got results", { totalResults: results.length })
    const filtered = results.filter((r: any) => r.projectId === projectId)
    await debugLog("queryRecords: filtered by projectId", { filteredCount: filtered.length, searchProjectId: projectId })
    return filtered
  } catch (e) {
    await debugLog("queryRecords: FAILED", { error: String(e) })
    return []
  }
}

async function deleteExpired(db: any): Promise<void> {
  try {
    const table = await db.openTable("llmngn_context")
    const now = new Date().toISOString()
    await table.delete(`expiresAt < '${now}'`)
  } catch {}
}

async function simpleEmbed(text: string): Promise<number[]> {
  const vector: number[] = []
  const words = text.toLowerCase().split(/\s+/).slice(0, 50)
  for (let i = 0; i < 128; i++) {
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
  salience: number = 1.0
): Promise<void> {
  const redacted = redactSensitive(content)
  const vector = await simpleEmbed(redacted)
  const now = Date.now()
  const record = {
    id: generateId(),
    vector,
    projectId,
    contextType,
    content: redacted,
    metadata: JSON.stringify(metadata),
    sessionId,
    createdAt: now,
    expiresAt: now + (90 * 24 * 60 * 60 * 1000),
    salience
  }
  await insertRecord(db, record)
}

export default async ({ project, client, directory }: Parameters<Plugin>[0]) => {
  hookCalls = []
  debugLogPath = join(directory, ".opencode", "plugins", "llmngn-debug.log")
  
  await writeFile(debugLogPath, `=== NEW SESSION ${new Date().toISOString()} ===\n`)
  await debugLog("Plugin initialized", { directory })

  globalConfig = await loadConfig(directory)
  await debugLog("Config loaded", { enabled: globalConfig.enabled, lancedbPath: globalConfig.lancedbPath })

  if (!globalConfig.enabled) {
    await debugLog("Plugin DISABLED by config")
    return {
      "experimental.chat.system.transform": async (_input: any, output: any) => {
        output.system.push(`[LLMNGN] DISABLED by config`)
      }
    }
  }

  globalProjectId = basename(directory)
  await debugLog("ProjectId generated", { globalProjectId, directory })

  try {
    globalDb = await initDatabase(globalConfig.lancedbPath, directory)
    await debugLog("Database init result", { dbNull: globalDb === null, dbType: typeof globalDb })

    if (!globalDb) {
      await debugLog("Database FAILED to initialize - returning empty hooks")
      return {
        "experimental.chat.system.transform": async (_input: any, output: any) => {
          output.system.push(`[LLMNGN] LanceDB not available - check debug log at .opencode/plugins/llmngn-debug.log`)
        }
      }
    }

    await debugLog("Database initialized successfully")
  } catch (error) {
    await debugLog("Database init threw exception", { error: String(error), stack: (error as Error).stack })
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
  }

  return {
    "experimental.chat.system.transform": async (_input: any, output: any) => {
      await debugLog("experimental.chat.system.transform: FIRED")

      if (!globalDb || !globalProjectId) {
        await debugLog("experimental.chat.system.transform: early return", { dbNull: globalDb === null, projectIdNull: globalProjectId === null })
        return
      }

      try {
        const records = await queryRecords(globalDb, 50, globalProjectId)
        const now = Date.now()
        const results = records.filter(r => {
          if (r.expiresAt && r.expiresAt < now) return false
          return true
        })

        await debugLog("experimental.chat.system.transform: query results", { recordsCount: records.length, validCount: results.length })

        if (results.length > 0) {
          const grouped: Record<string, string[]> = {}

          for (const r of results) {
            const type = r.contextType
            if (!grouped[type]) grouped[type] = []
            grouped[type].push(r.content)
          }

          output.system.push(`[LLMNGN - ${results.length} records from prior sessions]:`)

          if (grouped["decision"]?.length) {
            output.system.push(`## Decisions (${grouped["decision"].length})`)
            grouped["decision"].slice(0, 5).forEach(d => output.system.push(`- ${d}`))
          }

          if (grouped["architecture"]?.length) {
            output.system.push(`## Architecture (${grouped["architecture"].length})`)
            grouped["architecture"].slice(0, 5).forEach(a => output.system.push(`- ${a}`))
          }

          if (grouped["file_change"]?.length) {
            output.system.push(`## Recent Changes (${grouped["file_change"].length})`)
            grouped["file_change"].slice(0, 10).forEach(c => output.system.push(`- ${c}`))
          }

          if (grouped["command"]?.length) {
            output.system.push(`## Recent Commands (${grouped["command"].length})`)
            grouped["command"].slice(0, 10).forEach(c => output.system.push(`- ${c}`))
          }

          output.system.push(`---`)
        }
      } catch (error) {
        await debugLog("experimental.chat.system.transform: ERROR", { error: String(error) })
        output.system.push(`[LLMNGN] Error: ${error}`)
      }
    },

    "session.created": async (input: any) => {
      await debugLog("session.created: FIRED", { input })
      if (input.session?.sessionId) {
        sessionData.sessionId = input.session.sessionId
      }
      await debugLog("session.created: sessionId set", { sessionId: sessionData.sessionId })
    },

    "session.idle": async () => {
      await debugLog("session.idle: FIRED", { filesCount: sessionData.filesEdited.length, commandsCount: sessionData.commands.length })
      if (!globalDb || !globalProjectId) {
        await debugLog("session.idle: early return - no db/projectId")
        return
      }

      try {
        for (const f of sessionData.filesEdited) {
          if (shouldExclude(f.filePath)) continue

          await persistContext(
            globalDb,
            f.changes,
            "file_change",
            sessionData.sessionId,
            globalProjectId,
            { filePath: f.filePath },
            globalConfig?.weights.file_change ?? 0.8
          )
        }

        for (const cmd of sessionData.commands) {
          await persistContext(
            globalDb,
            cmd.command,
            "command",
            sessionData.sessionId,
            globalProjectId,
            { exitCode: cmd.exitCode, duration: cmd.duration },
            globalConfig?.weights.command ?? 0.5
          )
        }

        await deleteExpired(globalDb)
        await debugLog("session.idle: persisted successfully", { files: sessionData.filesEdited.length, commands: sessionData.commands.length })
      } catch (error) {
        await debugLog("session.idle: ERROR", { error: String(error) })
      }
    },

    "file.edited": async (input: any) => {
      await debugLog("file.edited: FIRED", { filePath: input.filePath, hasDb: !!globalDb, hasProjectId: !!globalProjectId })
      if (!input.filePath || !globalDb || !globalProjectId) {
        await debugLog("file.edited: early return", { filePath: input.filePath, dbNull: globalDb === null, projectIdNull: globalProjectId === null })
        return
      }
      if (shouldExclude(input.filePath)) {
        await debugLog("file.edited: excluded by pattern", { filePath: input.filePath })
        return
      }

      try {
        sessionData.filesEdited.push({
          filePath: input.filePath,
          changes: String(input.changes ?? "File modified"),
        })

        await persistContext(
          globalDb,
          String(input.changes ?? "File modified"),
          "file_change",
          sessionData.sessionId,
          globalProjectId,
          { filePath: input.filePath },
          globalConfig?.weights.file_change ?? 0.8
        )

        await debugLog("file.edited: recorded", { filePath: input.filePath })
      } catch (error) {
        await debugLog("file.edited: ERROR", { error: String(error) })
      }
    },

    "command.executed": async (input: any) => {
      await debugLog("command.executed: FIRED", { command: input.command, hasDb: !!globalDb, hasProjectId: !!globalProjectId })
      if (!input.command || !globalDb || !globalProjectId) {
        await debugLog("command.executed: early return")
        return
      }

      try {
        const result = input.result as { exitCode?: number; duration?: number } | undefined

        sessionData.commands.push({
          command: input.command,
          exitCode: result?.exitCode ?? 0,
          duration: result?.duration ?? 0,
        })

        await persistContext(
          globalDb,
          input.command,
          "command",
          sessionData.sessionId,
          globalProjectId,
          { exitCode: result?.exitCode ?? 0, duration: result?.duration ?? 0 },
          globalConfig?.weights.command ?? 0.5
        )

        await debugLog("command.executed: recorded", { command: input.command })
      } catch (error) {
        await debugLog("command.executed: ERROR", { error: String(error) })
      }
    },

    "tool.execute.after": async (input: any, output: any) => {
      await debugLog("tool.execute.after: FIRED", { tool: input?.tool, outputType: typeof output })
      
      if (!globalDb || !globalProjectId) {
        await debugLog("tool.execute.after: no db/projectId")
        return
      }

      const toolName = input?.tool
      
      if (toolName === "bash") {
        const command = output?.args?.command || input?.args?.command || "unknown command"
        await debugLog("tool.execute.after: bash command", { command })
        
        sessionData.commands.push({
          command: String(command),
          exitCode: 0,
          duration: 0,
        })

        await persistContext(
          globalDb,
          String(command),
          "command",
          sessionData.sessionId,
          globalProjectId,
          {},
          globalConfig?.weights.command ?? 0.5
        )
      }
      
      if (toolName === "write" || toolName === "edit") {
        const filePath = output?.args?.filePath || input?.args?.filePath
        if (filePath && !shouldExclude(filePath)) {
          await debugLog("tool.execute.after: file write", { filePath, tool: toolName })
          
          sessionData.filesEdited.push({
            filePath,
            changes: `File ${toolName === 'write' ? 'created' : 'edited'}`,
          })

          await persistContext(
            globalDb,
            `File ${toolName === 'write' ? 'created' : 'edited'}: ${filePath}`,
            "file_change",
            sessionData.sessionId,
            globalProjectId,
            { filePath },
            globalConfig?.weights.file_change ?? 0.8
          )
        }
      }
    },
  }
}
