import { Command } from 'commander'
import { LanceDBClient } from '../database/client.js'
import { createEmbeddingProvider } from '../embedding/embedding.js'
import { ContextRetriever } from '../context/retriever.js'
import { ConfigManager } from '../utils/config.js'
import type { PluginConfig, ContextType, ContextRecord } from '../types/index.js'
import { readFile, writeFile } from 'fs/promises'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { join } from 'path'

export interface InitOptions {
  embeddingModel?: string
}

export interface AddOptions {
  content: string
  type?: ContextType
  session?: string
  metadata?: string
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

export interface UninstallOptions {
  keepDb?: boolean
  full?: boolean
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

  async init(options: InitOptions): Promise<{ id: string }> {
    let config = await this.configManager.load()
    
    if (options.embeddingModel) {
      config.embeddingModel = options.embeddingModel
    }
    
    await this.configManager.save(config)
    this.config = config

    const dbPath = config.lancedbPath
    this.db = new LanceDBClient(dbPath)
    await this.db.initialize()

    await this.createReadmeFile()
    
    const initRecord = await this.storeInitRecord(config)
    return { id: initRecord.id }
  }

  private async createReadmeFile(): Promise<void> {
    const readmeContent = `# LLMNGN

Context persistence plugin for OpenCode - stores and retrieves context across sessions.

## Quick Commands

| Command | Use |
|---------|-----|
| \`llmngn add <text>\` | Store a decision/note |
| \`llmngn list\` | List all records |
| \`llmngn query <text>\` | Search context |
| \`llmngn stats\` | Database info |
| \`llmngn clean\` | Remove expired |
| \`llmngn purge --force\` | Clear all |
| \`llmngn uninstall --keep-db\` | Remove plugin only |
| \`llmngn uninstall --full\` | Remove everything |

## Examples

\`\`\`bash
# Store a decision
llmngn add "Use Redis for caching" -t decision

# Store with metadata
llmngn add "Fixed auth bug" -t file_change -m '{"file":"src/auth.ts"}'

# List decisions only
llmngn list -t decision -l 20

# Search for something
llmngn query "authentication" -l 10

# Get specific record
llmngn get <id>

# Delete a record
llmngn delete <id> --force

# Backup before changes
llmngn export -o backup.json

# Restore from backup
llmngn import backup.json

# View session history
llmngn history

# Remove only plugin files (keep database)
llmngn uninstall --keep-db

# Remove everything including database
llmngn uninstall --full
\`\`\`

## Files

- \`.opencode/plugins/llmngn.ts\` - Plugin code
- \`.opencode/plugins/llmngn.json\` - Config
- \`.lancedb/\` - Database

## Config

Edit \`.opencode/plugins/llmngn.json\` to customize retention, weights, filters.
`

    const readmePath = join(this.projectDir, 'LLMNGN.md')
    await writeFile(readmePath, readmeContent)
  }

  private async storeInitRecord(config: PluginConfig): Promise<{ id: string }> {
    const embedder = createEmbeddingProvider({
      provider: config.embeddingProvider,
      model: config.embeddingModel,
      apiKey: config.apiKey
    })

    const projectId = this.getProjectId()
    const sessionId = `init-${Date.now()}`
    
    const usageInstructions = `LLMNGN Context Persistence Plugin - Initialized ${new Date().toISOString()}

## What This Plugin Does
This plugin maintains semantic continuity across coding sessions by storing and retrieving context (decisions, file changes, commands, etc.) in a local LanceDB vector database.

## CLI Commands Available
- llmngn init - Initialize/reinitialize plugin
- llmngn add <content> - Add context record manually
- llmngn list [-t type] [-l limit] - List records
- llmngn get <id> - Get record by ID
- llmngn query <text> - Search context semantically
- llmngn delete <id> --force - Delete record
- llmngn clean - Remove expired records
- llmngn history - View session history
- llmngn stats - Database statistics
- llmngn export/import - Backup/restore
- llmngn purge --force - Clear all data
- llmngn config list/set/get - Manage settings

## Context Types
- decision (weight 1.0, 180 days) - Architectural decisions
- architecture (weight 1.0, 365 days) - Component relationships
- debt (weight 0.9, 90 days) - Technical debt items
- file_change (weight 0.8, 90 days) - File modifications
- task (weight 0.7, 60 days) - Task progress
- command (weight 0.5, 30 days) - Build/CLI commands

## Config Location
.opencode/plugins/llmngn.json

## Database Location
.lancedb/`

    const embedding = await embedder.encode(usageInstructions)

    const record: ContextRecord = {
      id: uuidv4(),
      vector: embedding.vector,
      projectId,
      contextType: 'architecture',
      content: usageInstructions,
      metadata: { 
        type: 'llmngn_init',
        projectDir: this.projectDir,
        initializedAt: new Date().toISOString()
      },
      sessionId,
      createdAt: new Date().toISOString(),
      salience: 1.0
    }

    await this.db!.insert(record)
    
    return { id: record.id }
  }

