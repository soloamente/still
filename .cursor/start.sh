#!/usr/bin/env bash
# Cloud Agent start phase — per-boot reconciliation. Brings up PostgreSQL,
# ensures the dev role/database exist, applies migrations, and returns.
# Long-running dev servers (proxy, API, web) run as terminals, not here.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# --- Ensure env files exist (fresh boot from a bare snapshot) -----------------
bash "$REPO_ROOT/.cursor/write-env.sh"

# --- Start PostgreSQL ---------------------------------------------------------
echo "[start] Starting PostgreSQL…"
sudo pg_ctlcluster 16 main start 2>/dev/null || true
# Wait for readiness (peer socket).
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then break; fi
  sleep 1
done

# --- Ensure dev role password + database exist (idempotent) -------------------
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD 'postgres';" >/dev/null
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='still'" | grep -q 1; then
  echo "[start] Creating database 'still'…"
  sudo -u postgres createdb still
fi

# --- Apply migrations (drizzle over the pg TCP driver; idempotent) ------------
echo "[start] Applying database migrations…"
bun run db:migrate || echo "[start] WARNING: migrations reported an issue — check logs"

echo "[start] Ready. Dev servers run in the neon-proxy / server / web terminals."
