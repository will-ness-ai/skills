#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO"
# engineering/ holds only redirect stubs for moved skills, not real skills.
find . -name SKILL.md -not -path '*/node_modules/*' -not -path '*/engineering/*' |
  sed 's|^\./||' | sort
