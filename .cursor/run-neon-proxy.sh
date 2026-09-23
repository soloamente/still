#!/usr/bin/env bash
# Local Neon HTTP proxy — lets the neon-http runtime driver in @still/db talk to
# the local PostgreSQL. See packages/db/scripts/neon-http-proxy.mjs.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
export PATH="$HOME/.bun/bin:$PATH"
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/still}"
export NEON_HTTP_PROXY_PORT="${NEON_HTTP_PROXY_PORT:-4444}"
exec bun packages/db/scripts/neon-http-proxy.mjs
