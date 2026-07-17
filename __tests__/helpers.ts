import { CONTINUE_COMMAND_DESCRIPTION } from "../src/index.js";

/**
 * Minimal test helpers.
 *
 * Since pi-invisible-continue is intentionally small, the test surface
 * is focused on the shared constants and the session introspection helper.
 *
 * The command transport and context filtering are covered by the unit suite;
 * end-to-end provider behavior is exercised in Pi integration sessions.
 */

export interface MockSessionEntry {
  type: string;
  message?: {
    role?: string;
    content?: unknown;
  };
}

export function makeAssistantEntry(
  text: string,
): MockSessionEntry {
  return {
    type: "message",
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
    },
  };
}

export function makeUserEntry(
  text: string,
): MockSessionEntry {
  return {
    type: "message",
    message: {
      role: "user",
      content: [{ type: "text", text }],
    },
  };
}

export function describeConstants(): void {
  it("exports a sensible command description", () => {
    expect(CONTINUE_COMMAND_DESCRIPTION).toBe(
      "Resume the agentic loop without sending a prompt the LLM can read",
    );
  });
}
