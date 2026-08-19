#!/usr/bin/env bash
set -euo pipefail

corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
