'use strict';

const Session = require('./session');

// eslint-disable-next-line no-unused-vars
function Moobot(serverHost, serverPort, playerName) {
  Session.apply(this, arguments);
// TODO
}
Moobot.prototype = Object.create(Session.prototype);
Moobot.prototype.constructor = Moobot;

module.exports = Moobot;
