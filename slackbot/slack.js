'use strict';

const slack = require('@slack/client');
const R = require('ramda');
const Deque = require('double-ended-queue');

const EVENTS = ['DM_RECEIVED'];
const MESSAGE_CHAR_LIMIT = 4000;
const MESSAGE_PREFIX = '```';
const MESSAGE_SUFFIX = '```';

function Slack(apiToken) {
  this.rtm = new slack.RtmClient(apiToken);
  this.userChannels = {};
  this.userMessageProcessors = {};
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

  self.rtm.on(slack.RTM_EVENTS.MESSAGE, function({channel, user:userId, text, subtype}) {
    var user = self.rtm.dataStore.users[userId];

    var isDirectMessage = channel.match(/^D/);
    if (isDirectMessage && !subtype) {
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

Slack.prototype.send = function(user, text) {
  var processor = this._getUserMessageProcessor(user);
  Deque.prototype.push.apply(processor.queue, text.split('\n'));
  if (!processor.process) {
    processor.process = this._processMessageQueue(user);
  }
};

Slack.prototype._processMessageQueue = function(user, previousMessage) {
  var processor = this._getUserMessageProcessor(user);
  if (processor.queue.isEmpty()) {
    processor.process = null;
    return null;
  }

  var text = '';
  if (previousMessage) {
    text = previousMessage.text;
    if (!isWithinMessageSizeLimit(text, processor.queue.peekFront())) {
      // Existing message too long to append to, start new message
      return this._processMessageQueue(user);
    }
  }

  while (!processor.queue.isEmpty() &&
      isWithinMessageSizeLimit(text, processor.queue.peekFront())) {
    text += '\n' + processor.queue.shift();
  }

  var process;
  if (previousMessage) {
    process = this.rtm.updateMessage({
      ts: previousMessage.ts,
      channel: this.userChannels[user],
      text: decorateMessageText(text)
    });
  } else {
    process = this.rtm.sendMessage(decorateMessageText(text), this.userChannels[user]);
  }

  return process.then(({ts}) => this._processMessageQueue(user, {ts, text}));
};

Slack.prototype._getUserMessageProcessor = function(user) {
  var processor = this.userMessageProcessors[user];
  if (!processor) {
    processor = {
      queue: new Deque(),
      process: null
    };
    this.userMessageProcessors[user] = processor;
  }
  return processor;
};

function isWithinMessageSizeLimit(...parts) {
  // Parts will be joined by '\n' character
  var messageSize =
    [...parts, MESSAGE_PREFIX, MESSAGE_SUFFIX]
      .map(part => part.length)
      .reduce((sum, val) => sum + val + 1);
  return messageSize <= MESSAGE_CHAR_LIMIT;
}

function decorateMessageText(text) {
  return MESSAGE_PREFIX + text + MESSAGE_SUFFIX;
}

Slack.prototype.start = function() {
  this.rtm.start();
};

Slack.EVENTS = R.zipObj(EVENTS, EVENTS);

module.exports = Slack;
