<div align="center">

# 👻 pi-invisible-continue

Invisible session continuation for [pi](https://github.com/badlogic/pi) — resume the agentic loop **without the LLM seeing any new prompt at all**.

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

`pi-invisible-continue` uses the SDK's `pi.sendMessage()` with a custom message type (`role: "custom"`) and `triggerTurn: true`. The default `convertToLlm` function **filters out** everything except `user`, `assistant`, and `toolResult` roles. So:

- The agent loop restarts
- The LLM receives **the exact same message list it had before**
- No new text, no handoff, no pollution
- One hidden `{ customType: "__invisible_continue", display: false }` entry is appended to the session JSONL

This is equivalent to the non-public `agent.continue()` API — without needing access to internals.

---

## Usage

Once loaded, use `/continue`:

| Command | What it does |
|---------|-------------|
| `/continue` | Resume the loop invisibly. Waits for idle, then fires. |
| `/continue status` | Show whether agent is idle and the last assistant message text (debug). |
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

## How It Works (30-Second Version)

```
User types "/continue"
  → ExtensionCommandContext handler fires
  → pi.sendMessage({ customType: "__invisible_continue", content: "", display: false }, { triggerTurn: true })
  → agent.prompt([{ role: "custom", customType: "__invisible_continue", ... }])
  → runAgentLoop pushes custom message into context.messages
  → streamAssistantResponse calls convertToLlm(messages)
  → convertToLlm filters out role "custom" → empty list for LLM
  → LLM sees same messages as before loop restart → responds naturally
```

---

## Comparison with Other Packages

| Feature | pi-invisible-continue | pi-continue | pi-hodor | pi-auto-continue |
|---------|----------------------|-------------|----------|-------------------|
| LLM sees new user text | ❌ No | ✅ Handoff doc | ✅ "continue" | ✅ "continue" |
| Session pollution | 1 hidden custom entry | Full compaction entry + user message | 1 user message | 1 user message |
| Auto-triggered | ❌ Manual only | ✅ On compaction | ✅ On error/length | ✅ On agent_end |
| Retry integration | ❌ | ❌ | ✅ Error patterns | ❌ |
| Complexity | 3 lines of core logic | 49 files, multi-stage | 2 files, config-driven | 1 file, loop-based |

---

## Development

```bash
npm install
npm test          # Vitest unit tests
npm run typecheck # TypeScript validation
npm run lint:dead # Dead code detection (knip)
```

### Structure

```
.
├── continue.ts         # Main extension
├── src/
│   └── index.ts        # Constants + session helpers
├── __tests__/
│   ├── helpers.ts      # Test utilities
│   └── unit/
│       └── continue.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── knip.json
```

---

## About the Hack

The extension uses only the **public ExtensionAPI** — no monkey-patching, no internal access, no fragile closures. It leverages a property of pi's built-in `convertToLlm` (which every extension already depends on): custom-role messages don't reach the provider.

If a custom `convertToLlm` override is used that passes custom messages through, the extension includes a `context` event handler that strips `__invisible_continue` markers as an additional safety layer.

This is the approach discussed in [pi issue #3721](https://github.com/earendil-works/pi/issues/3721) ("Feature request: Resume agentic loop without sending a message"). The upstream fix would be exposing `agent.continue()` on `AgentSession`, but this extension achieves the same effect without waiting for a core change.

## License

MIT
