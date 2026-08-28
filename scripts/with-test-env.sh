#!/bin/sh
# Same as with-env.sh, but repoints every database variable at the TEST
# database before exec'ing the command. Tests never touch the dev database.
set -e

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

# Fail with a named error instead of silently exporting an empty URL.
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL is not set - copy .env.example to .env}"

DATABASE_URL="$TEST_DATABASE_URL"
DIRECT_DATABASE_URL="$TEST_DATABASE_URL"
export DATABASE_URL DIRECT_DATABASE_URL

exec "$@"
