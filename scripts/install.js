#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = 'hoipippeloi/llmngn.xyz'
const BRANCH = 'main'

const FILES = [
  '.opencode/plugins/llmngn.ts',
  '.opencode/plugins/llmngn.json',
  '.opencode/package.json',
  '.opencode/commands/llmngn.md'
]

async function downloadFile(url, dest) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`)
  const content = await response.text()
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, content)
}

async function install() {
  console.log('Installing LLMNGN...\n')

  const projectDir = process.cwd()
  const baseUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`

  for (const file of FILES) {
    const url = baseUrl + file
    const dest = path.join(projectDir, file)
    console.log(`Downloading ${file}...`)
    await downloadFile(url, dest)
  }

  console.log('\nInstalling dependencies...')
  try {
    execSync('cd .opencode && bun install && cd ..', { stdio: 'inherit' })
  } catch {
    console.log('Bun not found, trying npm...')
    try {
      execSync('cd .opencode && npm install && cd ..', { stdio: 'inherit' })
    } catch (e) {
      console.error('Failed to install dependencies. Please run: cd .opencode && npm install')
    }
  }

  console.log('\n✅ LLMNGN installed successfully!')
  console.log('\nNext steps:')
  console.log('1. Start OpenCode in this directory')
  console.log('2. The plugin will auto-load')
  console.log('\nFor CLI usage, run from this repo:')
  console.log('  npm link')
  console.log('  llmngn --help')
}

install().catch(e => {
  console.error('Installation failed:', e.message)
  process.exit(1)
})
