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

    const vector = this.generateEmbedding(text)
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

  private generateEmbedding(text: string): number[] {
    const vector = new Array(DEFAULT_EMBEDDING_DIMENSION).fill(0)
    const normalized = text.toLowerCase().trim()
    
    const features = this.extractFeatures(normalized)
    
    for (const feature of features) {
      const positions = this.hashFeature(feature)
      for (const pos of positions) {
        vector[pos] += 1
      }
    }
    
    for (let i = 0; i < 4; i++) {
      const seed = this.hashString(normalized + i.toString())
      const idx = Math.abs(seed % DEFAULT_EMBEDDING_DIMENSION)
      vector[idx] += 0.5
    }
    
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1
    return vector.map(v => v / magnitude)
  }

  private extractFeatures(text: string): string[] {
    const features: string[] = []
    
    const words = text.split(/\s+/).filter(w => w.length > 0)
    for (const word of words) {
      features.push(`w:${word}`)
    }
    
    for (let i = 0; i < text.length - 2; i++) {
      features.push(`c:${text.slice(i, i + 3)}`)
    }
    
    for (let i = 0; i < words.length - 1; i++) {
      features.push(`bw:${words[i]}_${words[i + 1]}`)
    }
    
    return features
  }

  private hashFeature(feature: string): number[] {
    const positions: number[] = []
    
    for (let i = 0; i < 3; i++) {
      const hash = this.murmurHash3(feature + i.toString())
      positions.push(Math.abs(hash) % DEFAULT_EMBEDDING_DIMENSION)
    }
    
    return positions
  }

  private murmurHash3(str: string): number {
    let h = 0xdeadbeef
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 0xcc9e2d51)
      h = (h << 15) | (h >>> 17)
      h = Math.imul(h, 0x1b873593)
    }
    h ^= str.length
    h ^= h >>> 16
    h = Math.imul(h, 0x85ebca6b)
    h ^= h >>> 13
    h = Math.imul(h, 0xc2b2ae35)
    h ^= h >>> 16
    return h >>> 0
  }

  private hashString(str: string): number {
    return this.murmurHash3(str)
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