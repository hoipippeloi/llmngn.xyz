# Context Persistence Plugin Specification Prompt

Use this prompt to generate a comprehensive technical specification for a context persistence system that enables LLMs to maintain continuity across coding sessions.

---

## Task: Generate Technical Specification Document

**Reference:** Use the specification template and guidelines from `.opencode\skills\te9-spec\SKILL.md` as your formatting and structural guide.

**Objective:** Create a comprehensive technical specification for a **context persistence plugin** that enables LLMs to maintain continuity across coding sessions by storing and retrieving semantic codebase information.

---

## System Components

### 1. CLI Application
- **Framework:** Build using [Crust](https://crustjs.com/) ([GitHub](https://github.com/chenxin-yan/crust))
- **Purpose:** Serve as the host application for the OpenCode plugin
- **Language:** TypeScript/Node.js
- **Distribution:** NPM package with global CLI installation

### 2. OpenCode Plugin Integration
- **Target Platform:** [OpenCode.ai](https://opencode.ai/docs/plugins/)
- **Integration Point:** Hook into the session initialization lifecycle (before session start)
- **Function:** Inject semantic context about the codebase and development journal into the LLM's working memory
- **Plugin Type:** Pre-session context injector with post-session persistence

### 3. Vector Database
- **Technology:** [LanceDB](https://github.com/lancedb/lancedb)
- **Purpose:** Persistent storage and semantic retrieval of codebase context
- **Storage Location:** Local project directory (`.lancedb` folder) or user config directory
- **Embedding Model:** Specify recommended model (e.g., `nomic-embed-text`, `text-embedding-3-small`)

---

## Relevant OpenCode Hooks/Events for Database Logging

Based on the OpenCode events reference, the following hooks are relevant for logging data to LanceDB:

### Write Path (Post-Session Persistence)

| Hook | Timing | Data to Log |
|------|--------|-------------|
| `session.idle` | When session becomes inactive | Session completion marker, final state |
| `session.compacted` | After session context compaction | Compacted summary for long-term storage |
| `file.edited` | When files are modified | File paths, change metadata |
| `command.executed` | After command execution | Commands run during session |
| `tool.execute.after` | After tool completion | Tool results and side effects |
| `message.updated` | When messages change | Conversation history, decisions made |
| `todo.updated` | When todo items change | Task tracking, completion status |

### Read Path (Pre-Session Retrieval)

| Hook | Timing | Data to Retrieve |
|------|--------|------------------|
| `session.created` | When new session starts | Inject prior session context |
| `experimental.session.compacting` | Before compaction | Inject custom context into compaction prompt |

### Recommended Implementation Pattern

```typescript
export const ContextPersistencePlugin = async ({ client, directory }) => {
  return {
    // Write Path - Capture session data
    "session.idle": async (input, output) => {
      // Persist session summary to LanceDB
      await persistSessionSummary(input.session)
    },
    
    "file.edited": async (input, output) => {
      // Log file changes incrementally
      await logFileChange(input.filePath, input.changes)
    },
    
    "tool.execute.after": async (input, output) => {
      // Capture tool execution results
      await logToolExecution(input.tool, output.result)
    },
    
    // Read Path - Inject context
    "session.created": async (input, output) => {
      // Retrieve and inject relevant context
      const context = await queryRelevantContext(directory)
      output.context.push(context)
    },
    
    "experimental.session.compacting": async (input, output) => {
      // Inject custom context before compaction
      output.context.push(await getPersistentContext())
    },
  }
}
```

### Key Considerations

1. **Incremental Logging**: Use `file.edited` and `tool.execute.after` for real-time incremental updates rather than waiting for session end
2. **Session Lifecycle**: Pair `session.created` (read) with `session.idle` (write) for complete session tracking
3. **Compaction Integration**: Use `experimental.session.compacting` to ensure context survives session compaction
4. **Error Handling**: Listen to `session.error` to log failure states and recovery attempts

---

## Functional Requirements

### Pre-Session Hook (Read Path)
1. Intercept session initialization
2. Query LanceDB for relevant semantic data about:
   - Current codebase state
   - Recent development activities
   - Ongoing tasks and their context
   - Architectural decisions and technical debt
   - File change history and modifications
3. Inject retrieved context into the LLM's system prompt or session memory
4. Gracefully handle missing or empty context (first session scenario)

### Post-Session Hook (Write Path)
1. Intercept session completion
2. Extract relevant context from the session including:
   - Code changes made
   - Decisions and rationale
   - New architectural knowledge
   - Unresolved questions or technical debt introduced
   - Files modified or created
   - Commands executed
3. Embed and persist this data into LanceDB for future sessions
4. Implement incremental updates (append new context, update existing records)

---

## Deliverables

Produce a specification document containing:

1. **Architecture Overview**
   - System diagram showing component relationships
   - Data flow between CLI, plugin, LanceDB, and LLM
   - Deployment topology

2. **Data Schema**
   - LanceDB collection/table structure
   - Field definitions with types
   - Embedding strategy (what text gets embedded vs. stored as metadata)
   - Index configuration

3. **API Design**
   - CLI commands and arguments
   - Plugin hook interfaces
   - Public methods and callbacks
   - Configuration file format (`.opencode/plugins/context-persistance.json`)

4. **Lifecycle Flow**
   - Sequence diagram for pre-session operations
   - Sequence diagram for post-session operations
   - Error recovery flows

5. **Context Taxonomy**
   - Classification of context types to store
   - Priority/weighting for different context categories
   - Retention policies (what gets pruned over time)

6. **Retrieval Strategy**
   - Query patterns and filters
   - Relevance scoring algorithm
   - Context window management (max tokens to inject)
   - Deduplication strategy

7. **Error Handling**
   - Degradation behavior when context is unavailable
   - Database corruption recovery
   - Embedding service failures
   - Rate limiting considerations

8. **Security Considerations**
   - Data isolation between projects
   - Access controls for stored context
   - Sensitive data filtering (API keys, credentials)
   - Compliance with data retention policies

---

## Acceptance Criteria

The specification must:

- [ ] Define clear integration points with OpenCode's plugin API
- [ ] Specify the exact data structure for stored context (schema with field types)
- [ ] Describe the embedding model selection with justification
- [ ] Include performance constraints:
  - Query latency target (< 500ms for context retrieval)
  - Storage size estimates per session
  - Maximum context injection size (tokens)
- [ ] Address incremental updates vs. full context replacement strategy
- [ ] Provide migration path for existing codebases adopting the plugin
- [ ] Include versioning strategy for context schema evolution
- [ ] Specify logging and observability requirements
- [ ] Define testing strategy (unit, integration, e2e)

---

## Non-Functional Requirements

### Performance
- Context retrieval must not block session start for more than 2 seconds
- Batch embedding operations for post-session writes
- Support for large codebases (10k+ files)

### Scalability
- Horizontal scaling for multiple concurrent sessions
- Partitioning strategy for multi-project setups

### Reliability
- Atomic writes to prevent partial context persistence
- Checkpoint/resume for long-running operations

### Usability
- Zero-config default behavior
- Override configuration via CLI flags
- Progress indicators for long operations

---

## Output Format

Generate the specification as a Markdown document following the structure defined in `.opencode\skills\te9-spec\SKILL.md`. Include:

- Executive summary
- Technical deep-dive sections
- Diagrams (Mermaid format for version control compatibility)
- Code snippets for key interfaces
- Example configurations
- Troubleshooting guide

---

## Constraints and Assumptions

### Constraints
- Must work within OpenCode's plugin architecture limitations
- LanceDB must run locally (no cloud dependency)
- Cannot modify OpenCode core source code
- Must support Windows, macOS, and Linux

### Assumptions
- User has Node.js 18+ installed
- OpenCode CLI is available in PATH
- Network access for embedding API (if using cloud embedding service)
- Sufficient disk space for vector database (~100MB per 1000 sessions)

---

## Evaluation Rubric

A high-quality specification will:

1. **Completeness** (40%): All deliverable sections present with sufficient detail
2. **Clarity** (25%): Unambiguous requirements and interfaces
3. **Feasibility** (20%): Implementation is realistic given constraints
4. **Extensibility** (15%): Design allows future enhancements without breaking changes

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-19 | Initial specification prompt |

---

**End of Prompt**