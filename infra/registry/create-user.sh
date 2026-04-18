#!/bin/bash
# ============================================
# Создание пользователя в локальном Docker Registry
# ============================================
# Usage:
#   ./create-user.sh <username> <password>
#
# После выполнения нужно перезапустить registry-контейнер:
#   docker compose restart registry
# ============================================

set -e

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <username> <password>" >&2
  exit 1
fi

USERNAME="$1"
PASSWORD="$2"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AUTH_DIR="$SCRIPT_DIR/auth"

mkdir -p "$AUTH_DIR"

# Используем docker-образ httpd для генерации htpasswd-записи с bcrypt (-B)
docker run --rm --entrypoint htpasswd httpd:2 -Bbn "$USERNAME" "$PASSWORD" >> "$AUTH_DIR/htpasswd"

chmod 644 "$AUTH_DIR/htpasswd"

echo "OK: user '$USERNAME' added to $AUTH_DIR/htpasswd"
echo "Restart registry to apply: docker compose restart registry"
