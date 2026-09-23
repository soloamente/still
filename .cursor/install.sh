#!/usr/bin/env bash
# Cloud Agent install phase — idempotent repository bootstrap.
# System packages (PostgreSQL) and the Bun toolchain are installed here so the
# resulting snapshot carries them; per-boot service startup lives in start.sh.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export DEBIAN_FRONTEND=noninteractive

# --- PostgreSQL (local dev database) ------------------------------------------
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  echo "[install] Installing PostgreSQL…"
  sudo apt-get update -y
  sudo apt-get install -y postgresql postgresql-contrib
else
  echo "[install] PostgreSQL already present."
fi

# --- Bun (pinned to the repo's packageManager version) ------------------------
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
BUN_VERSION="$(grep -oE '"packageManager": *"bun@[0-9.]+"' package.json | grep -oE '[0-9.]+' || echo 1.3.9)"
if ! command -v bun >/dev/null 2>&1 || [ "$(bun --version 2>/dev/null)" != "$BUN_VERSION" ]; then
  echo "[install] Installing Bun v$BUN_VERSION…"
  curl -fsSL https://bun.sh/install | bash -s "bun-v$BUN_VERSION"
else
  echo "[install] Bun v$BUN_VERSION already present."
fi
hash -r

# --- Workspace dependencies ---------------------------------------------------
echo "[install] bun install…"
bun install

# --- Local env files (gitignored; generated with dev defaults if absent) ------
bash "$REPO_ROOT/.cursor/write-env.sh"

echo "[install] Done."
