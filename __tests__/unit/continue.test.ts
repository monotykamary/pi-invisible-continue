import { describe, it, expect, vi } from "vitest";
import invisibleContinueExtension from "../../continue.js";
import {
  getLastAssistantMessageText,
  INVISIBLE_CONTINUE_CUSTOM_TYPE,
  isInvisibleContinueMarker,
} from "../../src/index.js";
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

describe("AgentSession-safe continuation", () => {
  function setup() {
    const handlers: Record<string, Array<(event: any, ctx: any) => any>> = {};
    const commands: Record<string, { handler: (args: string, ctx: any) => Promise<void> }> = {};
    const sendMessage = vi.fn();
    const pi = {
      on(event: string, handler: (event: any, ctx: any) => any) {
        (handlers[event] ??= []).push(handler);
      },
      registerCommand(name: string, command: typeof commands[string]) {
        commands[name] = command;
      },
      sendMessage,
    };

    invisibleContinueExtension(pi as any);
    return { handlers, commands, sendMessage };
  }

  it("recognizes only its hidden continuation marker", () => {
    expect(
      isInvisibleContinueMarker({
        role: "custom",
        customType: INVISIBLE_CONTINUE_CUSTOM_TYPE,
      }),
    ).toBe(true);
    expect(isInvisibleContinueMarker({ role: "user", customType: INVISIBLE_CONTINUE_CUSTOM_TYPE })).toBe(false);
    expect(isInvisibleContinueMarker({ role: "custom", customType: "other" })).toBe(false);
  });

  it("removes the marker before provider context conversion", () => {
    const { handlers } = setup();
    const user = { role: "user", content: [{ type: "text", text: "work" }] };
    const marker = {
      role: "custom",
      customType: INVISIBLE_CONTINUE_CUSTOM_TYPE,
      content: [],
    };

    expect(handlers.context[0]({ messages: [user, marker] }, {})).toEqual({ messages: [user] });
  });

  it("always uses follow-up delivery without a stale isIdle decision", async () => {
    const { commands, sendMessage } = setup();
    const waitForIdle = vi.fn();
    const ctx = {
      isIdle: () => false,
      waitForIdle,
      sessionManager: { getEntries: () => [] },
      ui: { notify: vi.fn() },
    };

    await commands.continue.handler("", ctx);

    expect(waitForIdle).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      {
        customType: INVISIBLE_CONTINUE_CUSTOM_TYPE,
        content: [],
        display: false,
        details: undefined,
      },
      { triggerTurn: true, deliverAs: "followUp" },
    );
  });
});
