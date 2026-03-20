import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Export OpenMemory knowledge graph to timestamped JSON and Mermaid files",
  args: {
    user_id: tool.schema.string().describe("User ID to query memories for (default: 'default')"),
    query: tool.schema.string().optional().describe("Optional query to filter memories (default: retrieves all recent memories)"),
    limit: tool.schema.number().optional().describe("Maximum number of memories to retrieve (default: 100)"),
    outputDir: tool.schema.string().optional().describe("Output directory path (default: './knowledge-graphs')")
  },
  async execute(args) {
    const userId = args.user_id || "default"
    const query = args.query || ""
    const limit = args.limit || 100
    const outputDir = args.outputDir || "./knowledge-graphs"

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
      const folderName = `kg-${timestamp}`
      const folderPath = `${outputDir}/${folderName}`

      await Bun.$`mkdir -p ${folderPath}`.quiet()

      const memories = []
      const batchSize = 50
      const batches = Math.ceil(limit / batchSize)

      for (let i = 0; i < batches; i++) {
        const currentBatch = Math.min(batchSize, limit - (i * batchSize))
        const queryBody = JSON.stringify({
          query: query || "all memories",
          k: currentBatch,
          user_id: userId,
          type: "contextual"
        })

        const response = await fetch("https://openmemory-production-f483.up.railway.app/memory/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: queryBody
        })

        if (!response.ok) {
          throw new Error(`OpenMemory API error: ${response.statusText}`)
        }

        const data = await response.json()
        if (data.matches && Array.isArray(data.matches)) {
          memories.push(...data.matches)
        }
      }

      const uniqueMemories = Array.from(
        new Map(memories.map(m => [m.id, m])).values()
      ).slice(0, limit)

      const sectors: Record<string, number> = {}
      const nodes = uniqueMemories.map((mem: any) => {
        const sector = mem.primary_sector || "semantic"
        sectors[sector] = (sectors[sector] || 0) + 1
        return {
          id: mem.id,
          content: mem.content,
          sector: sector,
          salience: mem.salience || 0,
          tags: mem.tags || [],
          timestamp: mem.last_seen_at || new Date().toISOString()
        }
      })

      const edges: any[] = []
      nodes.forEach((node: any) => {
        if (node.associations && Array.isArray(node.associations)) {
          node.associations.forEach((assocId: string) => {
            if (nodes.find((n: any) => n.id === assocId)) {
              edges.push({
                from: node.id,
                to: assocId,
                type: "associated"
              })
            }
          })
        }
      })

      const graph = {
        metadata: {
          generatedAt: timestamp,
          totalMemories: nodes.length,
          sectors: sectors
        },
        nodes: nodes,
        edges: edges
      }

      const json = JSON.stringify(graph, null, 2)

      let mermaid = `graph TD\n`
      mermaid += `    Start[Knowledge Graph - ${timestamp}]\n\n`

      const nodeMap: Record<string, string> = {}
      const sectorColors: Record<string, string> = {
        episodic: "#FF6B6B",
        semantic: "#4ECDC4",
        procedural: "#45B7D1",
        emotional: "#FFA07A",
        reflective: "#98D8C8"
      }

      graph.nodes.forEach((node: any, index: number) => {
        const nodeId = `M${index}`
        nodeMap[node.id] = nodeId
        const label = node.content.substring(0, 30).replace(/"/g, "'")
        mermaid += `    ${nodeId}["${label}"]:::${node.sector}\n`
      })

      mermaid += `\n`
      graph.edges.forEach((edge: any) => {
        const fromNode = nodeMap[edge.from]
        const toNode = nodeMap[edge.to]
        if (fromNode && toNode) {
          mermaid += `    ${fromNode} -->|${edge.type}| ${toNode}\n`
        }
      })

      mermaid += `\n    classDef episodic fill:#FF6B6B,stroke:#333,color:#fff\n`
      mermaid += `    classDef semantic fill:#4ECDC4,stroke:#333,color:#fff\n`
      mermaid += `    classDef procedural fill:#45B7D1,stroke:#333,color:#fff\n`
      mermaid += `    classDef emotional fill:#FFA07A,stroke:#333,color:#fff\n`
      mermaid += `    classDef reflective fill:#98D8C8,stroke:#333,color:#fff\n\n`

      const sectorNodes: Record<string, string[]> = { episodic: [], semantic: [], procedural: [], emotional: [], reflective: [] }
      graph.nodes.forEach((node: any, index: number) => {
        if (sectorNodes[node.sector]) {
          sectorNodes[node.sector].push(`M${index}`)
        }
      })

      Object.entries(sectorNodes).forEach(([sector, nodes]) => {
        if (nodes.length > 0) {
          mermaid += `    class ${nodes.join(",")} ${sector}\n`
        }
      })

      const jsonPath = `${folderPath}/knowledge-graph.json`
      await Bun.write(jsonPath, json)

      const mermaidPath = `${folderPath}/knowledge-graph.mmd`
      await Bun.write(mermaidPath, mermaid)

      return `Knowledge graph exported successfully!\n\nFolder: ${folderPath}\n\nFiles:\n- ${jsonPath}\n- ${mermaidPath}\n\nTotal nodes: ${nodes.length}\nTotal edges: ${edges.length}\n\nSectors:\n${Object.entries(sectors).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`
    } catch (error) {
      return `Error: ${error.message}`
    }
  }
})
