#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .designer-runtime.pid ]] && kill -0 "$(cat .designer-runtime.pid)" 2>/dev/null; then
  exit 0
fi
nohup node designer-server.mjs > .designer-server.log 2>&1 &
echo "$!" > .designer-runtime.pid
