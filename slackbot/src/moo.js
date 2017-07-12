'use strict';

const R = require('ramda');

const Session = require('./session');
const BufferedWorker = require('./util/buffered-worker');

const EVENTS = ['DATA'];

function Moo(connectionString) {
  var [host, port] = connectionString.split(':');
  if (!host || !port) {
    throw Error(`Invalid MOO server address '${connectionString}'`);
  }

  this.host = host;
  this.port = port;
  this.eventHandlers = R.zipObj(
    EVENTS,
    EVENTS.map(() => []));
  this.sendBuffers = {};
  this.sessions = {};
}

Moo.prototype.on = function(event, cb) {
  this.eventHandlers[event].push(cb);
};

Moo.prototype.send = function(user, input) {
  var buffer = this.sendBuffers[user];
  if (!buffer) {
    buffer = new BufferedWorker({
      extract: queue => queue.pop(),
      execute: payload =>
        this._getSession(user)
          .then(session => session.send(payload))
    });
    this.sendBuffers[user] = buffer;
  }
  buffer.enqueue(input);
};

Moo.prototype._getSession = function(user) {
  var session = this.sessions[user];
  if (!session) {
    // TODO: resolve playerName from moo db
    session = Promise.resolve(user)
      .then(playerName => {
        var session = new Session(playerName, {
          host: this.host,
          port: this.port
        });
        session.on(Session.EVENTS.DATA, data => {
          this.eventHandlers.DATA
            .forEach(handler => handler(user, data));
        });
        return session;
      });
    this.sessions[user] = session;
  }
  return session;
};

Moo.EVENTS = R.zipObj(EVENTS, EVENTS);

module.exports = Moo;
