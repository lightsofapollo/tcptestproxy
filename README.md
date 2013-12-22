# tcptestproxy

TCP Proxy (only designed to handle testing cases... use at your own risk)

# Usage

```js
var ProxyServer = require('tcptestproxy')
var proxy = new ProxyServer(5672);

proxy.listen(
  0, // find an open port 
  function() {
    // yep I am listening to stuff
    proxy.port; // woot I got a port!
  }
);

```

See the _test.js files for more examples of (and more importantly how to use it in your tests).
