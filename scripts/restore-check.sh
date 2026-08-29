#!/bin/sh
# Prueba que el respaldo mas reciente se pueda restaurar de verdad: crea
# personal_finance_restore_test, restaura el dump en ella, y compara el
# conteo de filas de cada tabla contra la base original. Elimina la base de
# prueba al terminar, pase lo que pase. Un respaldo que nunca se restauro no
# es un respaldo, es un archivo (§12).
set -e

BACKUP_DIR="backups"
SOURCE_DB="personal_finance"
RESTORE_DB="personal_finance_restore_test"

LATEST="$(ls -t "${BACKUP_DIR}"/*.sql 2>/dev/null | head -n 1)"
if [ -z "$LATEST" ]; then
  echo "No hay ningun respaldo en ${BACKUP_DIR}/. Corre sh scripts/backup.sh primero." >&2
  exit 1
fi

cleanup() {
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -q -U postgres -c "drop database if exists ${RESTORE_DB}" >/dev/null
}
trap cleanup EXIT INT TERM

echo "Restaurando ${LATEST} en ${RESTORE_DB}..."
docker compose exec -T db psql -v ON_ERROR_STOP=1 -q -U postgres -c "drop database if exists ${RESTORE_DB}" >/dev/null
docker compose exec -T db psql -v ON_ERROR_STOP=1 -q -U postgres -c "create database ${RESTORE_DB}" >/dev/null
docker compose exec -T db psql -v ON_ERROR_STOP=1 -q -U postgres -d "$RESTORE_DB" < "$LATEST" >/dev/null

TABLES="$(docker compose exec -T db psql -q -U postgres -d "$SOURCE_DB" -t -A -c \
  "select tablename from pg_tables where schemaname = 'public' order by tablename")"

FAILED=0
for TABLE in $TABLES; do
  ORIGINAL_COUNT="$(docker compose exec -T db psql -q -U postgres -d "$SOURCE_DB" -t -A -c "select count(*) from \"${TABLE}\"")"
  RESTORED_COUNT="$(docker compose exec -T db psql -q -U postgres -d "$RESTORE_DB" -t -A -c "select count(*) from \"${TABLE}\"")"
  if [ "$ORIGINAL_COUNT" != "$RESTORED_COUNT" ]; then
    echo "${TABLE}: original=${ORIGINAL_COUNT} restaurado=${RESTORED_COUNT} -- DIFIERE"
    FAILED=1
  else
    echo "${TABLE}: ${ORIGINAL_COUNT}"
  fi
done

exit $FAILED
