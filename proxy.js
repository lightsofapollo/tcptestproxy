var net = require('net');
var debug = require('debug')('tcpproxytest');

function ProxyServer(targetPort, targetHost) {
  this.target = { port: targetPort, host: targetHost };
  this.connections = [];
}

ProxyServer.prototype = {
  /**
  @type net.Server
  */
  server: null,

  /**
  Port where server is bound. Is null until the server is bound to a port.

  @type Number
  */
  port: null,

  onConnect: function(source) {
    debug('inbound connection!', source.address());

    var closeConnection = function(socket) {
      if (connection) {
        var idx = this.connections.indexOf(connection);
        if (idx !== -1) this.connections.splice(idx, 1);
        connection = null;
      }
      // set it to null if its not null already!
      socket.end();
    }.bind(this);

    // start opening the proxy connection.
    var destination = net.connect(
      this.target.port,
      this.target.host
    );

    // new socket connection.. time to setup the proxy logic.
    var connection = {
      endPending: false,
      opened: false,
      source: source,
      destination: destination
    };

    // push to the central list of connections so we can close sockets
    this.connections.push(connection);

    function sourceEnd() {
      // if we are already opened immediately send the FIN
      if (connection.opened) return closeConnection(destination);

      // otherwise wait until we are open to send the fin.
      connection.endPending = true;
    }

    // map writes from source to dest
    source.pipe(destination);
    // and from dest to source
    destination.pipe(source);

    // FIN packet
    source.once('end', sourceEnd);

    destination.once('connect', function() {
      debug('opened proxy connection to destination', destination.address());
      if (connection.endPending) return closeConnection(destination);
      // "opened" indicates both source and dest are writable.
      connection.opened = true;

      // send FIN to source if destination is closed.
      destination.once('end', function() {
        // don't trigger end on source and destination at once.
        source.removeListener('end', sourceEnd);
        closeConnection(source);
      });
    });
  },

  onListening: function() {
    var addr = this.server.address();
    this.port = addr.port;
  },

  listen: function(port, callback) {
    if (this.server) {
      throw new Error('only one server can be running per proxy server');
    }

    debug('starting server at port', port, 'for', this.target);

    this.server = net.createServer();
    this.server.listen(port, this.onListening.bind(this));
    this.server.on('connection', this.onConnect.bind(this));

    // mimic normal net.Server.listen call.
    if (callback) this.server.once('listening', callback);

    return this.server;
  },

  close: function(callback) {
    // close all the things
    this.connections.forEach(function(con) {
      // will close and cleanup destination sockets too.
      con.source.end();
    });

    this.server.close(callback);
  },
};

module.exports = ProxyServer;
