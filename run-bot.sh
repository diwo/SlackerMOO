#!/bin/bash

cd "$(dirname "$0")"
cd ./slackbot

if [ ! -e "slack-bot-token.secret" ]; then
  >&2 echo "Error: Missing file 'slackbot/bot-access-token.secret'"
  >&2 echo "Please create this file with the bot's access token obtained from Slack's app settings"
  exit 1
fi

npm install
exec npm start
