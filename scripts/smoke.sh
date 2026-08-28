#!/bin/sh
# Runs the built application and exercises the two facts that prove the
# artifact the manifest declares is the one the build produced:
#   GET /login  -> 200          (the only public route exists and renders)
#   GET /       -> /login       (the proxy guard redirects anonymous traffic)
#
# Requires a prior `pnpm build`. Used by build step 1 and by the global
# acceptance gate, so both call sites assert exactly the same thing.
set -e

PORT="${SMOKE_PORT:-3100}"
BASE="http://127.0.0.1:${PORT}"
LOG="${TMPDIR:-/tmp}/pfa-smoke.log"

sh scripts/with-env.sh pnpm exec next start --port "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!
# shellcheck disable=SC2064
trap "kill $SERVER_PID 2>/dev/null || true" EXIT INT TERM

i=0
while [ "$i" -lt 60 ]; do
  if curl -sf "${BASE}/login" >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

if [ "$i" -ge 60 ]; then
  echo "smoke: server did not answer on ${BASE}/login within 60s" >&2
  cat "$LOG" >&2
  exit 1
fi

test "$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/login")" = "200"
test "$(curl -s -o /dev/null -w '%{redirect_url}' "${BASE}/")" = "${BASE}/login"

echo "smoke ok: /login=200, / -> /login"
