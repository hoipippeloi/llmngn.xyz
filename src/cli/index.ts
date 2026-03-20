import { Command } from 'commander'
import { LanceDBClient } from '../database/client.js'
import { createEmbeddingProvider } from '../embedding/embedding.js'
import { ContextRetriever } from '../context/retriever.js'
import { ConfigManager } from '../utils/config.js'
import type { PluginConfig, ContextType } from '../types/index.js'
import { readFile, writeFile } from 'fs/promises'
import { createHash } from 'crypto'

export interface InitOptions {
  embeddingModel?: string
}

export interface QueryOptions {
  text: string
  limit?: number
  types?: string[]
}

export interface HistoryOptions {
  sessions?: number
}

export interface ExportOptions {
  output?: string
}

export interface ImportOptions {
  path: string
}

export interface PurgeOptions {
  force?: boolean
}

export interface StatsResult {
  recordCount: number
  sizeBytes: number
  oldestRecord?: string
  newestRecord?: string
  sessionsCount: number
}

export class CLI {
  private projectDir: string
  private configManager: ConfigManager
  private db: LanceDBClient | null = null
  private config: PluginConfig | null = null

  constructor(projectDir: string) {
    this.projectDir = projectDir
    this.configManager = new ConfigManager(projectDir)
  }

  async init(options: InitOptions): Promise<void> {
    let config = await this.configManager.load()
    
    if (options.embeddingModel) {
      config.embeddingModel = options.embeddingModel
    }
    
    await this.configManager.save(config)
    this.config = config

    const dbPath = config.lancedbPath
    this.db = new LanceDBClient(dbPath)
    await this.db.initialize()
  }

  async query(options: QueryOptions): Promise<Array<{ id: string; type: string; content: string; score: number }>> {
    const { db, config } = await this.initialize()

    const embedder = createEmbeddingProvider({
      provider: config.embeddingProvider,
      model: config.embeddingModel,
      apiKey: config.apiKey
    })

    const retriever = new ContextRetriever(db, embedder, config)
    const projectId = this.getProjectId()

    const results = await retriever.retrieve(options.text, {
      projectId,
      limit: options.limit ?? 50,
      types: options.types as ContextType[] | undefined
    })

    return results.map(r => ({
      id: r.record.id,
      type: r.record.contextType,
      content: r.record.content.slice(0, 200),
      score: Math.round(r.weightedScore * 1000) / 1000
    }))
  }

