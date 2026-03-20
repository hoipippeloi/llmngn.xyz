import type { Plugin } from "@opencode-ai/plugin";

export const Te9InvokePlugin: Plugin = async (ctx) => {
  return {
    "session.created": async (input, output) => {
      // Force the LLM to always ask about te9 method first
      output.prompt = `You MUST start EVERY new session by calling the check_te9_usage tool to ask the user this exact question:

"Do you want to use the te9-method for this? (Yes/No)"

- If the user says "Yes", invoke the full te9 workflow: start with spec-clarify, then spec-store, spec-execute, spec-branch-commit, spec-pr-create, spec-pr-review as per AGENTS.md
- If the user says "No", skip the te9 process and work on the request normally
- Do NOT proceed with any work until you have the user's answer to this question

After getting the answer, proceed accordingly.`;
    },

    tool: {
      check_te9_usage: {
        description:
          "Present the te9 method usage question to the user. Call this FIRST for any new request.",
        execute: async (args, context) => {
          return `Do you want to use the te9-method for this? (Yes/No)

Please respond with "Yes" to follow the full te9 workflow, or "No" to work normally.`;
        },
      },
    },
  };
};
