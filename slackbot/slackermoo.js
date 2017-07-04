'use strict';

const Slack = require('./slack');
const Moo = require('./moo');

function SlackerMoo(slackApiToken, mooServerAddress) {
  this.slack = new Slack(slackApiToken);
  this.moo = new Moo(mooServerAddress);
  this.mooDataBuffer = {};

  this._init();
}

SlackerMoo.prototype._init = function() {
  this.slack.on(Slack.EVENTS.DM_RECEIVED, (text, userProfile) => {
    this.moo.send(userProfile.name, toAscii(text));
  });

  this.moo.on(Moo.EVENTS.DATA, (user, data) => {
    var dataBuffer = this.mooDataBuffer[user] || '';
    dataBuffer += data;
    var flushIdx = dataBuffer.lastIndexOf('\n');

    this.slack.send(user, dataBuffer.substr(0, flushIdx));
    this.mooDataBuffer[user] = dataBuffer.substr(flushIdx + 1);
  });
};

function toAscii(text) {
  const mappings = [
    { from: '“', to: '"', comment: 'Left double quotation mark' },
    { from: '”', to: '"', comment: 'Right double quotation mark' },
    { from: '‘', to: '\'', comment: 'Left single quotation mark' },
    { from: '’', to: '\'', comment: 'Right single quotation mark' }
  ];

  return mappings
    .map(mapping => text => text.replace(RegExp(mapping.from, 'g'), mapping.to))
    .reduce((accum, transform) => transform(accum), text);
}

SlackerMoo.prototype.start = function() {
  this.slack.start();
};

module.exports = SlackerMoo;
