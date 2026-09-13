#!/bin/sh
set -eu

# Run inside a disposable Linux container. /input contains a source-only archive;
# /evidence is an explicitly mounted local output directory, never production.
result_file=/evidence/linux-release-result.json
# Invalidate a previous pass before starting. If forcibly killed, running still
# cannot be mistaken for a pass; ordinary failures record their exit code.
printf '%s\n' '{"status":"running"}' > "$result_file"
record_exit() {
  result_code=$?
  trap - EXIT
  if [ "$result_code" -ne 0 ]; then
    printf '{"status":"failed","exitCode":%s}\n' "$result_code" > "$result_file"
  fi
  exit "$result_code"
}
trap record_exit EXIT
mkdir -p /tmp/lysto-release
tar -xzf /input/release-source.tar.gz -C /tmp/lysto-release
cd /tmp/lysto-release
node --version
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm verify:payments
corepack pnpm verify:images
corepack pnpm exec vitest run marketplace --maxWorkers=1 --minWorkers=1
corepack pnpm build
printf '%s\n' '{"status":"passed","scope":"clean-linux-install,payment-runtime,image-runtime,marketplace-unit,production-build","databaseIntegration":"pending-T03-T04"}' > "$result_file"
