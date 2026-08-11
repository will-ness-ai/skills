---
name: cmux
description: Drive the local cmux app — workspaces, panes, surfaces, terminal input, agent sessions, and browser surfaces.
disable-model-invocation: true
---

# cmux

`cmux` is a command-line client for the cmux.app on this machine. Each command
opens the app's Unix socket and changes the live window. There is no dry-run
mode. Written against cmux 0.64.22; run `cmux version` to compare.

## The four nouns

| Noun | What it is |
|---|---|
| window | A macOS window. Holds workspaces. |
| workspace | A tab-like group in a window. Holds panes. |
| pane | A split area in a workspace. Holds surfaces. |
| surface | One tab in a pane. A terminal, a browser, a simulator, or an agent session. |

The surface is where text goes in and out. Almost every command needs one, and
takes it from a flag or from the environment.

## You are the caller

You run inside a cmux surface. Your environment has `CMUX_WORKSPACE_ID` and
`CMUX_SURFACE_ID`, and every targeting flag defaults to them. So `cmux send "ls"`
with no `--surface` types into your own terminal.

Start with:

```bash
cmux identify --json
```

`caller.surface_ref` in the output is you. `focused.surface_ref` is what the user
looks at. Send text to your own surface only when the user asks for that.

## Handles

A window, workspace, pane, or surface flag accepts three forms:

- **ref** — `workspace:30`, `surface:217`. Printed by every list command.
- **uuid** — `A1B2C3D4-E5F6-4789-ABCD-0123456789AB`. Stable and global.
- **index** — `0`, `1`, `2`. The position in the list.

A ref and an index both look like a number, and they point at different things:
the first workspace can print as `workspace:1` at index `0`. Use refs, and copy
them from a listing you just ran. Add `--id-format uuids` or `--id-format both`
when you need UUIDs.

## Orient first

```bash
cmux tree            # this window: workspaces, panes, surfaces, titles, ttys
cmux tree --all      # every window
cmux identify --json # who you are
```

`cmux tree` shows the whole app in one screen. Read it before you target
anything.

## Two ways in

**CLI verbs** — `cmux new-workspace`, `cmux send`, `cmux browser click`. Use
these to **create** things. A CLI verb is the only path that honours creation
options.

**`cmux rpc <method> '<json>'`** — the raw socket. Use it to **read and change
things that already exist**. It returns JSON on stdout, so it parses cleanly.

```bash
cmux rpc workspace.list
cmux rpc surface.list '{"workspace_id":"<uuid>"}'
cmux rpc surface.read_text '{"surface_id":"<uuid>"}'
cmux rpc workspace.rename '{"workspace_id":"<uuid>","title":"Done"}'
```

Creation is the split that matters. `surface.create` over rpc takes no `url`, and
workspace creation over rpc drops the title, cwd, description, and group. So:

```bash
cmux new-workspace --name "Tests" --cwd . --description "owner/repo#1" --focus false
cmux new-surface --type browser --url "file:///tmp/board.html" --workspace <uuid> --focus false
```

Errors arrive on **stderr with a non-zero exit**, not as a JSON error object:

```
Error: invalid_params: Surface is not a terminal
method_not_found: Unknown method
```

## Look it up

The binary is the source of truth, and it ships its own docs.

```bash
cmux --help              # every command
cmux <command> --help    # exact flags and examples for one command
cmux docs                # doc topics
cmux docs api            # CLI contract and socket API URLs
cmux capabilities        # every v2 socket method, as JSON
```

`cmux --help` lists more than 200 commands. Do not guess a flag. Read
`cmux <command> --help` first. To find an rpc method:

```bash
cmux capabilities | jq -r '.methods[]' | grep workspace
```

Most commands take `--json` for machine-readable output.

## Stay out of the user's way

The user is sitting in this app while you work. Pass `--focus false` on creation
so their selection stays put. Focus something only when the user asks to see it.

## Recipes

### Run a command in a new workspace

```bash
cmux new-workspace --name "Tests" --cwd . --command "npm test" --focus false
```

`--command` sends the text and Enter.

### Send input to another surface

```bash
cmux send --surface surface:78 "npm run build\n"
cmux send-key --surface surface:78 ctrl+c
```

`send` types the text and stops. End the string with `\n` to submit it.

### Read what a surface shows

```bash
cmux read-screen --surface surface:78
cmux read-screen --surface surface:78 --scrollback --lines 200
```

