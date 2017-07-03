'use strict';

const Slack = require('./slack');
const Moo = require('./moo');

function SlackerMoo(slackApiToken, mooServerAddress) {
  this.slack = new Slack(slackApiToken);
  this.moo = new Moo(mooServerAddress);

  this._init();
}

SlackerMoo.prototype._init = function() {
  var slack = this.slack;
  var moo = this.moo;

  slack.on(Slack.EVENTS.DM_RECEIVED, function(message, userProfile) {
    moo.userSend(userProfile.name, message);
  });

  moo.on(Moo.EVENTS.DATA, function(user, data) {
    var message = '```' + data + '```';
    slack.sendMessage(user, message);
  });
};

SlackerMoo.prototype.start = function() {
  this.slack.start();
};

module.exports = SlackerMoo;
