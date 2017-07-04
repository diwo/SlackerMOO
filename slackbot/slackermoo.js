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
    this.moo.send(userProfile.name, text);
  });

  this.moo.on(Moo.EVENTS.DATA, (user, data) => {
    var dataBuffer = this.mooDataBuffer[user] || '';
    dataBuffer += data;
    var flushIdx = dataBuffer.lastIndexOf('\n');

    this.slack.send(user, dataBuffer.substr(0, flushIdx));
    this.mooDataBuffer[user] = dataBuffer.substr(flushIdx + 1);
  });
};

SlackerMoo.prototype.start = function() {
  this.slack.start();
};

module.exports = SlackerMoo;
