import type { LLMProvider, LLMMessage, LLMResponse, LLMProviderType, LLMConfig } from '../types/index.js'

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai'
  private config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  async complete(
    messages: LLMMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const endpoint = this.config.endpoint ?? 'https://api.openai.com/v1/chat/completions'
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey ?? ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 2048
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    return {
      content: data.choices[0]?.message?.content ?? '',
      raw: data
    }
  }

  async completeStructured<T>(
    messages: LLMMessage[],
    schema: object,
    options?: { temperature?: number; maxTokens?: number; retries?: number }
  ): Promise<T> {
    const retries = options?.retries ?? 2
    const schemaStr = JSON.stringify(schema, null, 2)
    
    const systemWithSchema = `You are a structured data extraction specialist. 
Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
${schemaStr}

Rules:
- Output must be valid JSON
- All required fields must be present
- Confidence scores must be between 0 and 1
- Use null for optional fields when not applicable`

    const extractionMessages: LLMMessage[] = [
      { role: 'system', content: systemWithSchema },
      ...messages.slice(-3)
    ]

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.complete(extractionMessages, {
          temperature: 0.1,
          maxTokens: options?.maxTokens ?? 4096
        })

        const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim()
        return JSON.parse(cleaned) as T
      } catch (e) {
        if (attempt === retries) throw e
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }
    throw new Error('Unreachable')
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) return false
    try {
      await this.complete([{ role: 'user', content: 'test' }], { maxTokens: 5 })
      return true
    } catch {
      return false
    }
  }
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic'
  private config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  async complete(
    messages: LLMMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const endpoint = this.config.endpoint ?? 'https://api.anthropic.com/v1/messages'
    
    const systemMsg = messages.find(m => m.role === 'system')
    const otherMessages = messages.filter(m => m.role !== 'system')

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        system: systemMsg?.content,
        messages: otherMessages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 2048
      })
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as { content: Array<{ text: string }> }
    return {
      content: data.content[0]?.text ?? '',
      raw: data
    }
  }

  async completeStructured<T>(
    messages: LLMMessage[],
    schema: object,
    options?: { temperature?: number; maxTokens?: number; retries?: number }
  ): Promise<T> {
    const retries = options?.retries ?? 2
    const schemaStr = JSON.stringify(schema, null, 2)
    
    const systemWithSchema = `You are a structured data extraction specialist. 
Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
${schemaStr}

Rules:
- Output must be valid JSON
- All required fields must be present
- Confidence scores must be between 0 and 1
- Use null for optional fields when not applicable`

    const extractionMessages: LLMMessage[] = [
      { role: 'system', content: systemWithSchema },
      ...messages.slice(-3)
    ]

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.complete(extractionMessages, {
          temperature: 0.1,
          maxTokens: options?.maxTokens ?? 4096
        })

        const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim()
        return JSON.parse(cleaned) as T
      } catch (e) {
        if (attempt === retries) throw e
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }
    throw new Error('Unreachable')
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) return false
    try {
      await this.complete([{ role: 'user', content: 'test' }], { maxTokens: 5 })
      return true
    } catch {
      return false
    }
  }
}

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama'
  private config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  async complete(
    messages: LLMMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const baseUrl = this.config.endpoint ?? 'http://localhost:11434'
    
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.3,
          num_predict: options?.maxTokens ?? 2048
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as { message: { content: string } }
    return {
      content: data.message?.content ?? '',
      raw: data
    }
  }

  async completeStructured<T>(
    messages: LLMMessage[],
    schema: object,
    options?: { temperature?: number; maxTokens?: number; retries?: number }
  ): Promise<T> {
    const retries = options?.retries ?? 2
    const schemaStr = JSON.stringify(schema, null, 2)
    
    const systemWithSchema = `You are a structured data extraction specialist. 
Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
${schemaStr}

Rules:
- Output must be valid JSON
- All required fields must be present
- Confidence scores must be between 0 and 1
- Use null for optional fields when not applicable`

    const extractionMessages: LLMMessage[] = [
      { role: 'system', content: systemWithSchema },
      ...messages.slice(-3)
    ]

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.complete(extractionMessages, {
          temperature: 0.1,
          maxTokens: options?.maxTokens ?? 4096
        })

        const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim()
        return JSON.parse(cleaned) as T
      } catch (e) {
        if (attempt === retries) throw e
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }
    throw new Error('Unreachable')
  }

  async isAvailable(): Promise<boolean> {
    try {
      const baseUrl = this.config.endpoint ?? 'http://localhost:11434'
      const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
      return response.ok
    } catch {
      return false
    }
  }
}

export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config)
    case 'anthropic':
      return new AnthropicProvider(config)
    case 'ollama':
      return new OllamaProvider(config)
    case 'local':
      return new OllamaProvider({ ...config, endpoint: config.endpoint ?? 'http://localhost:11434' })
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`)
  }
}
