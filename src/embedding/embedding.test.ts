import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CloudEmbeddingProvider, LocalEmbeddingProvider } from './embedding.js'

vi.stubGlobal('fetch', vi.fn())

describe('EmbeddingProvider', () => {
  describe('CloudEmbeddingProvider', () => {
    let provider: CloudEmbeddingProvider
    
    beforeEach(() => {
      vi.clearAllMocks()
      provider = new CloudEmbeddingProvider({
        model: 'text-embedding-3-small',
        apiKey: 'test-key'
      })
    })

    it('should encode text to vector', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(768).fill(0.5) }],
          model: 'text-embedding-3-small',
          usage: { total_tokens: 10 }
        })
      } as Response)

      const result = await provider.encode('test text')
      expect(result.vector).toBeInstanceOf(Array)
      expect(result.vector.length).toBe(768)
      expect(result.model).toBe('text-embedding-3-small')
    })

    it('should encode batch of texts', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: new Array(768).fill(0.1) },
            { embedding: new Array(768).fill(0.2) },
            { embedding: new Array(768).fill(0.3) }
          ],
          model: 'text-embedding-3-small',
          usage: { total_tokens: 30 }
        })
      } as Response)

      const texts = ['text one', 'text two', 'text three']
      const results = await provider.encodeBatch(texts)
      expect(results).toHaveLength(3)
      results.forEach(r => {
        expect(r.vector.length).toBe(768)
      })
    })

    it('should check availability', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      } as Response)

      const available = await provider.isAvailable()
      expect(typeof available).toBe('boolean')
    })

    it('should throw on invalid API key', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response)

      const badProvider = new CloudEmbeddingProvider({
        model: 'text-embedding-3-small',
        apiKey: 'bad-key'
      })
      await expect(badProvider.encode('test')).rejects.toThrow()
    })
  })

  describe('LocalEmbeddingProvider', () => {
    let provider: LocalEmbeddingProvider
    
    beforeEach(() => {
      provider = new LocalEmbeddingProvider({
        model: 'nomic-embed-text'
      })
    })

    it('should encode text to vector locally', async () => {
      const result = await provider.encode('test text')
      expect(result.vector).toBeInstanceOf(Array)
      expect(result.vector.length).toBe(768)
    })

    it('should encode batch locally', async () => {
      const texts = ['text one', 'text two']
      const results = await provider.encodeBatch(texts)
      expect(results).toHaveLength(2)
    })

    it('should always be available', async () => {
      const available = await provider.isAvailable()
      expect(available).toBe(true)
    })

    it('should produce consistent vectors for same input', async () => {
      const text = 'same text input'
      const result1 = await provider.encode(text)
      const result2 = await provider.encode(text)
      expect(result1.vector).toEqual(result2.vector)
    })

    it('should produce different vectors for different inputs', async () => {
      const result1 = await provider.encode('first text')
      const result2 = await provider.encode('completely different text')
      expect(result1.vector).not.toEqual(result2.vector)
    })
  })
})
