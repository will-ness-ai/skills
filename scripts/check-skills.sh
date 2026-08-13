#!/usr/bin/env bash
set -euo pipefail

# Enforces the skill rules in CLAUDE.md, so a broken skill fails here instead of
# at invoke time inside another project. This script owns the definition of "a
# skill" for the repo. Keep it in step with link-skills.sh and list-skills.sh.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$REPO/skills"
README="$REPO/README.md"

# engineering/ holds redirect stubs for skills that moved. They keep external
# links alive; they are not installable skills.
STUB_BUCKET="engineering"

errors=0
err() {
  echo "  FAIL  $*" >&2
  errors=$((errors + 1))
}

front_matter() {
  awk '
    NR == 1 && $0 != "---" { exit }
    NR == 1 { next }
    $0 == "---" { exit }
    { print }
  ' "$1"
}

# Reads the first line whose key matches, at any indent. Enough for these flat
# files; not a YAML parser.
yaml_value() {
  awk -v key="$1" '
    {
      line = $0
      sub(/^[ \t]+/, "", line)
      if (index(line, key ":") == 1) {
        value = substr(line, length(key) + 2)
        sub(/^[ \t]+/, "", value)
        sub(/[ \t\r]+$/, "", value)
        print value
        exit
      }
    }
  '
}

strip_quotes() {
  local v="$1"
  v="${v%\"}"; v="${v#\"}"
  v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

echo "checking skills in $SKILLS_DIR"

while IFS= read -r skill_md; do
  rel="${skill_md#"$REPO"/}"
  under="${skill_md#"$SKILLS_DIR"/}"
  case "$under" in
    "$STUB_BUCKET"/*) continue ;;
    */*/*) err "$rel — a skill folder must be a direct child of skills/" ;;
  esac
done < <(find "$SKILLS_DIR" -name SKILL.md -not -path '*/node_modules/*' -print)

found_skills=""
for dir in "$SKILLS_DIR"/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  [ "$name" = "$STUB_BUCKET" ] && continue

  echo "- $name"
  found_skills="$found_skills $name"

  skill_md="$dir/SKILL.md"
  if [ ! -f "$skill_md" ]; then
    err "skills/$name — no SKILL.md"
    continue
  fi

  fm="$(front_matter "$skill_md")"
  if [ -z "$fm" ]; then
    err "skills/$name/SKILL.md — no YAML front matter (a --- delimited block starting on line 1)"
    continue
  fi

  fm_name="$(strip_quotes "$(printf '%s\n' "$fm" | yaml_value name)")"
  fm_desc="$(strip_quotes "$(printf '%s\n' "$fm" | yaml_value description)")"
  fm_disable="$(strip_quotes "$(printf '%s\n' "$fm" | yaml_value disable-model-invocation)")"

  [ -n "$fm_desc" ] || err "skills/$name/SKILL.md — front matter has no description"

  if [ -z "$fm_name" ]; then
    err "skills/$name/SKILL.md — front matter has no name"
  elif [ "$fm_name" != "$name" ]; then
    err "skills/$name/SKILL.md — name is '$fm_name' but the folder is '$name'"
  fi

  case "$fm_disable" in
    ""|true|false) ;;
    *) err "skills/$name/SKILL.md — disable-model-invocation must be true or false, got '$fm_disable'" ;;
  esac

  yaml="$dir/agents/openai.yaml"
  if [ ! -f "$yaml" ]; then
    err "skills/$name — no agents/openai.yaml"
    continue
  fi

  implicit="$(strip_quotes "$(yaml_value allow_implicit_invocation < "$yaml")")"
  case "$implicit" in
    ""|true|false) ;;
    *) err "skills/$name/agents/openai.yaml — allow_implicit_invocation must be true or false, got '$implicit'" ;;
  esac

  # Half a pair means one harness starts the skill on its own while the other
  # waits for the human.
  if [ "$fm_disable" = "true" ] && [ "$implicit" != "false" ]; then
    err "skills/$name — SKILL.md is user-invoked (disable-model-invocation: true) but openai.yaml does not set policy.allow_implicit_invocation: false"
  fi
  if [ "$implicit" = "false" ] && [ "$fm_disable" != "true" ]; then
    err "skills/$name — openai.yaml sets allow_implicit_invocation: false but SKILL.md does not set disable-model-invocation: true"
  fi
done

if [ ! -f "$README" ]; then
  err "no README.md — it holds the skill index"
else
  for name in $found_skills; do
    grep -qF "](./skills/$name/SKILL.md)" "$README" ||
      err "README.md — skill '$name' is not in the skill index"
  done

  while IFS= read -r linked; do
    [ -n "$linked" ] || continue
    case " $found_skills " in
      *" $linked "*) ;;
      *) err "README.md — the skill index links '$linked', which is not a skill folder" ;;
    esac
  done < <(grep -o '](\./skills/[^/)]*/SKILL\.md)' "$README" |
    sed -e 's|^](\./skills/||' -e 's|/SKILL\.md)$||' | sort -u)
fi

if [ "$errors" -gt 0 ]; then
  echo
  echo "$errors problem(s) found." >&2
  exit 1
fi

echo
echo "all skills OK"
