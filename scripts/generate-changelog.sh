#!/bin/bash
# Generate CHANGELOG.md from git log, grouped by date
# Called by pre-commit hook

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
CHANGELOG="$REPO_ROOT/CHANGELOG.md"

echo "# Changelog" > "$CHANGELOG"
echo "" >> "$CHANGELOG"
echo "Auto-generated from git history." >> "$CHANGELOG"

current_day=""

git log --pretty=format:"%aI|%s|%an" --max-count=200 | while IFS='|' read -r date msg author; do
  day="${date:0:10}"
  if [ "$day" != "$current_day" ]; then
    echo "" >> "$CHANGELOG"
    echo "## $day" >> "$CHANGELOG"
    echo "" >> "$CHANGELOG"
    current_day="$day"
  fi
  echo "- $msg ($author)" >> "$CHANGELOG"
done

echo "" >> "$CHANGELOG"