  async history(options: HistoryOptions): Promise<Array<{ sessionId: string; timestamp: string; summary: string }>> {
    const { db } = await this.initialize()
    
    const allRecords = await db.query(new Array(768).fill(0), { limit: 1000 })
    
    const sessionMap = new Map<string, { count: number; timestamps: string[] }>()
    
    for (const record of allRecords) {
      const session = record.sessionId
      if (!sessionMap.has(session)) {
        sessionMap.set(session, { count: 0, timestamps: [] })
      }
      const entry = sessionMap.get(session)!
      entry.count++
      entry.timestamps.push(record.createdAt)
    }

    const sessions = Array.from(sessionMap.entries())
      .map(([sessionId, data]) => ({
        sessionId,
        timestamp: data.timestamps.sort()[data.timestamps.length - 1] ?? '',
        summary: `${data.count} records`
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, options.sessions ?? 10)

    return sessions
  }

  async export(options: ExportOptions): Promise<void> {
    const { db } = await this.initialize()
    
    const allRecords = await db.query(new Array(768).fill(0), { limit: 10000 })
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      project: this.projectDir,
      recordCount: allRecords.length,
      records: allRecords
    }

    const outputPath = options.output ?? 'llmngn-export.json'
    await writeFile(outputPath, JSON.stringify(exportData, null, 2))
  }

  async import(options: ImportOptions): Promise<void> {
    const { db } = await this.initialize()
    
    const content = await readFile(options.path, 'utf-8')
    const importData = JSON.parse(content)

    if (!importData.records || !Array.isArray(importData.records)) {
      throw new Error('Invalid import file: missing records array')
    }

    for (const record of importData.records) {
      await db.insert(record)
    }
  }

  async purge(options: PurgeOptions): Promise<void> {
    if (!options.force) {
      throw new Error('Purge requires --force flag to confirm')
    }

    const { db } = await this.initialize()
    
    await db.close()
    
    const fs = await import('fs/promises')
    const config = await this.configManager.load()
    await fs.rm(config.lancedbPath, { recursive: true, force: true })
    
    this.db = null
  }

  async stats(): Promise<StatsResult> {
    const { db } = await this.initialize()
    
    const stats = await db.getStats()
    const allRecords = await db.query(new Array(768).fill(0), { limit: 10000 })

    const sessions = new Set(allRecords.map(r => r.sessionId))

    const timestamps = allRecords
      .map(r => r.createdAt)
      .sort()

    return {
      recordCount: stats.recordCount,
      sizeBytes: stats.sizeBytes,
      oldestRecord: timestamps[0],
      newestRecord: timestamps[timestamps.length - 1],
      sessionsCount: sessions.size
    }
  }

  async configSet(key: string, value: string): Promise<void> {
    const config = await this.configManager.load()
    
    const numValue = !isNaN(Number(value)) ? Number(value) : value
    const boolValue = value === 'true' ? true : value === 'false' ? false : numValue
    
    ;(config as unknown as Record<string, unknown>)[key] = boolValue
    
    const validation = this.configManager.validate(config)
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`)
    }
    
    await this.configManager.save(config)
    this.config = config
  }

  async configGet(key: string): Promise<string | number | boolean | undefined> {
    const config = await this.configManager.load()
    return (config as unknown as Record<string, unknown>)[key] as string | number | boolean | undefined
  }

  async configList(): Promise<PluginConfig> {
    return this.configManager.load()
  }

  async getConfig(): Promise<PluginConfig> {
    if (!this.config) {
      this.config = await this.configManager.load()
    }
    return this.config
  }

  private async initialize(): Promise<{ db: LanceDBClient; config: PluginConfig }> {
    if (!this.config) {
      this.config = await this.configManager.load()
    }

    if (!this.db) {
      this.db = new LanceDBClient(this.config.lancedbPath)
      await this.db.initialize()
    }

    return { db: this.db, config: this.config }
  }

  private getProjectId(): string {
    return createHash('sha256')
      .update(this.projectDir)
      .digest('hex')
      .slice(0, 16)
  }
}

export function createProgram(cli: CLI): Command {
  const program = new Command()

  program
    .name('llmngn')
    .description('LLMNGN - Context persistence CLI')
    .version('0.1.0')

  program
    .command('init')
    .description('Initialize plugin in current project')
    .option('--embedding-model <model>', 'Embedding model to use')
    .action(async (options) => {
      await cli.init(options)
      console.log('LLMNGN initialized')
    })

  program
    .command('query <text>')
    .description('Query stored context')
    .option('-l, --limit <n>', 'Limit results', '50')
    .option('-t, --types <types>', 'Filter by context types (comma-separated)')
    .action(async (text, options) => {
      const results = await cli.query({
        text,
        limit: parseInt(options.limit),
        types: options.types?.split(',')
      })
      console.log(JSON.stringify(results, null, 2))
    })

  program
    .command('history')
    .description('Show session history')
    .option('-s, --sessions <n>', 'Number of sessions to show', '10')
    .action(async (options) => {
      const history = await cli.history({ sessions: parseInt(options.sessions) })
      console.log(JSON.stringify(history, null, 2))
    })

  program
    .command('export')
    .description('Export context for backup')
    .option('-o, --output <path>', 'Output file path')
    .action(async (options) => {
      await cli.export({ output: options.output })
      console.log('Context exported')
    })

  program
    .command('import <path>')
    .description('Import context from backup')
    .action(async (path) => {
      await cli.import({ path })
      console.log('Context imported')
    })

  program
    .command('purge')
    .description('Clear stored context')
    .option('-f, --force', 'Force purge without confirmation')
    .action(async (options) => {
      await cli.purge({ force: options.force })
      console.log('Context purged')
    })

  program
    .command('stats')
    .description('Show database statistics')
    .action(async () => {
      const stats = await cli.stats()
      console.log(JSON.stringify(stats, null, 2))
    })

  program
    .command('config')
    .description('Manage configuration')
    .argument('[command]', 'set, get, or list')
    .argument('[key]', 'Configuration key')
    .argument('[value]', 'Configuration value')
    .action(async (command, key, value) => {
      if (command === 'set' && key && value) {
        await cli.configSet(key, value)
        console.log(`Config updated: ${key} = ${value}`)
      } else if (command === 'get' && key) {
        const val = await cli.configGet(key)
        console.log(val)
      } else if (command === 'list' || !command) {
        const config = await cli.configList()
        console.log(JSON.stringify(config, null, 2))
      }
    })

  return program
}

export async function main(): Promise<void> {
  const cli = new CLI(process.cwd())
  const program = createProgram(cli)
  await program.parseAsync(process.argv)
}
