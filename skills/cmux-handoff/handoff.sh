#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: handoff.sh [--no-focus] [--cwd <path>] <prompt> [claude flag ...]

Opens a terminal tab to the right of the calling tab, starts `claude` there with
the flags you pass, and types <prompt> into it. It never presses Enter — the
human reads the prompt and submits it.

  --no-focus    Leave the caller's tab selected.
  --cwd <path>  Working directory for the new tab (default: this shell's).

Run it from inside a cmux terminal. <prompt> must be one line: cmux send reads
a newline, \n, \r, or \t as a keypress, and Enter would submit the prompt.
EOF
  exit 2
}

FOCUS=true
CWD="$PWD"
while [ $# -gt 0 ]; do
  case "$1" in
    --no-focus) FOCUS=false; shift ;;
    --cwd) [ $# -ge 2 ] || usage; CWD="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) break ;;
  esac
done

[ $# -ge 1 ] || usage
PROMPT="$1"
shift

case "$PROMPT" in
  *'\n'*|*'\r'*|*'\t'*|*'
'*)
    echo "handoff: the prompt must be one line — cmux send reads a newline, \\n, \\r, or \\t as a keypress" >&2
    exit 1 ;;
esac

ABS="$(cd -- "$CWD" 2>/dev/null && pwd)" ||
  { echo "handoff: no such directory: $CWD" >&2; exit 1; }
CWD="$ABS"

WS="${CMUX_WORKSPACE_ID:-}"
# Not CMUX_TAB_ID: it carries the workspace UUID, and tab-action rejects it.
TAB="${CMUX_SURFACE_ID:-}"
if [ -z "$WS" ] || [ -z "$TAB" ]; then
  echo "handoff: no CMUX_WORKSPACE_ID or CMUX_SURFACE_ID — run this inside a cmux terminal" >&2
  exit 1
fi

quote() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }

surface_ids() {
  cmux rpc surface.list "{\"workspace_id\":\"$WS\"}" | jq -r '.surfaces[].id' | sort
}

# Read-back beats the printed `created=tab:N`: a UUID names one surface for
# certain, and typing into the wrong tab would hit a live session.
BEFORE="$(surface_ids)"
cmux tab-action --action new-terminal-right --tab "$TAB" --workspace "$WS" --focus false >/dev/null

NEW=""
for _ in $(seq 1 100); do
  NEW="$(comm -13 <(printf '%s\n' "$BEFORE") <(surface_ids) | head -1)"
  [ -n "$NEW" ] && break
  sleep 0.05
done
[ -n "$NEW" ] || { echo "handoff: cmux opened no tab" >&2; exit 1; }

REF="$(cmux rpc surface.list "{\"workspace_id\":\"$WS\"}" |
  jq -r --arg id "$NEW" '.surfaces[] | select(.id==$id) | .ref')"
REF="${REF:-$NEW}"

screen() { cmux read-screen --surface "$NEW" 2>/dev/null || true; }

await() { # await <seconds> <extended-regex>
  local tries=$(( $1 * 5 ))
  while [ "$tries" -gt 0 ]; do
    screen | grep -qE "$2" && return 0
    sleep 0.2
    tries=$(( tries - 1 ))
  done
  return 1
}

CMD="cd -- $(quote "$CWD") && claude"
for flag in "$@"; do CMD="$CMD $(quote "$flag")"; done
# The new tab is dormant — no PTY, and read-screen fails on it — until something
# sends it input. This send wakes it, and the shell runs the line once it starts.
cmux send --surface "$NEW" "$CMD" >/dev/null
cmux send-key --surface "$NEW" enter >/dev/null

# Never type the prompt before the TUI owns the keyboard — a shell would run it.
# Match only what claude prints. A `❯` would also match a shell prompt.
if ! await 20 'Claude Code v|⏵⏵|for shortcuts'; then
  if screen | grep -q 'trust this folder'; then
    echo "handoff: $REF — claude asks whether it trusts $CWD. Answer that yourself, then paste:" >&2
    echo "$PROMPT" >&2
  else
    echo "handoff: $REF — claude never started, so the prompt is not typed" >&2
  fi
  exit 1
fi

cmux send --surface "$NEW" "$PROMPT" >/dev/null

HEAD="$(printf '%s' "$PROMPT" | cut -c1-30)"
if await 5 "$(printf '%s' "$HEAD" | sed 's/[][(){}.*+?^$|\\]/\\&/g')"; then
  STATE="typed, not submitted"
else
  STATE="typed, but not confirmed on screen — read the tab before you submit"
fi

if [ "$FOCUS" = true ]; then
  cmux rpc surface.focus "{\"surface_id\":\"$NEW\"}" >/dev/null
fi

echo "handoff: $REF — claude is up, prompt $STATE"
