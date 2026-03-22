import type { 
  LLMProvider, 
  ExtractionResult, 
  LLMMessage,
  ContextType,
  Severity
} from '../types/index.js'

export type ExtractionContext = 'message' | 'error' | 'command_result' | 'file_diff' | 'session_summary'

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The decision text - what was decided' },
          rationale: { type: 'string', description: 'Why this decision was made' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['content', 'confidence']
      }
    },
    architecture: {
      type: 'array', 
      items: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Architecture description - system design, component relationships' },
          description: { type: 'string', description: 'Additional technical details' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['content', 'confidence']
      }
    },
    technicalDebt: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          issue: { type: 'string', description: 'What the debt issue is' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          reason: { type: 'string', description: 'Why this is problematic' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['issue', 'severity', 'reason', 'confidence']
      }
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Task description - what needs to be done' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'blocked'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['content', 'status', 'confidence']
      }
    },
    fileChanges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Summary of what changed' },
          filePath: { type: 'string', description: 'File path if mentioned' },
          changeType: { type: 'string', enum: ['create', 'modify', 'delete'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['summary', 'changeType', 'confidence']
      }
    }
  }
}

const EXTRACTION_PROMPTS: Record<ExtractionContext, string> = {
  message: `You are a context extraction specialist for an AI coding assistant session.

Analyze the conversation/response and extract:

1. DECISIONS - Architectural choices, library selections, pattern decisions, "we will use X because Y", explicit decisions made
2. ARCHITECTURE - System design mentions, component relationships, data flow descriptions, "the system uses X to do Y"
3. TECHNICAL DEBT - Performance concerns, security issues, maintainability problems, code smells, known bugs
4. TASKS - Explicit todo items, planned features, work to be done, "need to", "should", "will implement"
5. FILE CHANGES - Any mentions of files being created/modified/deleted, import changes, refactoring

Be specific and concise. Only extract items with confidence >= 0.7.

If no items of a certain type are found, return an empty array for that type.`,

  error: `You are a technical debt analyst for an AI coding assistant.

Analyze this error and extract:

1. What specifically went wrong (the technical issue)
2. The likely root cause (code bug, config issue, dependency problem, etc.)
3. Recommended fix approach
4. Severity assessment:
   - low: Minor issue, cosmetic or edge case
   - medium: Functional issue affecting some users
   - high: Major functionality broken, security concern
   - critical: Data loss risk, security vulnerability, complete failure

Be specific about the technical details. Return empty arrays for types not applicable.`,

  command_result: `You are a devops analyst for an AI coding assistant session.

Analyze this command execution output and extract:

1. What the command accomplished (summary)
2. Any significant outputs, results, or side effects
3. Whether it succeeded or failed
4. Any notable patterns (installed packages, file created, errors, etc.)
5. Any follow-up actions needed based on the output

Be concise and focus on developer-relevant information.`,

  file_diff: `You are a code change analyst for an AI coding assistant session.

Analyze this file change/diff and extract:

1. A concise summary of what changed (1-2 sentences)
2. The nature of the change:
   - feature: Adding new functionality
   - bugfix: Fixing an existing issue
   - refactor: Improving code structure without behavior change
   - chore: Maintenance, dependencies, config
   - docs: Documentation changes
3. Any notable patterns or concerns (performance, security, maintainability)
4. Any mentioned file paths

Be brief and focus on the intent and impact of the change.`,

  session_summary: `You are a session summarizer for an AI coding assistant.

Analyze this session summary and extract for long-term memory:

1. KEY DECISIONS - Major architectural choices, library selections, pattern adoptions
2. ARCHITECTURE - System design elements that should be remembered
3. TECHNICAL DEBT - Issues identified or created during the session
4. TASKS - Work completed and work remaining
5. FILE CHANGES - Summary of files modified

This context will be stored in a vector database and used to provide context in future sessions.
Focus on information that would be valuable to know in future coding sessions.`
}

export class SemanticExtractor {
  private llm: LLMProvider
  private confidenceThreshold: number

  constructor(llm: LLMProvider, confidenceThreshold: number = 0.7) {
    this.llm = llm
    this.confidenceThreshold = confidenceThreshold
  }

