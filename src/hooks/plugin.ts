import { LanceDBClient } from '../database/client.js'
import { createEmbeddingProvider } from '../embedding/embedding.js'
import { createLLMProvider } from '../llm/client.js'
import { ContextRetriever } from '../context/retriever.js'
import { ContextPersister } from '../context/persister.js'
import { SemanticExtractor } from '../context/extractor.js'
import { ConfigManager } from '../utils/config.js'
import type { 
  PluginHooks,
  HookInput, 
  HookOutput,
  SessionSummary 
} from '../types/index.js'
import { createHash } from 'crypto'
import { join } from 'path'

interface PluginOptions {
  client: unknown
  directory: string
}

export async function ContextPersistencePlugin(
  options: PluginOptions
): Promise<PluginHooks> {
  const { directory } = options
  
  const configManager = new ConfigManager(directory)
  const config = await configManager.load()
  
  if (!config.enabled) {
    return {}
  }

  const dbPath = join(directory, config.lancedbPath)
  const db = new LanceDBClient(dbPath)
  await db.initialize()

  const embedder = createEmbeddingProvider({
    provider: config.embeddingProvider,
    model: config.embeddingModel,
    apiKey: config.apiKey
  })

  let extractor: SemanticExtractor | undefined
  if (config.llm?.enabled) {
    try {
      const llmProvider = createLLMProvider({
        provider: config.llm.provider,
        model: config.llm.model,
        apiKey: config.llm.apiKey,
        endpoint: config.llm.endpoint
      })
      extractor = new SemanticExtractor(llmProvider, config.llm.extractionConfidenceThreshold)
      console.log('[LLMNGN] LLM extraction enabled with', config.llm.provider)
    } catch (e) {
      console.error('[LLMNGN] Failed to initialize LLM provider:', e)
    }
  }

  const retriever = new ContextRetriever(db, embedder, config)
  const persister = new ContextPersister(db, embedder, config, extractor)

  const projectId = createHash('sha256').update(directory).digest('hex').slice(0, 16)
  let currentSessionId: string | null = null

  return {
    'session.created': async (input: HookInput, output: HookOutput): Promise<void> => {
      try {
        if (!input.session) {
          return
        }
        
        currentSessionId = input.session.sessionId
        
        const results = await retriever.retrieve('', {
          projectId,
          limit: 50
        })

        if (results.length > 0) {
          const contextLines = results.map(r => 
            `[${r.record.contextType}] ${r.record.content}`
          )
          output.context = contextLines
        }
      } catch (error) {
        console.error('session.created hook error:', error)
      }
    },

    'experimental.session.compacting': async (_input: HookInput, output: HookOutput): Promise<void> => {
      try {
        const results = await retriever.retrieve('', {
          projectId,
          limit: 20
        })

        if (results.length > 0) {
          const persistentContext = results
            .filter(r => r.record.contextType === 'decision' || r.record.contextType === 'architecture')
            .map(r => r.record.content)
          
          output.context = persistentContext
        }
      } catch (error) {
        console.error('session.compacting hook error:', error)
      }
    },

    'session.idle': async (input: HookInput, _output: HookOutput): Promise<void> => {
      try {
        if (!input.session) {
          return
        }

        await persister.persistSession(input.session as SessionSummary, projectId)
        
        await db.deleteExpired()
      } catch (error) {
        console.error('session.idle hook error:', error)
      }
    },

    'file.edited': async (input: HookInput, _output: HookOutput): Promise<void> => {
      try {
        if (!input.filePath || !currentSessionId) {
          return
        }

        if (extractor) {
          await persister.persistFromLLM(
            String(input.changes ?? `File modified: ${input.filePath}`),
            'file_change',
            currentSessionId,
            projectId,
            { filePath: input.filePath }
          )
        } else {
          await persister.persistFileChange({
            filePath: input.filePath,
            changeType: 'modify',
            diffSummary: String(input.changes ?? 'File modified'),
            linesAdded: 0,
            linesRemoved: 0,
            relatedTasks: []
          }, currentSessionId, projectId)
        }
      } catch (error) {
        console.error('file.edited hook error:', error)
      }
    },

    'command.executed': async (input: HookInput, _output: HookOutput): Promise<void> => {
      try {
        if (!input.command || !currentSessionId) {
          return
        }

        await persister.persistCommand({
          commandLine: input.command,
          exitCode: (input.result as { exitCode?: number })?.exitCode ?? 0,
          duration: (input.result as { duration?: number })?.duration ?? 0,
          sideEffects: [],
          workingDirectory: directory
        }, currentSessionId, projectId)
      } catch (error) {
        console.error('command.executed hook error:', error)
      }
    },

    'tool.execute.after': async (input: HookInput, _output: HookOutput): Promise<void> => {
      try {
        if (!input.tool || !currentSessionId) {
          return
        }

        const toolName = String(input.tool)
        const filePath = input.filePath as string | undefined
        const changes = input.changes as string | undefined

        if ((toolName === 'write' || toolName === 'edit') && filePath) {
          if (extractor) {
            await persister.persistFromLLM(
              changes ?? `File ${toolName === 'write' ? 'created' : 'edited'}: ${filePath}`,
              'file_change',
              currentSessionId,
              projectId,
              { filePath }
            )
          } else {
            await persister.persistFileChange({
              filePath,
              changeType: toolName === 'write' ? 'create' : 'modify',
              diffSummary: changes ?? `File ${toolName === 'write' ? 'created' : 'edited'}`,
              linesAdded: 0,
              linesRemoved: 0,
              relatedTasks: []
            }, currentSessionId, projectId)
          }
        }
      } catch (error) {
        console.error('tool.execute.after hook error:', error)
      }
    },

    'message.updated': async (input: HookInput, _output: HookOutput): Promise<void> => {
      try {
        if (!input.message || !currentSessionId) {
          return
        }
        
        const message = input.message as { type?: string; content?: string; role?: string }
        
        if (message.role === 'assistant' && message.content) {
          if (extractor) {
            await persister.persistFromLLM(message.content, 'completion', currentSessionId, projectId)
            await persister.persistFromLLM(message.content, 'decision', currentSessionId, projectId)
          }
        } else if (message?.type === 'decision') {
          await persister.persistDecision({
            decisionType: 'pattern',
            rationale: message.content ?? '',
            alternatives: [],
            stakeholders: []
          }, currentSessionId, projectId)
        }
      } catch (error) {
        console.error('message.updated hook error:', error)
      }
    },

    'todo.updated': async (input: HookInput, _output: HookOutput): Promise<void> => {
      try {
        if (!input.todo || !currentSessionId) {
          return
        }

        const todo = input.todo as { id?: string; status?: string; dependencies?: string[]; completedAt?: string }
        await persister.persistTask({
          taskId: todo.id ?? 'unknown',
          status: todo.status ?? 'pending',
          dependencies: todo.dependencies ?? [],
          completedAt: todo.completedAt
        }, currentSessionId, projectId)
      } catch (error) {
        console.error('todo.updated hook error:', error)
      }
    },

    'session.error': async (input: HookInput, _output: HookOutput): Promise<void> => {
      try {
        if (!input.error || !input.session) {
          return
        }

        const errorObj = input.error as { message?: string; stack?: string }
        const errorMessage = errorObj?.message ?? String(input.error)

        if (extractor) {
          await persister.persistFromLLM(
            errorMessage,
            'debt',
            currentSessionId ?? 'unknown',
            projectId,
            { stack: errorObj?.stack }
          )
        } else {
          await persister.persistDebt({
            debtType: 'maintainability',
            severity: 'medium',
            introducedIn: currentSessionId ?? 'unknown',
            estimatedEffort: '1',
            blockingRelease: false
          }, currentSessionId ?? 'unknown', projectId)
        }
      } catch (error) {
        console.error('session.error hook error:', error)
      }
    }
  }
}
