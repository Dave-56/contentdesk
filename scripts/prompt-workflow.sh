#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/prompt-workflow.sh infer <url>
  scripts/prompt-workflow.sh select <data/<slug>/visibility/strategy.json>

Workflow:
  1. Infer draft strategy from website:
     scripts/prompt-workflow.sh infer https://example.com/

  2. Review and edit generated strategy.json.
     Required before select:
       - buyerLanguage
       - market
       - competitors
       - classificationWarnings resolved or accepted

  3. Build portfolio and selected prompts:
     scripts/prompt-workflow.sh select data/<slug>/visibility/strategy.json

Notes:
  - prompt:infer may use one AI classification call when AI_GATEWAY_API_KEY is set.
  - prompt:select refuses to run without buyerLanguage.
  - prompt execution/scanning remains separate from this workflow.
USAGE
}

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

command="$1"
target="$2"

case "$command" in
  infer)
    npm run prompt:infer -- --url "$target"
    ;;
  select)
    if [[ ! -f "$target" ]]; then
      echo "strategy file not found: $target" >&2
      exit 1
    fi

    output_dir="$(dirname "$target")"
    npm run prompt:select -- "$target" --out "$output_dir"
    ;;
  *)
    usage
    exit 1
    ;;
esac
