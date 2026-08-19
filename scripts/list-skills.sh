#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO"
# The search starts at skills/, as in check-skills.sh and link-skills.sh. A
# search from the repo root also finds the git worktrees under .claude/, and
# then it reports each skill more than one time.
# engineering/ holds only redirect stubs for moved skills, not real skills.
find skills -name SKILL.md -not -path '*/node_modules/*' -not -path '*/engineering/*' |
  sort
