import type { Plugin } from "@opencode-ai/plugin"
import { createHash } from "crypto"
import { readFile, mkdir } from "fs/promises"
import { join } from "path"

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
  metadata: Record<string, unknown>
  sessionId: string
  createdAt: string
  expiresAt?: string
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

async function loadConfig(directory: string): Promise<typeof DEFAULT_CONFIG> {
  const configPath = join(directory, ".opencode", "plugins", "context-persistence.json")
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

async function initDatabase(dbPath: string): Promise<any> {
  try {
    const lancedb = await import("@lancedb/lancedb")
    const dbInstance = await lancedb.connect(dbPath)
    return dbInstance
  } catch (e) {
    return null
  }
}

async function insertRecord(db: any, record: ContextRecord): Promise<void> {
  try {
    const table = await db.openTable("codebase_context")
    await table.add([record])
  } catch {
    try {
      await db.createTable("codebase_context", [record])
    } catch (createErr) {
      // Table might already exist with different schema
    }
  }
}

async function queryRecords(db: any, limit: number, projectId: string): Promise<ContextRecord[]> {
  try {
    const table = await db.openTable("codebase_context")
    const results = await table.query().limit(limit).toArray()
    return results.filter((r: ContextRecord) => r.projectId === projectId)
  } catch {
    return []
  }
}

async function deleteExpired(db: any): Promise<void> {
  try {
    const table = await db.openTable("codebase_context")
    const now = new Date().toISOString()
    await table.delete(`expiresAt < '${now}'`)
  } catch {}
}

async function simpleEmbed(text: string): Promise<number[]> {
  const vector: number[] = []
  const words = text.toLowerCase().split(/\s+/).slice(0, 100)
  for (let i = 0; i < 768; i++) {
    let sum = 0
    for (const word of words) {
      const charCodes = word.split('').map(c => c.charCodeAt(0))
      sum += charCodes[i % charCodes.length] * (i + 1) / 1000
    }
    vector.push(Math.tanh(sum / words.length))
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
  const record: ContextRecord = {
    id: generateId(),
    vector,
    projectId,
    contextType,
    content: redacted,
    metadata,
    sessionId,
    createdAt: new Date().toISOString(),
    expiresAt: getExpiry(contextType),
    salience
  }
  await insertRecord(db, record)
}

export default async ({ project, client, directory }: Parameters<Plugin>[0]) => {
  globalConfig = await loadConfig(directory)

  if (!globalConfig.enabled) {
    await client.app.log({
      body: {
        service: "context-persistence-plugin",
        level: "info",
        message: "Plugin disabled, skipping initialization",
      },
    })
    return {}
  }

  globalProjectId = createHash("sha256").update(directory).digest("hex").slice(0, 16)

  try {
    globalDb = await initDatabase(globalConfig.lancedbPath)

    if (!globalDb) {
      await client.app.log({
        body: {
          service: "context-persistence-plugin",
          level: "warn",
          message: "LanceDB not available - context persistence disabled. This is normal if @lancedb/lancedb is not installed.",
        },
      })
      return {}
    }

    await client.app.log({
      body: {
        service: "context-persistence-plugin",
        level: "info",
        message: `Context persistence plugin initialized`,
        extra: { projectId: globalProjectId, dbPath: globalConfig.lancedbPath },
      },
    })
  } catch (error) {
    await client.app.log({
      body: {
        service: "context-persistence-plugin",
        level: "error",
        message: `Failed to initialize: ${error}`,
      },
    })
    return {}
  }

  const sessionData: SessionData = {
    sessionId: `session-${Date.now()}`,
    startTime: new Date().toISOString(),
    filesEdited: [],
    commands: [],
  }

  return {
    "experimental.chat.system.transform": async (_input, output) => {
      if (!globalDb || !globalProjectId) return

      try {
        const records = await queryRecords(globalDb, 50, globalProjectId)
        const results = records.filter(r => {
          if (r.expiresAt && new Date(r.expiresAt) < new Date()) return false
          return true
        })

        if (results.length > 0) {
          const grouped: Record<string, string[]> = {}

          for (const r of results) {
            const type = r.contextType
            if (!grouped[type]) grouped[type] = []
            grouped[type].push(r.content)
          }

          output.system.push(`[Context from prior sessions - ${results.length} records]:`)

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

          output.system.push(`---`)

          await client.app.log({
            body: {
              service: "context-persistence-plugin",
              level: "debug",
              message: `Injected ${results.length} context records into system prompt`,
            },
          })
        }
      } catch (error) {
        await client.app.log({
          body: {
            service: "context-persistence-plugin",
            level: "error",
            message: `Failed to retrieve context: ${error}`,
          },
        })
      }
    },

    "session.created": async (input) => {
      if (input.session?.sessionId) {
        sessionData.sessionId = input.session.sessionId
      }

      await client.app.log({
        body: {
          service: "context-persistence-plugin",
          level: "info",
          message: `Session created: ${sessionData.sessionId}`,
        },
      })
    },

    "session.idle": async () => {
      if (!globalDb || !globalProjectId) return

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

        await client.app.log({
          body: {
            service: "context-persistence-plugin",
            level: "info",
            message: `Session persisted: ${sessionData.filesEdited.length} files, ${sessionData.commands.length} commands`,
            extra: { sessionId: sessionData.sessionId },
          },
        })
      } catch (error) {
        await client.app.log({
          body: {
            service: "context-persistence-plugin",
            level: "error",
            message: `Failed to persist session: ${error}`,
          },
        })
      }
    },

    "file.edited": async (input) => {
      if (!input.filePath || !globalDb || !globalProjectId) return
      if (shouldExclude(input.filePath)) return

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

        await client.app.log({
          body: {
            service: "context-persistence-plugin",
            level: "debug",
            message: `File change recorded: ${input.filePath}`,
          },
        })
      } catch (error) {
        await client.app.log({
          body: {
            service: "context-persistence-plugin",
            level: "error",
            message: `Failed to persist file change: ${error}`,
          },
        })
      }
    },

    "command.executed": async (input) => {
      if (!input.command || !globalDb || !globalProjectId) return

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

        await client.app.log({
          body: {
            service: "context-persistence-plugin",
            level: "debug",
            message: `Command recorded: ${input.command}`,
          },
        })
      } catch (error) {
        await client.app.log({
          body: {
            service: "context-persistence-plugin",
            level: "error",
            message: `Failed to persist command: ${error}`,
          },
        })
      }
    },
  }
}