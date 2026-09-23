#!/usr/bin/env bash
# Next.js web app (http://localhost:3001). Proxies /api/* to the Elysia server.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/apps/web"
export PATH="$HOME/.bun/bin:$PATH"
exec bun run dev
