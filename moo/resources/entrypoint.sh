#!/bin/bash

DB_NAME="$1"
PORT="$2"
INIT_DB="$3"

DB_NEW="${DB_NAME}.db"
DB_OLD="${DB_NAME}.old.db"

if [ -e "$DB_NEW" ]; then
  mv "$DB_NEW" "$DB_OLD"
  DB_SOURCE="$DB_OLD"
elif [ -e "$DB_OLD" ]; then
  # Server must have crashed last run and db not flushed to disk
  DB_SOURCE="$DB_OLD"
elif [ -z "$INIT_DB" ]; then
  # No existing db, no init db specified, use default
  INIT_DB="LambdaCore"
fi

if [ -n "$INIT_DB" ]; then
  DB_SOURCE="${INIT_DB}.db"
  test -e "$DB_SOURCE" || gunzip -c "/usr/local/lib/moo/cores/${DB_SOURCE}.gz" > "$DB_SOURCE"

  {
    while ! nc -zv localhost "$PORT" &>/dev/null; do
      sleep 1
    done

    for SCRIPT in $(ls -1 /usr/local/lib/moo/scripts/init/*.moo); do
      SCRIPT_MAME="$(basename "$SCRIPT")"
      run-script.sh localhost "$PORT" wizard "" < "$SCRIPT" | sed "s:^:$SCRIPT_MAME | :"
    done
  } &
fi

moo "$DB_SOURCE" "$DB_NEW" "$PORT" 2>&1 | tee "${DB_NAME}.log"
