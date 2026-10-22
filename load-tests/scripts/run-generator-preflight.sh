#!/usr/bin/env bash
# Host + network generator preflight before k6 (M6 #61).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    -h | --help)
      echo "Usage: run-generator-preflight.sh [--base-url URL]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

export BASE_URL
node "${ROOT}/load-tests/scripts/generator-preflight.mjs" host --base-url "${BASE_URL}"
