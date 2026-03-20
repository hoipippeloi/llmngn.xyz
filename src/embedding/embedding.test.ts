import { describe, it, expect, beforeEach } from 'vitest'
import { CloudEmbeddingProvider, LocalEmbeddingProvider } from './embedding.js'

describe('EmbeddingProvider', () => {
  describe('CloudEmbeddingProvider', () => {
    let provider: CloudEmbeddingProvider
    
    beforeEach(() => {
      provider = new CloudEmbeddingProvider({
        model: 'text-embedding-3-small',
        apiKey: 'test-key'
      })
    })

    it('should encode text to vector', async () => {
      const result = await provider.encode('test text')
      expect(result.vector).toBeInstanceOf(Array)
      expect(result.vector.length).toBe(768)
      expect(result.model).toBe('text-embedding-3-small')
    })

    it('should encode batch of texts', async () => {
      const texts = ['text one', 'text two', 'text three']
      const results = await provider.encodeBatch(texts)
      expect(results).toHaveLength(3)
      results.forEach(r => {
        expect(r.vector.length).toBe(768)
      })
    })

    it('should check availability', async () => {
      const available = await provider.isAvailable()
      expect(typeof available).toBe('boolean')
    })

    it('should throw on invalid API key', async () => {
      const badProvider = new CloudEmbeddingProvider({
        model: 'text-embedding-3-small',
        apiKey: ''
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
  })
})