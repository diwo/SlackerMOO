#!/bin/bash

DB_NAME="$1"
PORT="$2"
INIT_DB="$3"

test -e LambdaCore.db || gunzip -c /usr/local/lib/LambdaCore.db.gz > LambdaCore.db
test -e JHCore.db || gunzip -c /usr/local/lib/JHCore.db.gz > JHCore.db

DB_NEW="${DB_NAME}.db"
DB_OLD="${DB_NAME}.old.db"

if [ -n "$INIT_DB" ]; then
  DB_SOURCE="${INIT_DB}.db"
elif [ -e "$DB_NEW" ]; then
  mv "$DB_NEW" "$DB_OLD"
  DB_SOURCE="$DB_OLD"
elif [ -e "$DB_OLD" ]; then
  # Server must have crashed last run and db not flushed to disk
  DB_SOURCE="$DB_OLD"
else
  # No existing db, no init db specified, use default
  DB_SOURCE="LambdaCore.db"
fi

moo "$DB_SOURCE" "$DB_NEW" "$PORT" 2>&1 | tee "${DB_NAME}.log"
