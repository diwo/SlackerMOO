#!/bin/bash

cd "$(dirname "$0")"

docker build -t slackmoo/stunt moo

if [ -n "$(docker ps -qf name=moo)" ]; then
  >&2 echo "Error: Moo is already running"
  exit 1
fi

docker rm moo
exec docker run -it -p 7777:7777 -v moo-data:/data --name moo slackmoo/stunt
