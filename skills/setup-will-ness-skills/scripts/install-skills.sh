#!/usr/bin/env bash
set -euo pipefail

# Installs the development-workflow skills into one repo, as editable copies:
#   <repo>/.claude/skills/<name>/   the copy (Claude Code reads it)
#   <repo>/.agents/skills/<name>    a symlink to the copy (Codex and other harnesses)
# and records what it installed, and from which commits, in
#   <repo>/.claude/will-ness-skills.lock.json
# which the workflow-status pane reads. Re-run it to update: each listed skill is
# replaced whole; skills it did not install are left alone.
#
# Usage: install-skills.sh [repo-dir]          (default: the current git root)
# Env:   MATT_SKILLS_SRC=<dir>  use a local checkout of mattpocock/skills
#        WILL_SKILLS_SRC=<dir>  use a local checkout of will-ness-ai/skills
#        MATT_SKILLS_REF / WILL_SKILLS_REF   branch or tag to clone (default main)

# The workflow skills, then the skills they call. Keep in step with
# references/DEVELOPMENT_WORKFLOW.md and the README entry for this skill.
MATT_SKILLS=(
  grill-with-docs prototype tdd pr to-tickets to-spec implement-spec code-review
  codebase-design retro
  grilling domain-modeling writing-for-agents setup-matt-pocock-skills
)
WILL_SKILLS=(grill-design maintain-agents-md)

TARGET="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
TARGET="$(cd "$TARGET" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fetch() { # <name> <github repo> <ref> <local override> -> prints checkout dir
  local name="$1" repo="$2" ref="$3" local_src="$4"
  if [ -n "$local_src" ]; then
    (cd "$local_src" && pwd)
    return
  fi
  git clone --quiet --depth 1 --branch "$ref" "https://github.com/$repo.git" "$TMP/$name" >&2
  echo "$TMP/$name"
}

MATT_DIR="$(fetch matt mattpocock/skills "${MATT_SKILLS_REF:-main}" "${MATT_SKILLS_SRC:-}")"
WILL_DIR="$(fetch will will-ness-ai/skills "${WILL_SKILLS_REF:-main}" "${WILL_SKILLS_SRC:-}")"
MATT_SHA="$(git -C "$MATT_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
WILL_SHA="$(git -C "$WILL_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"

# Matt's repo nests skills one bucket deep (skills/engineering/tdd); this repo
# keeps them flat (skills/tdd). Find the folder whichever way it is laid out.
skill_dir() { # <checkout> <name>
  find "$1/skills" -mindepth 1 -maxdepth 3 -type d -name "$2" -not -path '*/deprecated/*' |
    while IFS= read -r d; do [ -f "$d/SKILL.md" ] && echo "$d"; done | head -1
}

mkdir -p "$TARGET/.claude/skills" "$TARGET/.agents/skills"
installed=()
missing=()

install_from() { # <checkout> <sha> <repo> <names...>
  local src_root="$1" sha="$2" repo="$3"
  shift 3
  local name src dest
  for name in "$@"; do
    src="$(skill_dir "$src_root" "$name")"
    if [ -z "$src" ]; then
      missing+=("$name ($repo)")
      continue
    fi
    dest="$TARGET/.claude/skills/$name"
    rm -rf "$dest"
    cp -R "$src" "$dest"
    ln -sfn "../../.claude/skills/$name" "$TARGET/.agents/skills/$name"
    installed+=("{\"name\":\"$name\",\"repo\":\"$repo\",\"commit\":\"$sha\"}")
    echo "installed $name  <- $repo@${sha:0:7}"
  done
}

install_from "$MATT_DIR" "$MATT_SHA" mattpocock/skills "${MATT_SKILLS[@]}"
install_from "$WILL_DIR" "$WILL_SHA" will-ness-ai/skills "${WILL_SKILLS[@]}"

{
  echo "{"
  echo "  \"installedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"skills\": ["
  for i in "${!installed[@]}"; do
    sep=","
    [ "$i" -eq $((${#installed[@]} - 1)) ] && sep=""
    echo "    ${installed[$i]}$sep"
  done
  echo "  ]"
  echo "}"
} > "$TARGET/.claude/will-ness-skills.lock.json"

# A skill also installed for the whole user (~/.claude/skills, a plugin) is
# listed twice in the harness. Name them so the person can drop one copy.
shadowed=()
for name in "${MATT_SKILLS[@]}" "${WILL_SKILLS[@]}"; do
  [ -e "$HOME/.claude/skills/$name" ] && shadowed+=("$name")
done

echo
echo "${#installed[@]} skills installed into $TARGET/.claude/skills"
echo "lock file: $TARGET/.claude/will-ness-skills.lock.json"
if [ "${#shadowed[@]}" -gt 0 ]; then
  echo "also installed for the user in ~/.claude/skills: ${shadowed[*]}"
fi
if [ "${#missing[@]}" -gt 0 ]; then
  echo "NOT FOUND upstream: ${missing[*]}" >&2
  exit 1
fi
