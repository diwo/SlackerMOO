'use strict';

const fs = require('fs');
const SlackerMoo = require('./slackermoo');

// TODO: config file
const slackBotTokenPath = './slack-bot-token.secret';
const mooServerAddress = 'localhost:7777';

var slackBotToken = fs.readFileSync(slackBotTokenPath, 'UTF-8').trim();

var moo = new SlackerMoo(slackBotToken, mooServerAddress);

moo.start();
