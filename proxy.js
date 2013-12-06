var net = require('net');

function ProxyServer(targetPort, targetHost) {
  this.target = { port: targetPort, host: targetHost };
  this.server = null;
  this.connections = [];
}

ProxyServer.prototype = {

  onConnect: function(source) {
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
      buffers: [],
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

    // FIN packet
    source.once('end', sourceEnd);

    function bufferSource(buffer) {
      connection.buffers.push(buffer);
    }

    // push all data from source into the temp buffer
    source.on('data', bufferSource);

    destination.once('connect', function() {
      if (connection.endPending) return closeConnection(destination);
      // "opened" indicates both source and dest are writable.
      connection.opened = true;

      // send FIN to source if destination is closed.
      destination.once('end', function() {
        // don't trigger end on source and destination at once.
        source.removeListener('end', sourceEnd);
        closeConnection(source);
      });

      // destination is ready to write to
      source.removeListener('data', bufferSource);

      // write out the pending buffers
      connection.buffers.forEach(destination.write, destination);
      connection.buffers = null;

      // proxy all further writes directly
      source.on('data', destination.write.bind(destination));
    });
  },

  listen: function(port) {
    if (this.server) {
      throw new Error('only one server can be running per proxy server');
    }

    this.server = net.createServer();
    this.server.listen(port);
    this.server.on('connection', this.onConnect.bind(this));

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
