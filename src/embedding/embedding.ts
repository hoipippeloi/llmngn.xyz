import type { EmbeddingProvider, EmbeddingResponse } from '../types/index.js'

interface CloudConfig {
  model: string
  apiKey: string
  endpoint?: string
}

interface LocalConfig {
  model: string
  cacheDir?: string
}

const DEFAULT_EMBEDDING_DIMENSION = 768

interface EmbeddingAPIResponse {
  data: Array<{ embedding: number[] }>
  model: string
  usage: { total_tokens: number }
}

export class CloudEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'cloud'
  private config: CloudConfig

  constructor(config: CloudConfig) {
    this.config = config
  }

  async encode(text: string): Promise<EmbeddingResponse> {
    if (!this.config.apiKey) {
      throw new Error('API key is required for cloud embedding provider')
    }

    const endpoint = this.config.endpoint ?? 'https://api.openai.com/v1/embeddings'
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text
      })
    })

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as EmbeddingAPIResponse
    
    return {
      vector: data.data[0]!.embedding,
      model: data.model,
      tokens: data.usage.total_tokens
    }
  }

  async encodeBatch(texts: string[]): Promise<EmbeddingResponse[]> {
    if (!this.config.apiKey) {
      throw new Error('API key is required for cloud embedding provider')
    }

    const endpoint = this.config.endpoint ?? 'https://api.openai.com/v1/embeddings'
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts
      })
    })

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as EmbeddingAPIResponse
    
    return data.data.map((item, index) => ({
      vector: item.embedding,
      model: data.model,
      tokens: index === 0 ? data.usage.total_tokens : 0
    }))
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false
    }
    
    try {
      const testVector = await this.encode('test')
      return testVector.vector.length > 0
    } catch {
      return false
    }
  }
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'local'
  private config: LocalConfig
  private cache: Map<string, number[]> = new Map()

  constructor(config: LocalConfig) {
    this.config = config
  }

  async encode(text: string): Promise<EmbeddingResponse> {
    const cacheKey = this.hashText(text)
    
    if (this.cache.has(cacheKey)) {
      return {
        vector: this.cache.get(cacheKey)!,
        model: this.config.model,
        tokens: 0
      }
    }

    const vector = this.generateSimpleEmbedding(text)
    this.cache.set(cacheKey, vector)
    
    return {
      vector,
      model: this.config.model,
      tokens: this.estimateTokens(text)
    }
  }

  async encodeBatch(texts: string[]): Promise<EmbeddingResponse[]> {
    return Promise.all(texts.map(text => this.encode(text)))
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  private hashText(text: string): string {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(16)
  }

  private generateSimpleEmbedding(text: string): number[] {
    const vector = new Array(DEFAULT_EMBEDDING_DIMENSION).fill(0)
    const words = text.toLowerCase().split(/\s+/)
    
    for (const word of words) {
      const hash = this.simpleHash(word)
      const index = Math.abs(hash % DEFAULT_EMBEDDING_DIMENSION)
      vector[index] += 1 / words.length
    }
    
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1
    return vector.map(v => v / magnitude)
  }

  private simpleHash(str: string): number {
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i)
    }
    return hash
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}

export function createEmbeddingProvider(config: { 
  provider: 'cloud' | 'local'
  model: string
  apiKey?: string 
}): EmbeddingProvider {
  if (config.provider === 'cloud') {
    return new CloudEmbeddingProvider({
      model: config.model,
      apiKey: config.apiKey ?? ''
    })
  }
  
  return new LocalEmbeddingProvider({
    model: config.model
  })
}