<div align="center">

# 👻 pi-invisible-continue

**Invisible session continuation for [pi](https://github.com/earendil-works/pi-coding-agent)**

_Resume the agentic loop without the LLM seeing any new prompt at all._

[![pi extension](https://img.shields.io/badge/pi-extension-blueviolet)](https://github.com/earendil-works/pi-coding-agent)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

</div>

---

## The Problem

Every existing "continue" extension sends a **visible user message** to the LLM:

| Package | What the LLM sees |
|---------|-------------------|
| `pi-continue` | `"Continue from the same-session pi-continue/v3 handoff Pi just saved..."` (full handoff doc) |
| `pi-hodor` | `"continue"` (literal text) |
| `pi-auto-continue` | `"continue"` (literal text) |
| `pi-retry` | `"Continue"` on max-tokens, or hidden custom trigger on errors |

Every one of those **changes the LLM's context** with new user text. That text influences the next response, sometimes in unintended ways — model changes course, re-reads things it already processed, or treats a bare `"continue"` as a new task.

---

## The Solution

`pi-invisible-continue` captures the internal `Agent` instance via a prototype monkey-patch on `Agent.prototype.prompt`. When `/continue` is invoked, it calls `agent.prompt([])` directly — starting a fresh agent loop with an **empty prompt array**. No message is injected into the context at all:

- The agent loop restarts
- The LLM receives **the exact same message list it had before**
- No new text, no handoff, no pollution, no session artifact
- Nothing in `convertToLlm`'s path — no filtering needed

---

## How It Works

```
Extension loads
  → Monkey-patches Agent.prototype.prompt to capture the Agent instance
  → First real prompt stores the reference

User types "/continue"
  → agent.prompt([]) called directly
  → runAgentLoop([], contextSnapshot, ...)
  → prompts array is empty — no message emitted, no message pushed to context
  → runLoop → streamAssistantResponse → convertToLlm(unmodified messages)
  → LLM sees same messages as before → responds naturally
```

### Why `agent.prompt([])` and not `agent.continue()`?

`agent.continue()` has a guard that throws `Cannot continue from message role: assistant` when the last message is from the assistant — which it always is when the agent stops. `agent.prompt([])` starts a fresh loop from the current context snapshot without that restriction.

### Trade-off: bypasses AgentSession

`agent.prompt([])` is called on the `Agent` directly, bypassing `AgentSession._runAgentPrompt()`. This means auto-retry on errors and auto-compaction are not triggered after a `/continue`. For a manual command where the user explicitly said "keep going," this is acceptable — they can always `/continue` again.

---

## Usage

Once loaded, use `/continue`:

| Command | What it does |
|---------|-------------|
| `/continue` | Resume the loop invisibly. Waits for idle, then fires. |
| `/continue status` | Show agent idle state, captured-agent status, and last assistant text (debug). |
| `/continue help` | Show this reference. |

---

## Installation

```bash
pi install https://github.com/monotykamary/pi-invisible-continue
```

Or in `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "https://github.com/monotykamary/pi-invisible-continue"
  ]
}
```

Then `/reload` or restart pi.

For quick one-off tests:

```bash
pi -e ./continue.ts
```

---

## Comparison with Other Packages

| Feature | pi-invisible-continue | pi-continue | pi-hodor | pi-auto-continue |
|---------|----------------------|-------------|----------|-------------------|
| LLM sees new user text | ❌ No | ✅ Handoff doc | ✅ "continue" | ✅ "continue" |
| Session pollution | None | Full compaction entry + user message | 1 user message | 1 user message |
| Mechanism | `agent.prompt([])` | `sendMessage` + handoff | `sendMessage` | `sendMessage` |
| Auto-triggered | ❌ Manual only | ✅ On compaction | ✅ On error/length | ✅ On agent_end |
| Retry integration | ❌ | ❌ | ✅ Error patterns | ❌ |
| Complexity | Prototype patch + 1 call | 49 files, multi-stage | 2 files, config-driven | 1 file, loop-based |

---

## About the Hack

The extension uses the public `@earendil-works/pi-agent-core` package (which pi's extension loader resolves to the same module instance used internally) to import `Agent` and monkey-patch `Agent.prototype.prompt`. This captures the live `Agent` instance when pi first calls `agent.prompt()` during normal operation.

Then `/continue` calls `agent.prompt([])` — an empty prompt array. The `runAgentLoop` function spreads the prompts into the context messages, so with an empty array, nothing is added. The loop starts from the unmodified context snapshot and the LLM continues naturally.

This is the approach discussed in [pi issue #3721](https://github.com/earendil-works/pi/issues/3721) ("Feature request: Resume agentic loop without sending a message"). The upstream fix would be exposing `agent.continue()` (or a variant that works from `assistant` last-message) on `AgentSession`, but this extension achieves the same effect without waiting for a core change.

## License

MIT
