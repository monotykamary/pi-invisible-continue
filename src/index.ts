/** Shared constants and utilities for pi-invisible-continue. */

export const CONTINUE_COMMAND_DESCRIPTION =
  "Resume the agentic loop without sending a prompt the LLM can read";

export const INVISIBLE_CONTINUE_CUSTOM_TYPE = "pi-invisible-continue:resume";

export function isInvisibleContinueMarker(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const candidate = message as { role?: unknown; customType?: unknown };
  return (
    candidate.role === "custom" &&
    candidate.customType === INVISIBLE_CONTINUE_CUSTOM_TYPE
  );
}

export function getLastAssistantMessageText(
  entries: ReadonlyArray<{ type: string; message?: { role?: string; content?: unknown } }>,
): string | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (
      entry.type === "message" &&
      entry.message?.role === "assistant" &&
      entry.message.content
    ) {
      const content = entry.message.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        const textBlocks = content.filter(
          (block: unknown): block is { type: "text"; text: string } => {
            if (!block || typeof block !== "object") return false;
            const candidate = block as { type?: unknown; text?: unknown };
            return candidate.type === "text" && typeof candidate.text === "string";
          },
        );
        if (textBlocks.length === 0) return undefined;
        return textBlocks.map((block) => block.text).join("\n");
      }
    }
  }
  return undefined;
}
