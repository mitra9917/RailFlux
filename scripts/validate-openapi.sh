#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPEC="${ROOT}/docs/design/api-spec.yaml"
exec npx -y @apidevtools/swagger-cli validate "$SPEC"
