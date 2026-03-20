export type ContextType =
  | 'file_change'
  | 'decision'
  | 'debt'
  | 'task'
  | 'architecture'
  | 'command'

export type ChangeType = 'create' | 'modify' | 'delete'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'

export type DebtType = 'performance' | 'security' | 'maintainability' | 'testing'

export type Severity = 'low' | 'medium' | 'high' | 'critical'

export type Layer = 'presentation' | 'business' | 'data' | 'infrastructure'

export type DecisionType = 'architecture' | 'library' | 'pattern' | 'refactor'

export interface FileChangeMetadata {
  filePath: string
  changeType: ChangeType
  diffSummary: string
  linesAdded: number
  linesRemoved: number
  relatedTasks: string[]
}

export interface DecisionMetadata {
  decisionType: DecisionType
  rationale: string
  alternatives: string[]
  stakeholders: string[]
  reversedAt?: string
}

export interface TechnicalDebtMetadata {
  debtType: DebtType
  severity: Severity
  introducedIn: string
  estimatedEffort: string
  blockingRelease: boolean
}

export interface TaskMetadata {
  taskId: string
  status: TaskStatus
  dependencies: string[]
  completedAt?: string
  blockedReason?: string
}

export interface ArchitectureMetadata {
  component: string
  layer: Layer
  relationships: string[]
  constraints: string[]
}

export interface CommandMetadata {
  commandLine: string
  exitCode: number
  duration: number
  sideEffects: string[]
  workingDirectory: string
}

export interface InitMetadata {
  type: 'llmngn_init'
  projectDir: string
  initializedAt: string
}

export type ContextMetadata =
  | FileChangeMetadata
  | DecisionMetadata
  | TechnicalDebtMetadata
  | TaskMetadata
  | ArchitectureMetadata
  | CommandMetadata
  | InitMetadata
  | Record<string, unknown>

export interface ContextRecord {
  id: string
  vector: number[]
  projectId: string
  contextType: ContextType
  content: string
  metadata: ContextMetadata
  sessionId: string
  createdAt: string
  expiresAt?: string
  salience: number
}

export interface PluginConfig {
  enabled: boolean
  embeddingModel: string
  embeddingProvider: 'cloud' | 'local'
  apiKey?: string
  lancedbPath: string
  maxContextTokens: number
  queryLatencyMs: number
  salienceDecay: number
  retentionDays: number
  contextTypes: ContextType[]
  weights: Record<ContextType, number>
  filters: {
    excludePatterns: string[]
    sensitiveDataRedaction: boolean
  }
}

export interface QueryOptions {
  intent?: string
  types?: ContextType[]
  since?: string
  limit?: number
  weights?: Partial<Record<ContextType, number>>
}

export interface SearchResult {
  record: ContextRecord
  score: number
  similarity: number
  recency: number
  weightedScore: number
}

export interface SessionSummary {
  sessionId: string
  projectPath: string
  startTime: string
  endTime: string
  changes: FileChangeMetadata[]
  decisions: DecisionMetadata[]
  tasks: TaskMetadata[]
  commands: CommandMetadata[]
  debt: TechnicalDebtMetadata[]
}

export interface EmbeddingResponse {
  vector: number[]
  model: string
  tokens: number
}

export interface EmbeddingProvider {
  name: string
  encode(text: string): Promise<EmbeddingResponse>
  encodeBatch(texts: string[]): Promise<EmbeddingResponse[]>
  isAvailable(): Promise<boolean>
}

export interface HookInput {
  session?: SessionSummary
  filePath?: string
  changes?: unknown
  command?: string
  result?: unknown
  tool?: string
  message?: unknown
  todo?: unknown
  error?: unknown
}

export interface HookOutput {
  context?: string[]
}

export type HookHandler = (input: HookInput, output: HookOutput) => Promise<void>

export interface PluginHooks {
  'session.created'?: HookHandler
  'experimental.session.compacting'?: HookHandler
  'session.idle'?: HookHandler
  'file.edited'?: HookHandler
  'command.executed'?: HookHandler
  'tool.execute.after'?: HookHandler
  'message.updated'?: HookHandler
  'todo.updated'?: HookHandler
  'session.error'?: HookHandler
}