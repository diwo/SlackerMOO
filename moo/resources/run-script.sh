#!/bin/bash

SERVER="$1"
PORT="$2"
USER="$3"
PASS="$4"
SCRIPT="$5"

test -z "$SERVER" ||
test -z "$PORT" ||
test -z "$USER" && {
  >&2 echo "Usage: $0 <server> <port> <user> <pass> [<script> | stdin]"
  exit 1
}


{ echo connect "$USER" "$PASS"

  if [ -e "$SCRIPT" ]; then
    cat "$SCRIPT"
  else
    cat -
  fi

  echo @quit
} | nc -q30 "$SERVER" "$PORT"
