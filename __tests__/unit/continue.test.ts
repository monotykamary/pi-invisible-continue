import { describe, it, expect } from "vitest";
import { getLastAssistantMessageText } from "../../src/index.js";
import {
  describeConstants,
  makeAssistantEntry,
  makeUserEntry,
  makeCustomEntry,
} from "../helpers.js";

/** Shared constant / command-description checks. */
describe("constants", describeConstants);

/** Session introspection (getLastAssistantMessageText). */
describe("getLastAssistantMessageText", () => {
  it("returns undefined for an empty list", () => {
    expect(getLastAssistantMessageText([])).toBeUndefined();
  });

  it("returns the text of the last assistant message", () => {
    const entries = [
      makeUserEntry("hello"),
      makeAssistantEntry("world"),
      makeUserEntry("how are you"),
      makeAssistantEntry("fine thanks"),
    ];
    expect(getLastAssistantMessageText(entries)).toBe("fine thanks");
  });

  it("skips non-message entries", () => {
    const entries = [
      makeAssistantEntry("one"),
      { type: "compaction", id: "123" },
      makeAssistantEntry("two"),
    ] as any[];
    expect(getLastAssistantMessageText(entries)).toBe("two");
  });

  it("returns undefined when no assistant message exists", () => {
    const entries = [
      makeUserEntry("a"),
      makeCustomEntry("__other", "x"),
      { type: "session", version: 1 },
    ] as any[];
    expect(getLastAssistantMessageText(entries)).toBeUndefined();
  });

  it("skips custom-role messages with the continue marker", () => {
    const entries = [
      makeAssistantEntry("real response"),
      makeCustomEntry("__invisible_continue", ""),
    ] as any[];
    // The helper only looks at assistant messages — the custom entry is ignored.
    expect(getLastAssistantMessageText(entries)).toBe("real response");
  });

  it("returns undefined when the last assistant has no text content", () => {
    const entries = [
      makeUserEntry("hello"),
      {
        type: "message",
        message: {
          role: "assistant",
          content: [{ type: "image", source: { type: "base64", data: "abc" } }],
        },
      },
    ] as any[];
    expect(getLastAssistantMessageText(entries)).toBeUndefined();
  });
});