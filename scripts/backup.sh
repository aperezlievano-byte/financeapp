#!/bin/sh
# pg_dump de la base de desarrollo local (personal_finance) a backups/, con
# nombre por marca de tiempo. Nunca se escribe ese nombre a mano en otro
# script -- restore-check.sh siempre toma el mas reciente del directorio.
set -e

BACKUP_DIR="backups"
SOURCE_DB="personal_finance"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
FILENAME="${BACKUP_DIR}/${SOURCE_DB}_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

docker compose exec -T db pg_dump -U postgres -d "$SOURCE_DB" > "$FILENAME"

echo "Respaldo escrito: $FILENAME"