  async add(options: AddOptions): Promise<{ id: string }> {
    const { db, config } = await this.initialize()
    
    const embedder = createEmbeddingProvider({
      provider: config.embeddingProvider,
      model: config.embeddingModel,
      apiKey: config.apiKey
    })

    const embedding = await embedder.encode(options.content)
    const projectId = this.getProjectId()
    const contextType = options.type ?? 'decision'
    const sessionId = options.session ?? `cli-${Date.now()}`
    
    let metadata = {}
    if (options.metadata) {
      try {
        metadata = JSON.parse(options.metadata)
      } catch {
        metadata = { note: options.metadata }
      }
    }

    const record: ContextRecord = {
      id: uuidv4(),
      vector: embedding.vector,
      projectId,
      contextType,
      content: options.content,
      metadata: metadata as ContextRecord['metadata'],
      sessionId,
      createdAt: new Date().toISOString(),
      salience: config.weights[contextType] ?? 1.0
    }

    await db.insert(record)
    
    return { id: record.id }
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
    
    const allRecords = await db.list({ limit: 1000 })
    
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
    
    const allRecords = await db.list({ limit: 10000 })
    
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

  async uninstall(options: UninstallOptions): Promise<{ removed: string[] }> {
    if (!options.keepDb && !options.full) {
      throw new Error('Uninstall requires --keep-db or --full flag')
    }

    const removed: string[] = []
    const fs = await import('fs/promises')

    const pluginTs = join(this.projectDir, '.opencode', 'plugins', 'llmngn.ts')
    const pluginJson = join(this.projectDir, '.opencode', 'plugins', 'llmngn.json')

    try {
      await fs.rm(pluginTs, { force: true })
      removed.push('.opencode/plugins/llmngn.ts')
    } catch { /* ignore */ }

    try {
      await fs.rm(pluginJson, { force: true })
      removed.push('.opencode/plugins/llmngn.json')
    } catch { /* ignore */ }

    if (options.full) {
      if (this.db) {
        await this.db.close()
        this.db = null
      }

      const config = await this.configManager.load()
      try {
        await fs.rm(config.lancedbPath, { recursive: true, force: true })
        removed.push('.lancedb/')
      } catch { /* ignore */ }

      const readmePath = join(this.projectDir, 'LLMNGN.md')
      try {
        await fs.rm(readmePath, { force: true })
        removed.push('LLMNGN.md')
      } catch { /* ignore */ }
    }

    return { removed }
  }

  async stats(): Promise<StatsResult> {
    const { db } = await this.initialize()
    
    const stats = await db.getStats()
    const allRecords = await db.list({ limit: 10000 })

    const sessions = new Set(allRecords.map(r => r.sessionId))

    const timestamps = allRecords
      .map(r => r.createdAt)
      .filter(Boolean)
      .sort()

    return {
      recordCount: stats.recordCount,
      sizeBytes: stats.sizeBytes,
      oldestRecord: timestamps[0],
      newestRecord: timestamps[timestamps.length - 1],
      sessionsCount: sessions.size
    }
  }

  async list(options: { limit?: number; type?: ContextType; session?: string }): Promise<ContextRecord[]> {
    const { db } = await this.initialize()
    return db.list(options)
  }

  async get(id: string): Promise<ContextRecord | null> {
    const { db } = await this.initialize()
    return db.getById(id)
  }

  async delete(id: string): Promise<boolean> {
    const { db } = await this.initialize()
    return db.deleteById(id)
  }

  async clean(): Promise<number> {
    const { db } = await this.initialize()
    return db.deleteExpired()
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
      const result = await cli.init(options)
      console.log(JSON.stringify({
        status: 'initialized',
        recordId: result.id,
        message: 'Init record stored with usage instructions for future sessions'
      }, null, 2))
    })

  program
    .command('add <content>')
    .description('Add context record manually')
    .option('-t, --type <type>', 'Context type (decision, file_change, command, etc.)', 'decision')
    .option('-s, --session <id>', 'Session ID')
    .option('-m, --metadata <json>', 'Metadata as JSON string')
    .action(async (content, options) => {
      const result = await cli.add({
        content,
        type: options.type as ContextType,
        session: options.session,
        metadata: options.metadata
      })
      console.log(JSON.stringify(result, null, 2))
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
    .command('list')
    .description('List all context records')
    .option('-l, --limit <n>', 'Limit results', '100')
    .option('-t, --type <type>', 'Filter by context type')
    .option('-s, --session <id>', 'Filter by session ID')
    .action(async (options) => {
      const records = await cli.list({
        limit: parseInt(options.limit),
        type: options.type as ContextType,
        session: options.session
      })
      console.log(JSON.stringify(records.map(r => ({
        id: r.id,
        type: r.contextType,
        content: r.content.slice(0, 100),
        session: r.sessionId,
        created: r.createdAt
      })), null, 2))
    })

  program
    .command('get <id>')
    .description('Get a specific record by ID')
    .action(async (id) => {
      const record = await cli.get(id)
      if (!record) {
        console.log(JSON.stringify({ error: 'Record not found' }, null, 2))
        return
      }
      console.log(JSON.stringify(record, null, 2))
    })

  program
    .command('delete <id>')
    .description('Delete a specific record by ID')
    .option('-f, --force', 'Force delete without confirmation')
    .action(async (id, options) => {
      if (!options.force) {
        console.log('Use --force to confirm deletion')
        return
      }
      const deleted = await cli.delete(id)
      console.log(JSON.stringify({ deleted, id }, null, 2))
    })

  program
    .command('clean')
    .description('Delete expired records')
    .action(async () => {
      const count = await cli.clean()
      console.log(JSON.stringify({ deleted: count }, null, 2))
    })

  program
    .command('uninstall')
    .description('Remove LLMNGN plugin from project')
    .option('--keep-db', 'Remove plugin files only, keep database')
    .option('--full', 'Remove everything including database and LLMMNGN.md')
    .action(async (options) => {
      const result = await cli.uninstall({ keepDb: options.keepDb, full: options.full })
      console.log(JSON.stringify({ status: 'uninstalled', ...result }, null, 2))
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
