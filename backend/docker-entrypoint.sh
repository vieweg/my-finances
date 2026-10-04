#!/bin/sh
set -e

# JWT secrets not passed in are generated once and kept in the data volume
SECRETS_FILE=/data/secrets.env
if [ ! -f "$SECRETS_FILE" ]; then
  gen() { node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"; }
  (umask 077 && {
    echo "GENERATED_JWT_SECRET=$(gen)"
    echo "GENERATED_JWT_SECRET_REFRESH=$(gen)"
    echo "GENERATED_JWT_RESET_SECRET=$(gen)"
  } > "$SECRETS_FILE")
  echo "Generated JWT secrets in $SECRETS_FILE"
fi
. "$SECRETS_FILE"
export JWT_SECRET="${JWT_SECRET:-$GENERATED_JWT_SECRET}"
export JWT_SECRET_REFRESH="${JWT_SECRET_REFRESH:-$GENERATED_JWT_SECRET_REFRESH}"
export JWT_RESET_SECRET="${JWT_RESET_SECRET:-$GENERATED_JWT_RESET_SECRET}"

node node_modules/typeorm/cli.js migration:run -d dist/database/index.js
exec node dist/server.js
