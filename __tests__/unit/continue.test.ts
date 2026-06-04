import { describe, it, expect } from "vitest";
import { getLastAssistantMessageText } from "../../src/index.js";
import {
  describeConstants,
  makeAssistantEntry,
  makeUserEntry,
} from "../helpers.js";

/** Shared constant checks. */
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
      { type: "session", version: 1 },
    ] as any[];
    expect(getLastAssistantMessageText(entries)).toBeUndefined();
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
