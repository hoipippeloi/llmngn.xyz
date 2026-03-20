use: .opencode\skills\te9-spec\SKILL.md to

create me a spec for:

- a cli built with https://crustjs.com/ -> https://github.com/chenxin-yan/crust
- to create a plugin for https://opencode.ai/docs/plugins/
- that hooks in before starting a session reading semantic data/info about our codebase and journalling
- so that the llm always has full context of where we are and what we are doing
- using https://github.com/lancedb/lancedb for storage and retrieval
- to work: after each session the llm needs to hook in and write all relevant context into lancedb for the next sessions to benefit from it being available
