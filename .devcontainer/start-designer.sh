#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if curl --silent --fail http://127.0.0.1:8765/health >/dev/null 2>&1; then
  exit 0
fi
setsid -f sh -c 'exec node designer-server.mjs </dev/null > .designer-server.log 2>&1'
