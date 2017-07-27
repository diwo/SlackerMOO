'use strict';

const Slack = require('./slack');
const Moo = require('./moo');

function SlackerMoo(slackApiToken, mooServerAddress) {
  this.slack = new Slack(slackApiToken);
  this.moo = new Moo(mooServerAddress);

  this._init();
}

SlackerMoo.prototype._init = function() {
  this.slack.on(Slack.EVENTS.DM_RECEIVED, (text, userProfile) => {
    this.moo.send(userProfile.name, toAscii(text));
  });

  this.moo.on(Moo.EVENTS.DATA, (user, data) => {
    this.slack.send(user, data);
  });

  this.slack.on(Slack.EVENTS.GROUP_MESSAGE_RECEIEVED,
    (text, userProfile, channel) => {
      if (text.startsWith('!')) {
        var [channelId, channelName, userName, userFirstName, command] =
          [channel.id, channel.name,
            userProfile.name, userProfile.first_name,
            text.slice(1)];
        this.moo.botSend(
          `= ${channelId} ${channelName} ${userName} ${userFirstName} ${command}`);
      }
  });

  this.moo.on(Moo.EVENTS.BOT_DATA, data => {
    var [prefix, channel, ...rest] = data.split(' ');
    if (prefix == '#SLACK#') {
      this.slack.sendChannel(channel, rest.join(' '));
    }
  });
};

function toAscii(text) {
  const mappings = [
    { from: '“', to: '"', comment: 'Left double quotation mark' },
    { from: '”', to: '"', comment: 'Right double quotation mark' },
    { from: '‘', to: '\'', comment: 'Left single quotation mark' },
    { from: '’', to: '\'', comment: 'Right single quotation mark' },
    { from: '&lt;', to: '<', comment: 'Less-than sign' },
    { from: '&gt;', to: '>', comment: 'Greater-than sign' },
    { from: '&amp;', to: '&', comment: 'Ampersand' }
  ];

  return mappings
    .map(mapping => text => text.replace(RegExp(mapping.from, 'g'), mapping.to))
    .reduce((accum, transform) => transform(accum), text);
}

SlackerMoo.prototype.start = function() {
  this.slack.start();
};

module.exports = SlackerMoo;
