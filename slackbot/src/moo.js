'use strict';

const Session = require('./session');
const F = require('./util/functions');

Moo.EVENTS = F.toMap([
  'DATA'
], event => event);

function Moo(connectionString) {
  var [host, port] = connectionString.split(':');
  if (!host || !port) {
    throw Error(`Invalid MOO server address '${connectionString}'`);
  }

  this.host = host;
  this.port = port;
  this.sessions = {};
  this.eventHandlers = F.toMap(Object.keys(Moo.EVENTS), () => []);
}

Moo.prototype.on = function(event, cb) {
  this.eventHandlers[event].push(cb);
};

Moo.prototype.send = function(user, input) {
  var session = this.sessions[user];
  if (!session || session.destroyed) {
    session = new Session(this.host, this.port, this._resolvePlayer(user));
    session.on(Session.EVENTS.DATA, data => {
      this.eventHandlers.DATA
        .forEach(handler => handler(user, data));
    });
    this.sessions[user] = session;
  }

  session.send(input);
};

Moo.prototype._resolvePlayer = async function(/* user */) {
  // TODO: resolve playerName from moo db
  return null;
};

module.exports = Moo;
