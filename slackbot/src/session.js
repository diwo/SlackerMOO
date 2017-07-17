'use strict';

const net = require('net');

const BufferedWorker = require('./util/buffered-worker');
const F = require('./util/functions');

Session.EVENTS = F.toMap([
  'DATA'
], event => event);

function Session(serverHost, serverPort, playerName) {
  this.serverHost = serverHost;
  this.serverPort = serverPort;
  this.playerNamePromise = Promise.resolve(playerName);
  this.sendBuffer = null;
  this.receiveBuffer = null;
  this.socket = null;
  this.connected = false;
  this.eventHandlers = F.toMap(Object.keys(Session.EVENTS), () => []);
}

Session.prototype.on = function(event, cb) {
  this.eventHandlers[event].push(cb);
};

Session.prototype.send = function(input) {
  this._sanityCheck();

  if (!this.sendBuffer) {
    this.sendBuffer = new BufferedWorker({
      extract: queue => queue.pop(),
      execute: async payload => {
        try {
          var socket = await this._getConnection();
          await writeSocket(socket, `${payload}\n`);
        } catch (error) {
          this._destroy();
          throw error;
        }
      }
    });
  }

  this.sendBuffer.enqueue(input);
};

Session.prototype._getConnection = async function() {
  this._sanityCheck();

  if (!this.socket) {
    // Connect
    await new Promise((resolve, reject) => {
      this.socket = this._createSocket(
        socket => {
          this.connected = true;
          resolve(socket);
        }, reject);
    });

    // Login
    var playerName = await this.playerNamePromise;
    if (playerName) {
      await writeSocket(this.socket, `connect ${playerName}\n`);
    }
  }

  if (!this.connected) {
    this._destroy();
    throw Error('Unexpected multiple callers to _getConnection() detected!');
  }

  return this.socket;
};

async function writeSocket(socket, data) {
  return new Promise((resolve, reject) => {
    try {
      socket.write(data, 'utf8', resolve);
    } catch (error) {
      reject(error);
    }
  });
}

Session.prototype._createSocket = function(resolve, reject) {
  var socket = new net.Socket();

  var onConnect = () => {
    socket.removeListener('error', onError);
    resolve(socket);
  };
  var onError = error => {
    socket.destroy();
    reject(error);
  };

  socket.on('connect', onConnect);
  socket.on('error', onError);
  socket.on('close', () => this._destroy());
  socket.on('data', data => {
    this._getReceiveBuffer().enqueue(data);
  });
  socket.setEncoding('utf8');

  socket.connect(this.serverPort, this.serverHost);

  return socket;
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

Session.prototype._destroy = function() {
  if (this.socket) {
    this.socket.destroy();
  }
  this.destroyed = true;
  this.socket = null;
};

Session.prototype._sanityCheck = function() {
  if (this.destroyed) {
    throw Error('Session is already destroyed');
  }
};

module.exports = Session;
