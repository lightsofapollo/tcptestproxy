suite('proxy server', function() {
  var net = require('net'),
      ProxyServer = require('./');

  /** Fake server */

  var fakeServer,
      fakePort;

  setup(function(done) {
    // open random port
    fakeServer = net.createServer();
    fakeServer.once('error', done);
    fakeServer.once('listening', function() {
      fakePort = fakeServer.address().port;
      done();
    });
    fakeServer.listen(0);
  });

  teardown(function() {
    fakeServer.close();
  });

  /** Source port configuration */

  var sourcePort,
      proxy;
  setup(function(done) {
    proxy = new ProxyServer(fakePort);
    proxy.listen(0).once('listening', function() {
      var addr = proxy.server.address();
      sourcePort = addr.port;
      done();
    });
  });

  test('end to end connect', function(done) {
    var pending = 2;
    function complete() {
      if (--pending === 0) done();
    }

    net.connect(sourcePort, null, complete);
    fakeServer.once('connection', complete);
  });

  suite('data mirroring', function() {
    var source;
    setup(function() {
      source = net.connect(sourcePort);
    });

    teardown(function() {
      source.destroy();
    });

    test('closing', function(done) {
      source.once('connect', function() {
        var ended;
        source.once('end', function() {
          ended = true;
          done();
        });

        proxy.close();
      });
    });

    test('mirror bytes', function(done) {
      var buffer = new Buffer('123');

      fakeServer.once('connection', function(socket) {
        socket.once('data', function(content) {
          assert.equal(buffer.toString(), content.toString());
          done();
        });
      });

      source.write(buffer);
    });

    test('source closes', function(done) {
      fakeServer.once('connection', function(destination) {
        destination.once('end', function() {
          assert.ok(ended);
          done();
        });

        ended = true;
        source.end();
      });
    });

    test('destination closes', function(done) {
      var ended = false;
      fakeServer.once('connection', function(socket) {
        ended = true;
        socket.end();
      });

      source.once('end', function() {
        assert.ok(ended);
        done();
      });
    });
  });
});
