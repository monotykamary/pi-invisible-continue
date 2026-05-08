import { CONTINUE_CUSTOM_TYPE, CONTINUE_COMMAND_DESCRIPTION } from "../src/index.js";

/**
 * Minimal test helpers.
 *
 * Since pi-invisible-continue is intentionally small, the test surface
 * is focused on the shared constants and the session introspection helper.
 *
 * Extension event handlers (the `pi.on(...)` callbacks) are integration-tested
 * by loading the extension in a real pi session.  Those tests live in the
 * monorepo's integration suite rather than here.
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

export function makeCustomEntry(
  customType: string,
  content?: string,
): MockSessionEntry {
  return {
    type: "message",
    message: {
      role: "custom",
      customType,
      content: content ?? "",
    },
  };
}

export function describeConstants(): void {
  it("exports the expected custom type", () => {
    expect(CONTINUE_CUSTOM_TYPE).toBe("__invisible_continue");
  });

  it("exports a sensible command description", () => {
    expect(CONTINUE_COMMAND_DESCRIPTION).toBe(
      "Resume the agentic loop without sending a prompt the LLM can read",
    );
  });
}