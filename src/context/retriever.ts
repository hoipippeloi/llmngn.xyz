import type { LanceDBClient } from '../database/client.js'
import type { EmbeddingProvider, ContextRecord, SearchResult, PluginConfig, ContextType } from '../types/index.js'

export interface RetrieveOptions {
  projectId: string
  intent?: string
  types?: ContextType[]
  limit?: number
}

export class ContextRetriever {
  private db: LanceDBClient
  private embedder: EmbeddingProvider
  private config: PluginConfig

  constructor(db: LanceDBClient, embedder: EmbeddingProvider, config: PluginConfig) {
    this.db = db
    this.embedder = embedder
    this.config = config
  }

  async retrieve(query: string, options: RetrieveOptions): Promise<SearchResult[]> {
    const embeddingResponse = await this.embedder.encode(options.intent ?? query)
    const queryVector = embeddingResponse.vector

    const records = await this.db.query(queryVector, {
      limit: options.limit ?? 50,
      projectId: options.projectId,
      types: options.types,
      since: new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000).toISOString()
    })

    const results = records.map(record => this.scoreRecord(record, queryVector))

    results.sort((a, b) => b.weightedScore - a.weightedScore)

    const truncated = this.truncateToTokenLimit(results, this.config.maxContextTokens)

    return truncated
  }

  private scoreRecord(record: ContextRecord, queryVector: number[]): SearchResult {
    const similarity = this.cosineSimilarity(record.vector, queryVector)
    const recency = this.calculateRecency(record.createdAt)
    const weight = this.config.weights[record.contextType] ?? 0.5
    const salience = record.salience

    const score = weight * similarity * recency * salience

    return {
      record,
      score,
      similarity,
      recency,
      weightedScore: score
    }
  }

  calculateScore(record: ContextRecord, queryVector: number[], weights: Record<string, number>): number {
    const similarity = this.cosineSimilarity(record.vector, queryVector)
    const recency = this.calculateRecency(record.createdAt)
    const weight = weights[record.contextType] ?? 0.5
    const salience = record.salience

    return weight * similarity * recency * salience
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0
      const bVal = b[i] ?? 0
      dotProduct += aVal * bVal
      normA += aVal * aVal
      normB += bVal * bVal
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator === 0 ? 0 : dotProduct / denominator
  }

  private calculateRecency(createdAt: string): number {
    const ageMs = Date.now() - new Date(createdAt).getTime()
    const ageDays = ageMs / (24 * 60 * 60 * 1000)
    return Math.pow(this.config.salienceDecay, ageDays)
  }

  private truncateToTokenLimit(results: SearchResult[], maxTokens: number): SearchResult[] {
    const sorted = [...results].sort((a, b) => b.weightedScore - a.weightedScore)
    const truncated: SearchResult[] = []
    let tokenCount = 0

    for (const result of sorted) {
      const tokens = this.countTokens(result.record.content)
      if (tokenCount + tokens <= maxTokens) {
        truncated.push(result)
        tokenCount += tokens
      }
    }

    return truncated
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}