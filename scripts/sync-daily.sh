#!/bin/zsh
set -eu

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"
exec /usr/bin/env corepack pnpm exec tsx scripts/sync-daily.ts
