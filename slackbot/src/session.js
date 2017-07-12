'use strict';

const net = require('net');
const R = require('ramda');

const BufferedWorker = require('./util/buffered-worker');

const EVENTS = ['DATA'];

function Session(playerName, serverAddress) {
  this.playerName = playerName;
  this.serverAddress = serverAddress;
  this.sendBuffer = null;
  this.receiveBuffer = null;
  this.socket = null;
  this.eventHandlers = R.zipObj(
    EVENTS,
    EVENTS.map(() => []));
}

Session.prototype.on = function(event, cb) {
  this.eventHandlers[event].push(cb);
};

Session.prototype.send = function(input) {
  this._getSendBuffer().enqueue(input);
};

Session.prototype._getSendBuffer = function() {
  if (!this.sendBuffer) {
    this.sendBuffer = new BufferedWorker({
      extract: queue => queue.pop(),
      execute: payload =>
        // TODO: Login with playerName first
        this._getSocket()
          .then(socket => new Promise((resolve, reject) => {
            try {
              socket.write(`${payload}\n`, 'utf8', resolve);
            } catch (error) {
              reject({error, socket});
            }
          }))
          .catch(({error, socket}) => {
            if (socket) {
              socket.destroy();
            }
            this.socket = null;
            throw error;
          })
    });
  }
  return this.sendBuffer;
};

Session.prototype._getSocket = function() {
  if (!this.socket) {
    this.socket = new Promise((resolve, reject) => {
      var socket = new net.Socket();
      socket.setEncoding('utf8');
      var onConnect = () => {
        socket.removeListener('error', onError);
        resolve(socket);
      };
      var onError = error => {
        socket.removeListener('error', onError);
        reject({error, socket});
      };
      socket.on('connect', onConnect);
      socket.on('error', onError);
      socket.on('data', data => {
        this._getReceiveBuffer().enqueue(data);
      });
      socket.connect(
        this.serverAddress.port,
        this.serverAddress.host);
    });
  }
  return this.socket;
};

Session.prototype._getReceiveBuffer = function() {
  if (!this.receiveBuffer) {
    this.receiveBuffer = new BufferedWorker({
      extract: (queue, previous) => {
        var buffer = '';
        if (previous && previous.payload.remaining) {
          buffer = previous.payload.remaining;
        }
        while (!queue.isEmpty()) {
          buffer += queue.pop().replace(/\r/g, '');
        }
        var lastNewlineIdx = buffer.lastIndexOf('\n');
        var data = buffer.substr(0, lastNewlineIdx);
        var remaining = buffer.substr(lastNewlineIdx + 1);
        return {data, remaining};
      },
      execute: ({data}) => {
        this.eventHandlers.DATA
          .forEach(handler => handler(data));
      }
    });
  }
  return this.receiveBuffer;
};

Session.EVENTS = R.zipObj(EVENTS, EVENTS);

module.exports = Session;
