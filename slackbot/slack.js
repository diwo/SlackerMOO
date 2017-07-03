'use strict';

const slack = require('@slack/client');
const R = require('ramda');

const EVENTS = ['DM_RECEIVED'];

function Slack(apiToken) {
  this.rtm = new slack.RtmClient(apiToken);
  this.userChannels = {};
  this.eventHandlers = R.zipObj(
    EVENTS,
    EVENTS.map(() => []));

  this._init();
}

Slack.prototype._init = function() {
  var self = this;

  self.rtm.on(slack.CLIENT_EVENTS.RTM.AUTHENTICATED, function() {
    console.log('RTM authenticated!');
  });

  self.rtm.on(slack.RTM_EVENTS.MESSAGE, function(messageData) {
    var {channel, user:userId, text} = messageData;
    var user = self.rtm.dataStore.users[userId];

    var isDirectMessage = channel.match(/^D/);
    if (isDirectMessage) {
      self.userChannels[user.name] = channel;

      var userProfile = {
        id: user.id,
        name: user.name,
        real_name: user.real_name,
        email: user.profile.email,
        first_name: user.profile.first_name,
        last_name: user.profile.last_name
      };

      self.eventHandlers.DM_RECEIVED
        .forEach(handler => handler(text, userProfile));
    }
  });
};

Slack.prototype.on = function(event, cb) {
  this.eventHandlers[event].push(cb);
};

Slack.prototype.sendMessage = function(user, message) {
  this.rtm.sendMessage(message, this.userChannels[user]);
};

Slack.prototype.start = function() {
  this.rtm.start();
};

Slack.EVENTS = R.zipObj(EVENTS, EVENTS);

module.exports = Slack;
