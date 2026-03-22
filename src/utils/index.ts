export { ConfigManager } from './config.js'

import type { CompletionMetadata } from '../types/index.js'

const COMPLETION_PATTERNS: Array<{
  pattern: RegExp
  action: CompletionMetadata['action']
}> = [
  { pattern: /\b(fixed|fixes|fixed\s+the)\b/i, action: 'fixed' },
  { pattern: /\b(created|creates|added\s+new)\b/i, action: 'created' },
  { pattern: /\b(implemented|implements|implemented\s+the)\b/i, action: 'implemented' },
  { pattern: /\b(refactored|refactors|refactored\s+the)\b/i, action: 'refactored' },
  { pattern: /\b(updated|updates|modified)\b/i, action: 'updated' },
  { pattern: /\b(resolved|resolves|solved)\b/i, action: 'resolved' },
]

const CONTEXT_TARGET_PATTERNS = [
  /(?:in|at|the\s+)?file[s]?\s*[:`]?\s*([^\s,;.!\n]+)/gi,
  /(?:function|method|class|component)\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi,
  /(?:the\s+)?([a-zA-Z_][a-zA-Z0-9_/\\]*\.[a-zA-Z]{1,10})/gi,
]

export function detectCompletion(message: string): CompletionMetadata | null {
  if (!message || message.length < 10) return null

  const lowerMsg = message.toLowerCase()
  if (!lowerMsg.includes('done') && 
      !lowerMsg.includes('complete') && 
      !lowerMsg.includes('finished') &&
      !lowerMsg.includes('fixed') &&
      !lowerMsg.includes('created') &&
      !lowerMsg.includes('implemented') &&
      !lowerMsg.includes('resolved') &&
      !lowerMsg.includes('updated') &&
      !lowerMsg.includes('refactored')) {
    return null
  }

  let detectedAction: CompletionMetadata['action'] | null = null
  for (const { pattern, action } of COMPLETION_PATTERNS) {
    if (pattern.test(message)) {
      detectedAction = action
      break
    }
  }
  
  if (!detectedAction) return null

  let target = 'unknown'
  for (const pattern of CONTEXT_TARGET_PATTERNS) {
    pattern.lastIndex = 0
    const match = pattern.exec(message)
    if (match?.[1]) {
      target = match[1].replace(/[`*]/g, '').trim()
      if (target.length > 2 && target.length < 100) break
    }
  }

  const firstSentence = message.split(/[.!\n]/)[0] ?? ''
  const details = firstSentence.length > 120 
    ? firstSentence.slice(0, 117) + '...' 
    : firstSentence

  return {
    action: detectedAction,
    target,
    details: details.trim()
  }
}

export function completionToShorthand(meta: CompletionMetadata): string {
  const actionSymbol: Record<CompletionMetadata['action'], string> = {
    fixed: '✓',
    created: '+',
    implemented: '★',
    refactored: '↻',
    updated: '↑',
    resolved: '✓'
  }
  
  const symbol = actionSymbol[meta.action]
  const target = meta.target.length > 40 ? meta.target.slice(0, 37) + '...' : meta.target
  
  return `${symbol} ${meta.action}: ${target}`
}