`read-screen` returns a snapshot of this moment. It does not wait. It fails on a
browser surface with `invalid_params: Surface is not a terminal`.

### Boot an agent in another surface

An agent TUI batches an incoming paste. An Enter that races the paste gets
swallowed, and the prompt sits typed but unsent. So type, confirm on screen, then
press Enter as a separate call.

```bash
S=surface:78
cmux send --surface $S "claude\n"

# 1. Wait for the TUI. Poll for its prompt marker: ⏵⏵ ❯ "for shortcuts"
until cmux read-screen --surface $S | grep -qE '⏵⏵|❯|for shortcuts'; do sleep 0.2; done

# 2. Type the prompt with no Enter.
cmux send --surface $S "Fix the failing test in src/auth.ts"

# 3. Confirm it landed. Match a short head slice — the input box wraps the rest.
until cmux read-screen --surface $S | grep -qF "Fix the failing test"; do sleep 0.1; done

# 4. Now submit.
cmux send-key --surface $S enter
```

Budgets that hold in practice: the TUI is ready in about 2 seconds, so time out
at 20. The typed text appears in well under a second, so time out at 5. Submit
anyway on timeout, and tell the user it was not confirmed.

A dedicated agent surface is the other option, with its own UI instead of a TUI:

```bash
cmux new-surface --type agent-session --provider claude --working-directory . --focus false
```

`--provider` accepts `codex`, `claude`, or `opencode`, and defaults to `codex`.

### Change the layout

```bash
cmux new-split right --surface surface:78
cmux move-surface --surface surface:217 --pane pane:38 --focus true
cmux split-off --surface surface:217 right
cmux rename-tab --surface surface:217 "Build"
```

### Wait for a signal

```bash
cmux events --category agent --name agent.hook.Stop --limit 1
```

`cmux events` prints newline-delimited JSON and blocks. The first frame is an
`ack` with resume data. Use `--limit <n>` to exit after n frames, `--no-heartbeat`
to drop the 15-second keepalive, and `--cursor-file <path>` with `--reconnect` to
resume after a restart. `agent.hook.Stop` arrives only after `cmux hooks setup`
installs the agent hooks.

To hand off between two of your own commands:

```bash
cmux wait-for build-done --timeout 120   # blocks
cmux wait-for -S build-done              # releases it
```

### Report progress to the user

```bash
cmux notify --title "Tests passed" --body "412 tests, 0 failures"
cmux set-status build ok --icon checkmark --color '#22c55e'
cmux set-progress 0.6 --label "Migrating"
cmux log --level info "Step 3 of 5 complete"
```

## Browser surfaces

A cmux surface can be a real browser that you drive like Playwright:

```bash
cmux browser open https://example.com
cmux browser snapshot --interactive
cmux browser click "button.submit"
cmux browser screenshot --out /tmp/shot.png
```

Run `cmux browser --help` for the full set, and `cmux docs browser` for the
upstream reference.

## Guardrails

- **The checklist belongs to the user.** Leave `cmux todo` items and
  `cmux workspace status` alone. Change them only when the user asks you to
  manage that surface. Keep your own plan in your own task tracking.
- **Back up the config before you edit it.** Copy `~/.config/cmux/cmux.json` to a
  timestamped `.bak` file first. Then run `cmux config doctor` and
  `cmux reload-config`.
- **Terminal look belongs to Ghostty.** Font, theme, cursor, scrollback, opacity,
  and blur live in `~/.config/ghostty/config`. App behaviour, sidebar,
  notifications, and browser settings live in `cmux.json`. `cmux reload-config`
  reloads both with no restart.
- **Ask before you close.** `close-workspace`, `close-surface`, and
  `close-window` destroy running work, and there is no undo.

## When a command fails

`cmux ping` prints `PONG` when the app is up. Anything else means the app is
down, or `CMUX_SOCKET_PATH` points at the wrong socket. `cmux --help`,
`cmux version`, and `cmux docs` work with no socket.

The socket also gates who may connect. `cmux capabilities` reports the mode as
`access_mode`. The default is `cmuxOnly`, which accepts only processes that cmux
itself spawned — so the same script that works in a cmux terminal is refused from
an outside shell, a cron job, or a detached daemon. `automation.socketControlMode`
in `cmux.json` changes this.

## Writing a script that drives cmux

Read [references/automation-patterns.md](references/automation-patterns.md)
before you write a loop, a watcher, or anything that creates surfaces in bulk.
It covers settling after a mutation, identifying what you just created, browser
tabs that go stale, and the workspace-group trap.
