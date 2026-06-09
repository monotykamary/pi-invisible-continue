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
 *   - Monkey-patch Agent.prototype.subscribe to capture the Agent instance
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
//
// Chain the previous patch (if pi-retry or pi-vcc already patched it)
// so all extensions can coexist.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _agent: Agent | null = null;
const _origSubscribe = Agent.prototype.subscribe as (this: Agent, ...args: any[]) => any;
Agent.prototype.subscribe = function (this: Agent, ...args: any[]) {
  _agent = this;
  return _origSubscribe.apply(this, args);
};

// Mutex: only one invisible continue may be in-flight at a time.
// Without this, concurrent /continue (or /continue during pi-retry/pi-vcc
// auto-continuation) race through waitForIdle() and both call prompt([]),
// producing "Agent is already processing".
let _continueInProgress = false;

// Monkey-patch continue() so the session's built-in loop cooperates with
// our mutex. Without this, the session's continue() could race our
// prompt([]) call and throw "Agent is already processing".
// Chains the previous patch (pi-retry, pi-vcc) so all mutexes are respected.
const _origContinue = Agent.prototype.continue;
Agent.prototype.continue = function (this: Agent) {
  const self = this;
  return (async (): Promise<void> => {
    while (_continueInProgress) {
      await new Promise(r => setTimeout(r, 10));
    }
    try {
      await _origContinue.call(self);
    } catch (e: any) {
      const msg = e?.message ?? '';
      // After an invisible continue finishes, the transcript ends with a
      // fresh assistant message.  The session's continue() sees this and
      // would throw.  Catch and swallow — the while-loop will poll
      // _handlePostAgentRun() again, find no error, and exit cleanly.
      if (
        msg.includes('Cannot continue from message role') ||
        msg.includes('Cannot continue from an assistant message') ||
        msg.includes('Agent is already processing')
      ) {
        return;
      }
      throw e;
    }
  })();
};

export default function (pi: ExtensionAPI) {
  pi.registerCommand("continue", {
    description: CONTINUE_COMMAND_DESCRIPTION,
    handler: async (args, ctx) => {
      await runContinueCommand(ctx, args);
    },
  });

  pi.on("session_start", () => {
    _continueInProgress = false;
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

  // Guard: if pi-retry or pi-vcc already has an invisible continue in-flight,
  // skip — their prompt([]) will resume the loop.
  if (_continueInProgress) {
    ctx.ui.notify(
      "pi-invisible-continue: Another invisible continue is already in progress.",
      "info",
    );
    return;
  }
  _continueInProgress = true;

  try {
    await _agent.waitForIdle();
    try {
      await _agent.prompt([]);
    } catch {
      // Agent is already processing — something else is driving.
    }
  } finally {
    _continueInProgress = false;
  }
}
