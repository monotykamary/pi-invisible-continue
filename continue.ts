import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  CONTINUE_COMMAND_DESCRIPTION,
  getLastAssistantMessageText,
} from "./src/index.js";

/**
 * pi-invisible-continue — resume the agentic loop without the LLM seeing any new prompt.
 *
 * Strategy:
 *   - Use pi.sendMessage() with triggerTurn: true to start a new agent turn
 *   - The message uses role: "custom" which is filtered by convertToLlm(),
 *     so the LLM receives the exact same message list it had before
 *   - This goes through AgentSession._runAgentPrompt, so auto-compaction,
 *     auto-retry, and other session lifecycle features work correctly
 *   - No prototype monkey-patching needed — no fragile Agent import, no
 *     module duplication issues
 *
 * Why not agent.prompt([])?
 *   The previous approach monkey-patched Agent.prototype.subscribe to capture
 *   the Agent instance, then called agent.prompt([]) directly. This broke when
 *   the extension's import of Agent resolved to a different class (from the
 *   package's own node_modules/@earendil-works/pi-agent-core@0.75.4) than the
 *   one AgentSession uses (from pi's bundled 0.79.1). The subscribe patch was
 *   applied to the wrong prototype, so the agent was never captured.
 *
 *   The new approach avoids this entirely by using the extension API's
 *   sendMessage() with triggerTurn: true, which is resolved at runtime by the
 *   AgentSession and doesn't depend on importing Agent at all.
 */

// Mutex: only one invisible continue may be in-flight at a time.
let _continueInProgress = false;

export default function (pi: ExtensionAPI) {
  pi.registerCommand("continue", {
    description: CONTINUE_COMMAND_DESCRIPTION,
    handler: async (args, ctx) => {
      await runContinueCommand(pi, ctx, args);
    },
  });

  pi.on("session_start", () => {
    _continueInProgress = false;
  });
}

async function runContinueCommand(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  args: string,
): Promise<void> {
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

  if (!ctx.isIdle()) {
    await ctx.waitForIdle();
  }

  // Guard: if pi-retry or pi-vcc already has an invisible continue in-flight,
  // skip — their triggerTurn will resume the loop.
  if (_continueInProgress) {
    ctx.ui.notify(
      "pi-invisible-continue: Another invisible continue is already in progress.",
      "info",
    );
    return;
  }
  _continueInProgress = true;

  try {
    // Send an invisible custom message that triggers a new agent turn.
    // convertToLlm() filters role:"custom" messages, so the LLM sees
    // the same context as before — no injected prompt.
    pi.sendMessage(
      { customType: "pi-invisible-continue", content: "", display: false, details: undefined },
      { triggerTurn: true },
    );

    // Wait for the triggered turn (and any post-run continuations like
    // auto-compaction and auto-retry) to complete.
    await ctx.waitForIdle();
  } catch {
    // Agent is already processing — something else is driving.
  } finally {
    _continueInProgress = false;
  }
}
