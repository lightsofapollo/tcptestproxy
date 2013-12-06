suite('amqp', function() {
  var ProxyServer = require('./')
  var amqp = require('amqplib');

  var proxy;
  setup(function(done) {
    // default amqp port
    proxy = new ProxyServer(5672);
    proxy.listen(0, done);
  });

  // setup consumer
  var connection;
  setup(function(done) {
    return amqp.connect('amqp://localhost:' + proxy.port).then(function(_con) {
      connection = _con;
    });
  });

  var exchange = 'tcpproxytest';
  var queueName = 'queueName';

  function openExchange() {
    var channel;
    return connection.createChannel().then(
      function(channel) {
        return channel.assertExchange(
          exchange, 'direct', { durable: true }
        ).then(function() {
          return channel;
        });
      }
    );
  }

  var payload = new Buffer(122335);

  setup(function() {
    return openExchange().then(
      function(channel) {
        // send content out the queue!
        return channel.publish(
          exchange,
          queueName,
          payload
        );
      }
    );
  });

  test('consume', function(done) {
    var channel;
    openExchange().then(
      function(_channel) {
        channel = _channel;
        return channel.prefetch(1);
      }
    ).then(
      function() {
        return channel.assertQueue(queueName, { durable: true });
      }
    ).then(
      function() {
        // queue name is identical to the routing key
        return channel.bindQueue(queueName, exchange, queueName);
      }
    ).then(
      function() {
        channel.consume(queueName, function(message) {
          var args = Array.prototype.slice.call(arguments);

          assert.equal(
            message.content.toString(),
            payload.toString()
          );

          channel.ack(message);
          done();
        });
      }
    );
  });
});
