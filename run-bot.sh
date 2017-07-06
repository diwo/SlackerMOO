#!/bin/bash

IMAGE=slackermoo/slackbot
CONTAINER=slackermoo-slackbot
BOT_TOKEN_FILE=slack-bot-token.secret

cd "$(dirname "$0")"
cd slackbot

if [ ! -e "$BOT_TOKEN_FILE" ]; then
  >&2 echo "Error: Missing file 'slackbot/$BOT_TOKEN_FILE'"
  >&2 echo "Please create this file with the bot's access token obtained from Slack's app settings"
  exit 1
fi

if [ -n "$(docker ps -qf name=$CONTAINER)" ]; then
  >&2 echo "Error: Bot is already running"
  exit 1
fi

docker rm $CONTAINER
docker build -t $IMAGE .
exec docker run -it \
  --name $CONTAINER \
  --network="host" \
  -v "$(pwd)/$BOT_TOKEN_FILE":/slackbot/$BOT_TOKEN_FILE \
  $IMAGE
