#!/bin/sh
# Loads .env into the environment, then execs the command it was given.
#
# Next.js reads .env by itself. Nothing else does: Prisma's CLI, tsx and
# Vitest all start with whatever the shell exported, which in an unattended
# build is nothing. Every package.json script that invokes one of those tools
# goes through this file, so the loading mechanism cannot be forgotten at a
# call site.
set -e

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

exec "$@"
