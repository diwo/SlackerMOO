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
  this.rtm.on(slack.CLIENT_EVENTS.RTM.AUTHENTICATED, () => {
    console.log('RTM authenticated!');
  });

  this.rtm.on(slack.RTM_EVENTS.MESSAGE, ({channel, user:userId, text, subtype}) => {
    var user = this.rtm.dataStore.users[userId];

    var isDirectMessage = channel.match(/^D/);
    if (isDirectMessage && !subtype) {
      this.userChannels[user.name] = channel;

      var userProfile = {
        id: user.id,
        name: user.name,
        real_name: user.real_name,
        email: user.profile.email,
        first_name: user.profile.first_name,
        last_name: user.profile.last_name
      };

      this.eventHandlers.DM_RECEIVED
        .forEach(handler => handler(text, userProfile));

      this._startNewMessage(user.name);
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

Slack.prototype._processMessageQueue = function(user) {
  var processor = this._getUserMessageProcessor(user);
  if (processor.queue.isEmpty()) {
    processor.process = null;
    return null;
  }

  var useExistingMessage = processor.previousMessage;
  if (processor.previousMessage &&
      !isWithinMessageSizeLimit(processor.previousMessage.text, processor.queue.peekFront())) {
    useExistingMessage = false;
  }

  var text = useExistingMessage ? processor.previousMessage.text : '';
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
      ts: processor.previousMessage.ts,
      channel: this.userChannels[user],
      text: decorateMessageText(text)
    });
  } else {
    process = this.rtm.sendMessage(decorateMessageText(text), this.userChannels[user]);
  }

  return process.then(
    ({ts}) => {
      processor.previousMessage = {ts, text};
      return this._processMessageQueue(user);
    },
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
      process: null,
      previousMessage: null
    };
    this.userMessageProcessors[user] = processor;
  }
  return processor;
};

Slack.prototype._startNewMessage = function(user) {
  this._getUserMessageProcessor(user).previousMessage = null;
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
