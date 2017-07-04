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

  var useExistingMessage = previousMessage;
  if (useExistingMessage &&
      !isWithinMessageSizeLimit(previousMessage.text, processor.queue.peekFront())) {
    useExistingMessage = false;
  }

  var text = useExistingMessage ? previousMessage.text : '';
  while (!processor.queue.isEmpty() &&
      isWithinMessageSizeLimit(text, processor.queue.peekFront())) {
    if (text) {
      text += '\n';
    }
    text += processor.queue.shift();
  }

  var process;
  if (useExistingMessage) {
    process = this.rtm.updateMessage({
      ts: previousMessage.ts,
      channel: this.userChannels[user],
      text: decorateMessageText(text)
    });
  } else {
    process = this.rtm.sendMessage(decorateMessageText(text), this.userChannels[user]);
  }

  return process.then(
    ({ts}) => this._processMessageQueue(user, {ts, text}),
    err => {
      console.error(err);
      this.userMessageProcessors[user] = null;
    });
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

Slack.EVENTS = R.zipObj(EVENTS, EVENTS);

module.exports = Slack;
