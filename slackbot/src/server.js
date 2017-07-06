'use strict';

const fs = require('fs');
const SlackerMoo = require('./slackermoo');
const config = require('../config');

fs.readFile(config.slackBotTokenFile, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error: Missing file '${config.slackBotTokenFile}'`);
    console.error(`Please create this file with the bot's access token obtained from Slack's app settings`);

    process.exit(1);
  }

  var slackBotToken = data.trim();
  var moo = new SlackerMoo(slackBotToken, config.mooServerAddress);
  moo.start();
});
