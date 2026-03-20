import fs from "fs/promises"
import path from "path"
import type { Plugin } from "@opencode-ai/plugin"

type Fact = string

let cachedFacts: Fact[] = []
let lastFactIndex = -1

async function scanDirectory(dir: string, maxDepth = 5, currentDepth = 0): Promise<string[]> {
  const files: string[] = []
  if (currentDepth > maxDepth) return files
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!["node_modules", ".git", "dist", "build", ".next", "__pycache__", "target", "vendor"].includes(entry.name)) {
          files.push(...await scanDirectory(fullPath, maxDepth, currentDepth + 1))
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if ([".js", ".ts", ".tsx", ".jsx", ".svelte", ".vue", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp", ".md"].includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch {}
  
  return files
}

async function generateFacts(directory: string): Promise<Fact[]> {
  const facts: Fact[] = []
  
  try {
    const files = await scanDirectory(directory)
    
    for (const filePath of files.slice(0, 80)) {
      try {
        const content = await fs.readFile(filePath, "utf-8")
        const relativePath = path.relative(directory, filePath)
        const ext = path.extname(filePath)
        
        const lines = content.split("\n")
        const lineCount = lines.length
        
        if (lineCount > 100) facts.push(`"${relativePath}" is ${lineCount} lines of code`)
        if (lineCount > 500) facts.push(`"${relativePath}" is a massive ${lineCount} lines - the biggest file!`)
        
        const importMatches = content.match(/^(import|from|use|require)\s+/gm)
        if (importMatches && importMatches.length > 10) facts.push(`"${relativePath}" imports ${importMatches.length} modules`)
        
        const funcMatches = content.match(/(function\s+\w+|const\s+\w+\s*=\s*(async\s*)?\(|def\s+\w+|fn\s+\w+|func\s+\w+)/g)
        if (funcMatches && funcMatches.length > 5) facts.push(`"${relativePath}" defines ${funcMatches.length} functions`)
        
        const classMatches = content.match(/class\s+\w+/g)
        if (classMatches && classMatches.length > 2) facts.push(`"${relativePath}" has ${classMatches.length} classes`)
        
        const todoMatches = content.match(/(TODO|FIXME|HACK|XXX)/gi)
        if (todoMatches && todoMatches.length > 3) facts.push(`"${relativePath}" has ${todoMatches.length} TODOs waiting`)
        
        const asyncCount = (content.match(/async\s+/g) || []).length
        if (asyncCount > 5) facts.push(`"${relativePath}" has ${asyncCount} async functions`)
        
        if (ext === ".ts" || ext === ".tsx") {
          const typeMatches = content.match(/:\s*(string|number|boolean|any|void|never)\b/g)
          if (typeMatches && typeMatches.length > 15) facts.push(`"${relativePath}" has ${typeMatches.length} type annotations`)
        }
        
      } catch {}
    }

    const extensions: Record<string, number> = {}
    for (const f of files) {
      const ext = path.extname(f) || "no-ext"
      extensions[ext] = (extensions[ext] || 0) + 1
    }
    
    facts.push(`codebase has ${files.length} source files`)
    
    const topExt = Object.entries(extensions).sort((a, b) => b[1] - a[1])[0]
    if (topExt) facts.push(`most common file type is "${topExt[0]}" (${topExt[1]} files)`)

  } catch {
    facts.push("codebase is ready for exploration")
  }

  return facts.length > 0 ? facts : ["codebase is ready for work"]
}

function getRandomFact(): Fact {
  if (cachedFacts.length === 0) return "codebase is ready for work"
  if (cachedFacts.length === 1) return cachedFacts[0]
  
  let newIndex: number
  do {
    newIndex = Math.floor(Math.random() * cachedFacts.length)
  } while (newIndex === lastFactIndex && cachedFacts.length > 1)
  
  lastFactIndex = newIndex
  return cachedFacts[newIndex]
}

export default async ({ project, client, directory }: Parameters<Plugin>[0]) => {
  cachedFacts = await generateFacts(directory)
  
  await client.app.log({
    body: {
      service: "random-fact-plugin",
      level: "info", 
      message: `Loaded ${cachedFacts.length} codebase facts`,
    },
  })

  return {
    "experimental.chat.system.transform": async (input, output) => {
      if (cachedFacts.length === 0) {
        output.system.push(`[Codebase Fact]: No codebase facts were generated. You MUST mention this at the very start of your response, before any other content.`)
        output.system.push(`---`)
      } else {
        const fact = getRandomFact()
        output.system.push(`[Codebase Fact]: Did you know? Your ${fact}. You MUST mention this fact at the very start of your response, before any other content.`)
        output.system.push(`---`)
      }
    },
  }
}
