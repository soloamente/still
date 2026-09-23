#!/usr/bin/env bash
# Elysia API server (http://localhost:3000). The neon-local preload points the
# neon-http driver at the local proxy (http://127.0.0.1:4444/sql).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/apps/server"
export PATH="$HOME/.bun/bin:$PATH"
export NEON_LOCAL_PROXY="${NEON_LOCAL_PROXY:-http://127.0.0.1:4444/sql}"
exec bun --hot --preload ../../packages/db/scripts/neon-local-preload.ts src/local.ts
