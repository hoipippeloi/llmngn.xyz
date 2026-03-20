import { beforeAll, afterAll } from 'vitest'
import { mkdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

let testDir: string

beforeAll(async () => {
  testDir = join(tmpdir(), `context-persistence-test-${Date.now()}`)
  await mkdir(testDir, { recursive: true })
  process.env.TEST_DIR = testDir
})

afterAll(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true })
  }
})