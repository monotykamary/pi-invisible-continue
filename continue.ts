import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  CONTINUE_CUSTOM_TYPE,
  CONTINUE_COMMAND_DESCRIPTION,
  getLastAssistantMessageText,
} from "./src/index.js";

/**
 * pi-invisible-continue — resume the agentic loop without the LLM seeing any new prompt.
 *
 * Strategy:
 *   - /continue command calls pi.sendMessage() with a custom-type message
 *   - Default convertToLlm filters to user/assistant/toolResult only → custom message stripped
 *   - LLM receives unchanged context, loops naturally as if agent.continue() were called
 *   - Session gets one hidden entry (customType: "continue", display: false)
 *
 * Cleaner than any existing package: no "continue" user-message pollution, no handoff doc,
 * no retry text.  The LLM never sees a new message.
 */

export default function (pi: ExtensionAPI) {
  pi.registerCommand("continue", {
    description: CONTINUE_COMMAND_DESCRIPTION,
    handler: async (args, ctx) => {
      await runContinueCommand(pi, ctx, args);
    },
  });

  // Strip hidden continue markers from context before each LLM call.
  // This is insurance — convertToLlm already filters custom roles, but a
  // custom convertToLlm override could leak them.  Clean proactively.
  pi.on("context", async (event) => {
    const cleaned = event.messages.filter(
      (msg: any) =>
        !(msg.role === "custom" && msg.customType === CONTINUE_CUSTOM_TYPE),
    );
    if (cleaned.length !== event.messages.length) {
      return { messages: cleaned };
    }
  });
}

async function runContinueCommand(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  args: string,
): Promise<void> {
  // ---- subcommand: status -------------------------------------------------
  if (args.trim().toLowerCase() === "status") {
    const last = getLastAssistantMessageText(ctx.sessionManager.getEntries());
    const idle = ctx.isIdle();
    ctx.ui.notify(
      [
        "pi-invisible-continue status:",
        `  Agent idle: ${idle ? "yes" : "no"}`,
        `  Last assistant: ${last ?? "(none)"}`.slice(0, 120),
      ].join("\n"),
      "info",
    );
    return;
  }

  // ---- subcommand: help ---------------------------------------------------
  if (args.trim().toLowerCase() === "help") {
    ctx.ui.notify(
      [
        "pi-invisible-continue  /continue     Resume loop invisibly",
        "                        /continue status  Show diagnostics",
        "                        /continue help    This message",
      ].join("\n"),
      "info",
    );
    return;
  }

  // ---- main: fire invisible continue --------------------------------------
  if (!ctx.isIdle()) {
    await ctx.waitForIdle();
  }

  pi.sendMessage(
    {
      customType: CONTINUE_CUSTOM_TYPE,
      content: "",
      display: false,
      details: {},
    },
    { triggerTurn: true },
  );
}