  async extract(
    content: string, 
    context: ExtractionContext,
    options?: { additionalContext?: string }
  ): Promise<ExtractionResult> {
    if (!content || content.trim().length < 20) {
      return this.emptyResult()
    }

    const prompt = EXTRACTION_PROMPTS[context]
    const userContent = options?.additionalContext 
      ? `${content}\n\nAdditional context: ${options.additionalContext}`
      : content

    const messages: LLMMessage[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: userContent }
    ]

    try {
      const result = await this.llm.completeStructured<ExtractionResult>(
        messages,
        EXTRACTION_SCHEMA,
        { temperature: 0.1, maxTokens: 4096, retries: 2 }
      )

      return this.filterByConfidence(result, this.confidenceThreshold)
    } catch (error) {
      console.error('Semantic extraction failed:', error)
      return this.emptyResult()
    }
  }

  async extractDecisions(content: string): Promise<ExtractionResult['decisions']> {
    const result = await this.extract(content, 'message')
    return result.decisions
  }

  async extractArchitecture(content: string): Promise<ExtractionResult['architecture']> {
    const result = await this.extract(content, 'message')
    return result.architecture
  }

  async extractTechnicalDebt(error: string, context?: string): Promise<ExtractionResult['technicalDebt']> {
    const result = await this.extract(error, 'error', { additionalContext: context })
    return result.technicalDebt
  }

  async extractFromCommand(
    command: string, 
    output?: string
  ): Promise<ExtractionResult> {
    const content = output ? `${command}\n\nOutput: ${output}` : command
    return this.extract(content, 'command_result')
  }

  async extractFromFileDiff(diff: string): Promise<ExtractionResult> {
    return this.extract(diff, 'file_diff')
  }

  async summarizeSession(summary: string): Promise<ExtractionResult> {
    return this.extract(summary, 'session_summary')
  }

  private filterByConfidence(result: ExtractionResult, threshold: number): ExtractionResult {
    return {
      decisions: result.decisions.filter(d => d.confidence >= threshold),
      architecture: result.architecture.filter(a => a.confidence >= threshold),
      technicalDebt: result.technicalDebt.filter(t => t.confidence >= threshold),
      tasks: result.tasks.filter(t => t.confidence >= threshold),
      fileChanges: result.fileChanges.filter(f => f.confidence >= threshold)
    }
  }

  private emptyResult(): ExtractionResult {
    return {
      decisions: [],
      architecture: [],
      technicalDebt: [],
      tasks: [],
      fileChanges: []
    }
  }
}

export function createSemanticExtractor(llm: LLMProvider, confidenceThreshold?: number): SemanticExtractor {
  return new SemanticExtractor(llm, confidenceThreshold)
}

export function extractionResultToContextRecords(
  result: ExtractionResult,
  _sessionId: string,
  _projectId: string,
  contentHash: string
): Array<{ type: ContextType; content: string; metadata: Record<string, unknown>; salience: number }> {
  const records: Array<{ type: ContextType; content: string; metadata: Record<string, unknown>; salience: number }> = []

  for (const decision of result.decisions) {
    records.push({
      type: 'decision',
      content: decision.content,
      metadata: { rationale: decision.rationale, confidence: decision.confidence, sourceHash: contentHash },
      salience: decision.confidence
    })
  }

  for (const arch of result.architecture) {
    records.push({
      type: 'architecture',
      content: arch.content,
      metadata: { description: arch.description, confidence: arch.confidence, sourceHash: contentHash },
      salience: arch.confidence
    })
  }

  const severityWeight: Record<Severity, number> = { low: 0.5, medium: 0.7, high: 0.85, critical: 1.0 }
  for (const debt of result.technicalDebt) {
    records.push({
      type: 'debt',
      content: `${debt.issue} - ${debt.reason}`,
      metadata: { severity: debt.severity, confidence: debt.confidence, sourceHash: contentHash },
      salience: severityWeight[debt.severity] * debt.confidence
    })
  }

  for (const task of result.tasks) {
    records.push({
      type: 'task',
      content: task.content,
      metadata: { status: task.status, confidence: task.confidence, sourceHash: contentHash },
      salience: task.confidence
    })
  }

  for (const change of result.fileChanges) {
    records.push({
      type: 'file_change',
      content: change.summary,
      metadata: { 
        filePath: change.filePath, 
        changeType: change.changeType, 
        confidence: change.confidence,
        sourceHash: contentHash 
      },
      salience: change.confidence * 0.8
    })
  }

  return records
}
