'use strict';

const slack = require('@slack/client');

const BufferedWorker = require('./util/buffered-worker');
const F = require('./util/functions');

const MESSAGE_CHAR_LIMIT = 4000;
const MESSAGE_PREFIX = '```';
const MESSAGE_SUFFIX = '```';

Slack.EVENTS = F.toMap([
  'DM_RECEIVED',
  'GROUP_MESSAGE_RECEIEVED'
], event => event);

function Slack(apiToken) {
  this.rtm = new slack.RtmClient(apiToken);
  this.userInfos = {};
  this.eventHandlers = F.toMap(Object.keys(Slack.EVENTS), () => []);

  this._init();
}

Slack.prototype._init = function() {
  this.rtm.on(slack.CLIENT_EVENTS.RTM.AUTHENTICATED, () => {
    console.log('RTM authenticated!');
  });

  this.rtm.on(slack.RTM_EVENTS.MESSAGE, ({channel, user:userId, text, subtype}) => {
    var user = this.rtm.dataStore.users[userId];

    var userProfile = {
      id: user.id,
      name: user.name,
      real_name: user.real_name,
      email: user.profile.email,
      first_name: user.profile.first_name,
      last_name: user.profile.last_name
    };

    var isDirectMessage = channel.match(/^D/);
    var isGroupOrChannel = channel.match(/^[GC]/);

    if (isDirectMessage && !subtype) {
      var userInfo = this._getUserInfo(user.name);
      userInfo.channel = channel;
      userInfo.startNewMessage = true;

      this.eventHandlers.DM_RECEIVED
        .forEach(handler => handler(text, userProfile));
    } else if (isGroupOrChannel) {
      var groupOrChannel = this.rtm.dataStore.groups[channel] || this.rtm.dataStore.groups[channel]
      this.eventHandlers.GROUP_MESSAGE_RECEIEVED
        .forEach(handler => handler(text, userProfile, groupOrChannel));
    }
  });
};

Slack.prototype.on = function(event, cb) {
  this.eventHandlers[event].push(cb);
};

Slack.prototype.send = function(user, text) {
  var userInfo = this._getUserInfo(user);

  var sender = userInfo.messageSender;
  if (!sender) {
    sender = new BufferedWorker({
      extract: workerExtract(() => userInfo.startNewMessage),
      execute: workerExecute(this.rtm, userInfo.channel, () => {
        userInfo.startNewMessage = false;
      })
    });
    userInfo.messageSender = sender;
  }

  sender.enqueue(...text.split('\n'));
};

Slack.prototype.sendChannel = async function(channel, text) {
  try {
    await this.rtm.sendMessage(text, channel);
  } catch (error) {
    console.error(error);
  }
};

function workerExtract(isStartNewMessage) {
  return function(queue, previous) {
    var useExistingMessage = !isStartNewMessage() && previous;
    if (previous && !isWithinMessageSizeLimit(previous.payload.text, queue.peek())) {
      useExistingMessage = false;
    }

    var text = useExistingMessage ? previous.payload.text : '';
    while (!queue.isEmpty() && isWithinMessageSizeLimit(text, queue.peek())) {
      if (text) {
        text += '\n';
      }
      text += queue.pop();
    }

    return {text, useExistingMessage};
  };
}

function workerExecute(rtm, channel, callback) {
  return function(payload, previous) {
    var {text, useExistingMessage} = payload;

    var execution;
    if (useExistingMessage) {
      execution = rtm.updateMessage({
        ts: previous.result.ts,
        channel: channel,
        text: decorateMessageText(text)
      });
    } else {
      execution = rtm.sendMessage(decorateMessageText(text), channel);
    }

    callback();
    return execution;
  };
}

Slack.prototype._getUserInfo = function(user) {
  var userInfo = this.userInfos[user];
  if (!userInfo) {
    userInfo = {
      channel: null,
      messageSender: null,
      startNewMessage: null
    };
    this.userInfos[user] = userInfo;
  }
  return userInfo;
};

function isWithinMessageSizeLimit(...parts) {
  // Parts will be joined by '\n' character
  var messageSize =
    [...parts, MESSAGE_PREFIX, MESSAGE_SUFFIX]
      .map(part => part.length)
      .reduce((sum, val) => sum + val + 1);

  // The message will be expanded by Slack with markup,
  // which may put the message over the size limit.
  // Leaving some room for expansion and hope it doesn't go over...
  return messageSize <= MESSAGE_CHAR_LIMIT * 0.85;
}

function decorateMessageText(text) {
  return MESSAGE_PREFIX + text + MESSAGE_SUFFIX;
}

Slack.prototype.start = function() {
  this.rtm.start();
};

module.exports = Slack;
