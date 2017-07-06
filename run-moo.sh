#!/bin/bash

IMAGE=slackermoo/stunt
CONTAINER=slackermoo-moo
VOLUME=slackermoo-moo-data

cd "$(dirname "$0")"
cd moo

if [ -n "$(docker ps -qf name=$CONTAINER)" ]; then
  >&2 echo "Error: Moo is already running"
  exit 1
fi

docker rm $CONTAINER
docker build -t $IMAGE .
exec docker run -it \
  --name $CONTAINER \
  -p 7777:7777 \
  -v $VOLUME:/data \
  $IMAGE
