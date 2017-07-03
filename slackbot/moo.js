'use strict';

const net = require('net');
const R = require('ramda');

const EVENTS = ['DATA'];

function Moo(serverAddress) {
  var [host, port] = serverAddress.split(':');
  if (!host || !port) {
    throw Error(`Invalid MOO server address '${serverAddress}`);
  }

  this.host = host;
  this.port = port;
  this.connections = {};
  this.eventHandlers = R.zipObj(
    EVENTS,
    EVENTS.map(() => []));
}

Moo.prototype.on = function(event, cb) {
  this.eventHandlers[event].push(cb);
};

Moo.prototype.getSocket = function(user) {
  var self = this;

  return new Promise(function(resolve) {
    if (self.connected(user)) {
      resolve(self.connections[user]);
      return;
    }

    var socket = new net.Socket();
    socket.setEncoding('utf8');
    socket.on('data', function(data) {
      self.eventHandlers.DATA
        .forEach(handler => handler(user, data));
    });
    self.connections[user] = socket;
    socket.connect(self.port, self.host, () => resolve(socket));
  });
};

Moo.prototype.disconnect = function(user) {
  if (this.connected(user)) {
    this.connections[user].end();
    this.connections[user] = null;
  }
};

Moo.prototype.userSend = function(user, input) {
  this.getSocket(user).then(socket => socket.write(`${input}\n`));
};

Moo.prototype.connected = function(user) {
  var socket = this.connections[user];
  if (socket && !socket.destroyed) {
    return true;
  }
  this.connections[user] = null;
  return false;
};

Moo.EVENTS = R.zipObj(EVENTS, EVENTS);

module.exports = Moo;
