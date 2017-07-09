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

payload() {
 echo connect "$USER" "$PASS"
 cat "$SCRIPT"
 echo @quit
}

payload | sed 's/^/> /'
payload | nc -q30 "$SERVER" "$PORT"
