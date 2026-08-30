import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  CONTINUE_COMMAND_DESCRIPTION,
  INVISIBLE_CONTINUE_CUSTOM_TYPE,
  getLastAssistantMessageText,
  isInvisibleContinueMarker,
  stripTrailingIncompleteAssistants,
} from "./src/index.js";

/**
 * Resume through AgentSession instead of calling Agent.prompt([]) directly.
 * The hidden custom message starts or queues a canonical session turn, while
 * the context hook removes it before provider serialization.
 */
export default function invisibleContinueExtension(pi: ExtensionAPI) {
  pi.on("context", (event) => {
    const hasMarker = event.messages.some((message) => isInvisibleContinueMarker(message));
    const messages = event.messages.filter((message) => !isInvisibleContinueMarker(message));
    const next = hasMarker ? stripTrailingIncompleteAssistants(messages) : messages;
    if (next.length !== event.messages.length) return { messages: next };
  });

  pi.registerCommand("continue", {
    description: CONTINUE_COMMAND_DESCRIPTION,
    handler: async (args, ctx) => {
      runContinueCommand(pi, ctx, args);
    },
  });
}

function runContinueCommand(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  args: string,
): void {
  const subcommand = args.trim().toLowerCase();

  if (subcommand === "status") {
    const last = getLastAssistantMessageText(ctx.sessionManager.getEntries());
    ctx.ui.notify(
      [
        "pi-invisible-continue status:",
        `  Agent idle: ${ctx.isIdle() ? "yes" : "no"}`,
        `  Last assistant: ${last ?? "(none)"}`.slice(0, 120),
      ].join("\n"),
      "info",
    );
    return;
  }

  if (subcommand === "help") {
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

  pi.sendMessage(
    {
      customType: INVISIBLE_CONTINUE_CUSTOM_TYPE,
      content: [],
      display: false,
      details: undefined,
    },
    {
      triggerTurn: true,
      deliverAs: "followUp",
    },
  );
}
