<div align="center">

# 👻 pi-invisible-continue

**Invisible session continuation for [pi](https://github.com/earendil-works/pi-coding-agent)**

_Resume the agentic loop without the LLM seeing a new prompt._

[![pi extension](https://img.shields.io/badge/pi-extension-blueviolet)](https://github.com/earendil-works/pi-coding-agent)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

</div>

---

## The Problem

Most “continue” extensions send user text to the LLM:

| Package | What the LLM sees |
|---------|-------------------|
| `pi-continue` | A full handoff document |
| `pi-hodor` | `"continue"` |
| `pi-auto-continue` | `"continue"` |

That text can influence the next response or be interpreted as a new task.

## The Solution

`pi-invisible-continue` starts a normal Pi session turn with a hidden custom marker. A `context` hook removes that marker before provider serialization, so the LLM receives no new prompt text.

The continuation deliberately goes through `AgentSession`:

- Pi’s session-level busy state remains accurate.
- A concurrent prompt is queued through the native follow-up path rather than racing it.
- Auto-retry, compaction, abort, and `agent_settled` behavior remain intact.
- The marker is hidden from the TUI and filtered from every LLM request.

## How It Works

`/continue` calls:

```typescript
pi.sendMessage(
  {
    customType: "pi-invisible-continue:resume",
    content: [],
    display: false,
  },
  {
    triggerTurn: true,
    deliverAs: "followUp",
  },
);
```

Pi starts the turn immediately when idle or queues it when another turn is active. Before the provider request, the extension removes its custom marker from `event.messages`.

### Why not `Agent.prompt([])`?

Calling the low-level agent directly bypasses `AgentSession._runAgentPrompt()`. Pi can then report the session as idle while `Agent.activeRun` is already processing. A user prompt may be routed as a fresh prompt and fail with:

> Agent is already processing a prompt. Use steer() or followUp() to queue messages, or wait for completion.

Using `sendMessage` keeps one authoritative lifecycle and avoids that split-brain busy state.

### Session artifact

The session journal contains one hidden custom entry per continuation. It has no display content and is removed before every provider call, but it is still bookkeeping in the saved session. This is the correctness trade-off until Pi exposes a public session-level resume API that adds no entry.

## Usage

| Command | What it does |
|---------|-------------|
| `/continue` | Start or queue an invisible continuation. |
| `/continue status` | Show session idle state and the last assistant text. |
| `/continue help` | Show the command reference. |

## Installation

```bash
pi install npm:pi-invisible-continue
```

Or install from GitHub:

```bash
pi install https://github.com/monotykamary/pi-invisible-continue
```

Or add it to `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "https://github.com/monotykamary/pi-invisible-continue"
  ]
}
```

Then run `/reload` or restart Pi.

For a one-off test:

```bash
pi -e ./continue.ts
```

## Comparison

| Feature | pi-invisible-continue | pi-continue | pi-hodor | pi-auto-continue |
|---------|----------------------|-------------|----------|-------------------|
| LLM sees new user text | No | Handoff doc | `"continue"` | `"continue"` |
| Visible transcript entry | No | Yes | Yes | Yes |
| Hidden session bookkeeping | One custom entry | Compaction + user entry | User entry | User entry |
| Native session lifecycle | Yes | Yes | Yes | Yes |
| Auto-triggered | No | On compaction | On error/length | On `agent_end` |

The desired upstream primitive is a public `AgentSession.resume()` operation that preserves native lifecycle behavior without adding a marker. Until then, a filtered custom message is safer than bypassing the session.

## License

MIT
