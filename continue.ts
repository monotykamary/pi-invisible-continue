import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Agent } from "@earendil-works/pi-agent-core";
import {
  CONTINUE_COMMAND_DESCRIPTION,
  getLastAssistantMessageText,
} from "./src/index.js";

/**
 * pi-invisible-continue — resume the agentic loop without the LLM seeing any new prompt.
 *
 * Strategy:
 *   - Monkey-patch Agent.prototype.prompt to capture the Agent instance
 *   - /continue calls agent.prompt([]) directly, starting a fresh agent loop
 *     with an empty prompt — no message is injected into context at all
 *   - The LLM receives the exact same message list it had before
 *   - No session JSONL artifact, no convertToLlm involvement, no filter needed
 *
 * This bypasses AgentSession._runAgentPrompt, so auto-compaction is not
 * triggered after a manual /continue. Auto-retry is not a concern — pi-retry
 * covers that gap via its agent_end handler, which still fires because the
 * agent's processEvents propagates to AgentSession's subscriber normally.
 */

// Capture the live Agent instance when AgentSession subscribes to it.
// subscribe() is called during AgentSession construction — fires on both
// fresh sessions and session resumes, unlike prompt().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _agent: Agent | null = null;
const _origSubscribe = Agent.prototype.subscribe as (this: Agent, ...args: any[]) => any;
Agent.prototype.subscribe = function (this: Agent, ...args: any[]) {
  _agent = this;
  return _origSubscribe.apply(this, args);
};

export default function (pi: ExtensionAPI) {
  pi.registerCommand("continue", {
    description: CONTINUE_COMMAND_DESCRIPTION,
    handler: async (args, ctx) => {
      await runContinueCommand(ctx, args);
    },
  });
}

async function runContinueCommand(
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
        `  Captured agent: ${_agent ? "yes" : "no"}`,
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

  if (!_agent) {
    ctx.ui.notify(
      "pi-invisible-continue: Agent instance not captured. Internal error?",
      "warning",
    );
    return;
  }

  if (!ctx.isIdle()) {
    await ctx.waitForIdle();
  }

  await _agent.prompt([]);
}
