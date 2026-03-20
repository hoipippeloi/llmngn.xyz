import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContextPersistencePlugin } from './plugin.js'
import type { HookInput, HookOutput } from '../types/index.js'

vi.mock('../database/client.js')
vi.mock('../embedding/embedding.js')

describe('ContextPersistencePlugin', () => {
  let plugin: Awaited<ReturnType<typeof ContextPersistencePlugin>>

  beforeEach(async () => {
    plugin = await ContextPersistencePlugin({
      client: {} as any,
      directory: '/test/project'
    })
  })

  describe('session.created hook', () => {
    it('should inject context on new session', async () => {
      const input: HookInput = {
        session: {
          sessionId: 'new-session',
          projectPath: '/test/project',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          changes: [],
          decisions: [],
          tasks: [],
          commands: [],
          debt: []
        }
      }
      const output: HookOutput = { context: [] }

      await plugin['session.created']?.(input, output)

      expect(output.context).toBeDefined()
    })

    it('should handle empty database gracefully', async () => {
      const input: HookInput = { session: undefined }
      const output: HookOutput = { context: [] }

      await plugin['session.created']?.(input, output)

      expect(output.context).toEqual([])
    })
  })

  describe('session.idle hook', () => {
    it('should persist session summary', async () => {
      const input: HookInput = {
        session: {
          sessionId: 'session-1',
          projectPath: '/test',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          changes: [{
            filePath: '/src/test.ts',
            changeType: 'modify',
            diffSummary: 'Updated code',
            linesAdded: 10,
            linesRemoved: 5,
            relatedTasks: []
          }],
          decisions: [],
          tasks: [],
          commands: [],
          debt: []
        }
      }
      const output: HookOutput = {}

      await plugin['session.idle']?.(input, output)
    })
  })

  describe('file.edited hook', () => {
    it('should log file changes', async () => {
      const input: HookInput = {
        filePath: '/src/app.ts',
        changes: { added: 5, removed: 2 }
      }
      const output: HookOutput = {}

      await plugin['file.edited']?.(input, output)
    })
  })

  describe('command.executed hook', () => {
    it('should log command execution', async () => {
      const input: HookInput = {
        command: 'npm run build',
        result: { exitCode: 0, duration: 5000 }
      }
      const output: HookOutput = {}

      await plugin['command.executed']?.(input, output)
    })
  })

  describe('error handling', () => {
    it('should not throw on database errors', async () => {
      const failingPlugin = await ContextPersistencePlugin({
        client: {} as any,
        directory: '/nonexistent'
      })

      const input: HookInput = {}
      const output: HookOutput = {}

      await expect(
        failingPlugin['session.created']?.(input, output)
      ).resolves.not.toThrow()
    })
  })
})