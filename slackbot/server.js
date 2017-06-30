var fs = require('fs');
var RtmClient = require('@slack/client').RtmClient;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;

var botTokenPath = './bot-access-token.secret';
var botToken = fs.readFileSync(botTokenPath, 'UTF-8').trim();

var rtm = new RtmClient(botToken);

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function() {
  console.log('RTM authenticated!');
});

rtm.on(RTM_EVENTS.MESSAGE, function(messageData) {
  var {channel, user:userId, text} = messageData;

  var isDirectMessage = channel.match(/^D/);
  if (isDirectMessage) {
    var name = rtm.dataStore.users[userId].profile.first_name;
    var reply =
      `Hello ${name}, you said:\n` +
      '```' + text + '```';
    rtm.sendMessage(reply, channel);
  }
});

rtm.start();
