/*eslint linebreak-style: ["error", "windows"]*/

var express = require('express');
var debug = require('debug')('*');
var fs = require('fs');
var makeChat = require('./static/chat.js');
var sodium = require('libsodium-wrappers');

/**
 *  Define the sample application.
 */
var ChatApp = function () {
  //  Scope.
  var self = this;
  /**
   *  Set up server IP address and port # using env variables/defaults.
   */
  self.setupVariables = function () {
    //  Set the environment variables we need.
    self.ipaddress = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
    self.port = process.env.OPENSHIFT_INTERNAL_PORT || process.env.OPENSHIFT_NODEJS_IP || 8043;
    self.httpport = 8080;

    if (typeof self.ipaddress === 'undefined') {
      //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
      //  allows us to run/test the app locally.
      debug('No OPENSHIFT_INTERNAL_IP var, using 127.0.0.1');
      self.ipaddress = '127.0.0.1';
    }
    debug(self.ipaddress + ':' + self.port);
  };

  /**
   *  Populate the cache.
   */
  self.populateCache = function () {
    if (typeof self.zcache === 'undefined') {
      self.zcache = {
        'index.html': ''
      };
    }
    //  Local cache for static content.
    for (var i = 0; i < self.static_files.length; i++) {
      self.zcache[self.static_files[i]] = fs.readFileSync('./static/' + self.static_files[i]);
    }
  };

  var readTheFile = function(i) {
    var path = self.static_files[i];
    fs.readFile('./static/' + path, function (error, data) {
      if (!error) {
        self.zcache[path] = data;
      }
    });
  };

  self.refreshCache = function () {
    for (var i = 0; i < self.static_files.length; i++) {
      readTheFile(i);
    }
  };

  self.dirFiles = function (dir_path) {
    var file_list = [];
    var dir_items = fs.readdirSync(dir_path);
    for (var i = 0; i < dir_items.length; i++) {
      var stats = fs.statSync(dir_path + dir_items[i]);
      if (stats.isFile()) {
        file_list.push(dir_items[i]);
      } else {
        // dir_items[i] is a directory
      }
    }
    return file_list;
  };

  /**
   *  Retrieve entry (content) from cache.
   *  @param {string} key  Key identifying content to retrieve from cache.
   */
  self.cache_get = function (key) {
    return self.zcache[key];
  };

  /**
   *  terminator === the termination handler
   *  Terminate server on receipt of the specified signal.
   *  @param {string} sig  Signal to terminate on.
   */
  self.terminator = function (sig) {
    if (typeof sig === 'string') {
      debug('%s: Received %s - terminating sample app ...',
        Date(Date.now()), sig);
      process.exit(1);
    }
    debug('%s: Node server stopped!', Date(Date.now()));
  };


  /**
   *  Setup termination handlers (for exit and a list of signals).
   */
  self.setupTerminationHandlers = function () {
    //  Process on exit and signals.
    process.on('exit', function () {
      self.terminator();
    });
    // Removed 'SIGPIPE' from the list - bugz 852598.
    ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
      'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
    ].forEach(function (element, index, array) { // eslint-disable-line no-unused-vars
      process.on(element, function () {
        self.terminator(element);
      });
    });
  };

  self.createRoutes = function () {
    self.routes = {};

    // Routes for /health, /asciimo and /
    self.routes['/health'] = function (req, res) {
      res.send('1');
    };

    self.routes['/'] = self.createStaticRoute('index.html');

    // Create new chat and send redirect to it
    self.routes['/new/*'] = function (req, res) {
      res.setHeader('Content-Type', 'application/json');
      var slice_point = req.url.lastIndexOf('/new/');
      var slice_point_p = req.url.indexOf('&');
      // debug('req: %O', req);
      // debug('**req url**:', req.url);
      var pass = '';
      if (slice_point_p > 0) {
        pass = req.url.slice(slice_point_p + 1);
      }
      // debug('*chat pass:', pass);
      var chat_url = req.url.slice(slice_point + 5, slice_point_p);
      // debug('*chat url:', chat_url);
      if (slice_point >= 0) {
        if (self.chats[chat_url]) {
          res.send({
            error: 'That chat name is already in use'
          });
        } else {
          var chat_name = chat_url.split('_').join(' ');
          //debug('Creating chat with: %s %s', chat_name, pass);
          self.chats[chat_url] = self.createChat(chat_name, pass);
          //debug('Created chat: %O', self.chats[chat_url]);
          res.send({
            redirect: chat_url
          });
        }
      } else {
        res.send({
          error: 'No chat name specified in ' + req.url
        });
      }
    };

    /*
    // Add routes for uncached image files
    for (var i=0; i<self.image_files.length; i++) {
        debug('Creating uncached route for ' + self.image_files[i]);
        self.routes['/' + self.image_files[i]] = self.createUncachedRoute('./images/' + self.image_files[i]);
    }
    */

    // Add routes for static files in cache
    for (var i = 0; i < self.static_files.length; i++) {
      debug('Creating cached route for %s', self.static_files[i]);
      self.routes['/' + self.static_files[i]] = self.createStaticRoute(self.static_files[i]);
    }

    self.routes['/*'] = function (req, res) {
      var slice_point = req.url.indexOf('?');
      if (slice_point < 0) {
        // undefined slice point means substring will continue to end of string
        slice_point = undefined;
      }
      var chat_url = req.url.substring(1, slice_point);
      debug('%s requested', chat_url);
      if (self.chats[chat_url]) {
        self.createStaticRoute('chat.html')(req, res);
      } else {
        res.status(302);
        debug('redirecting to https://%s', req.headers.host);
        res.setHeader('Location', 'https://' + req.headers.host);
        res.setHeader('Content-Type', 'text/html');
        var error_page = '<html><body style="';
        error_page += 'text-align: center; color: #444448; background-color: #EEEEF3; font-family: sans-serif';
        error_page += '"><h2>Sorry</h2><p>The page could not be found</p></body></html>';
        res.send(error_page);
      }
    };
  };

  self.createUncachedRoute = function (uncached_file) {
    return function (req, res) {
      var mime_type = self.mimeType[uncached_file.substring(uncached_file.lastIndexOf('.') + 1)];
      if (mime_type === undefined) {
        mime_type = 'text/plain';
      }
      res.setHeader('Content-Type', mime_type);
      fs.readFile(uncached_file, function (err, data) {
        if (err) {
          debug('Unable to read file %s', uncached_file);
          res.send('');
        } else {
          res.send(data);
        }
      });
    };
  };

  self.createStaticRoute = function (static_file) {
    return function (req, res) {
      var mime_type = self.mimeType[static_file.substring(static_file.lastIndexOf('.') + 1)];
      if (mime_type === undefined) {
        mime_type = 'text/plain';
      }
      debug(static_file, mime_type);
      res.setHeader('Content-Type', mime_type);
      res.send(self.cache_get(static_file));
    };
  };

  self.mimeType = {
    txt: 'text/plain',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    xml: 'text/xml',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    ico: 'image/x-icon'
  };


  self.removeFileExtension = function (file_name) {
    var slice = file_name.lastIndexOf('.');
    if (slice > 0) {
      return file_name.substring(0, slice);
    }
    return file_name;
  };

  self.createChat = function (chat_name, pw) {
    // debug('pw:', pw);
    var chat = makeChat({
      server: true,
      chat_name: chat_name,
      chat_pass: pw
    });
    // debug(chat);
    chat.systemMessage('Chat created', self.io);
    return chat;
  };

  self.listenForConnections = function () {
    self.io.sockets.on('connection', function (socket) {
      self.cnxCount();
      //debug('chat_name?', socket.handshake.headers.referer.slice(socket.handshake.headers.referer.lastIndexOf('/') + 1));
      debug('New Connexion id: %s - ref: %O', socket.id, socket.handshake.headers.referer);
      socket.on('check if locked', function (data) {
        debug('checking if locked: %s', data.chat_url);
        if (data.chat_url && self.chats[data.chat_url]) {
          socket.chat_url = data.chat_url;
          if (self.chats[data.chat_url].locked) {
            socket.emit('chat locked');
            socket.emit('new message', {
              text: 'Sorry, this chat is locked'
            });
          } else {
            socket.emit('chat unlocked');
          }
        } else {
          debug('bad request');
        }
      });
      socket.on('join chat', function (data) {
        // debug('data.name: %s', data.name);
        if (!data.name) {
          socket.emit('callback', 'join chat', {
            accepted: false,
            error: 'You must specifie a user name'
          });
          return;
        }
        if (data && data.chat_url && data.name) {
          var chat = self.chats[data.chat_url];
          if (chat) {
            if (chat.locked) {
              socket.emit('callback', 'join chat', {
                accepted: false,
                error: 'Sorry, the chat has been locked'
              });
              // send data to the locked chat members
              self.io.sockets.to(chat.chat_name).emit('locked try', data);
            } else if (chat.chatters.get(data.name)) {
              socket.emit('callback', 'join chat', {
                accepted: false,
                error: 'Sorry, the user name ' + data.name + ' is already in use'
              });
            } else if (chat.chat_pass && !data.chat_pass) {
              debug('pass requested w/o password!');
              socket.emit('callback', 'join chat', {
                accepted: false,
                error: 'This chat require a password to connect to it'
              });
            } else {
              // debug('chat: %O', chat);
              // (async() => {
              //   await _sodium.ready;
              //   const sodium = _sodium;
              if (chat.chat_pass) {
                debug('pass requested');
                debug('pass request data: %O', data);
                var hash = sodium.to_string(sodium.from_base64(chat.chat_pass));
                console.log('hash:', hash);
                var pw = sodium.to_string(sodium.from_base64(data.chat_pass));
                // console.log('pw:', pw);
                // console.log('hash === pw:', hash === pw);
                // console.log('compare:', sodium.from_string(hash), sodium.from_string(pw), sodium.compare(sodium.from_string(hash), sodium.from_string(pw)));
                if (sodium.crypto_pwhash_str_verify(hash, pw)) {
                  console.log('Password OK!');
                } else if (sodium.from_string(hash).length === sodium.from_string(pw).length && sodium.compare(sodium.from_string(hash), sodium.from_string(pw)) === 0) {
                  console.log('Password OK!');
                } else {
                  console.log('Wrong password!');
                  socket.emit('callback', 'join chat', {
                    accepted: false,
                    error: 'Wrong password'
                  });
                  return false;
                }
              }
              debug('%s joined the chat', data.name);
              socket.chatter = new chat.Chatter(data);
              socket.join(chat.chat_name);
              self.io.sockets.to(chat.chat_name).emit('new chatter', data);
              // debug('chat messages: %O', chat.messages);
              socket.emit('initialize history', {
                chat_name: chat.chat_name,
                chatters: chat.chatters,
                messages: chat.messages
              });
              socket.emit('callback', 'join chat', {
                accepted: true
              });
              self.setupEvents(socket, chat);
              // })();
            }
          } else {
            socket.emit('callback', 'join chat', {
              accepted: false,
              error: 'Sorry, the chat no longer exists'
            });
          }
        } else {
          socket.emit('callback', 'join chat', {
            accepted: false,
            error: 'Sorry, the join request was invalid'
          });
        }
      });
    });
  };

  self.cnxCount = function(chatName) {
    if (chatName) {
      self.io.of('/').in(chatName).clients(function (error, clients) {
        debug('connections in %s: %d', chatName, clients.length);
        self.io.sockets.to(chatName).emit('count cnx', clients.length);
      });
      self.io.of('/').clients(function (error, clients) {
        debug('total connections: %d', clients.length);
        self.io.sockets.to('/').in(chatName).emit('count totcnx', clients.length);
      });
    }
  };

  self.setupEvents = function (socket, chat) {
    self.cnxCount(chat.chat_name);
    socket.on('new message', function (data) {
      /* var message =  */new chat.Message(data);
      debug('redirecting new message data: %O', data);
      self.io.sockets.to(chat.chat_name).emit('new message', data);
    });

    socket.on('encrypted message', function (data) {
      /* var message =  */new chat.Message(data);
      debug('redirecting encrypted message data: %O', data);
      self.io.sockets.to(chat.chat_name).emit('encrypted message', data);
    });

    var disconnect = function () {
      debug('disconnect');
      if (socket.chatter) {
        var name = socket.chatter.name;
        var message = new chat.Message({
          text: name + ' has left the chat'
        });
        self.io.sockets.to(chat.chat_name).emit('new message', message);
        chat.chatters.destroy(socket.chatter.name);
        socket.leave(chat.chat_name);
        self.io.sockets.to(chat.chat_name).emit('chatter disconnected', {
          name: name
        });
        // send nb cnx
        self.cnxCount(chat.chat_name);

        // reset chat if everyone has left
        if (chat.chatters.length === 0) {
          // clearInterval(toCountChatters);
          if (socket.chat_url) {
            self.chats[socket.chat_url] = undefined;
          }
        }
      }
    };
    socket.on('disconnect', disconnect);
    socket.on('leave chat', disconnect);

    socket.on('username changed', function (data) {
      chat.systemMessage(data.old_name + ' changed name for ' + data.new_name, self.io);
    });

    socket.on('clear messages', function () {
      debug('clear messages');
      chat.messages = [];
      self.io.sockets.to(chat.chat_name).emit('clear messages');
    });
    socket.on('lock chat', function () {
      debug('%s locked the chat', socket.chatter.name);
      chat.locked = true;
      self.io.sockets.to(chat.chat_name).emit('chat locked');
      chat.systemMessage(socket.chatter.name + ' has locked the chat', self.io);
    });
    socket.on('unlock chat', function () {
      debug('%s unlocked the chat', chat.chat_name);
      chat.locked = false;
      self.io.sockets.to(chat.chat_name).emit('chat unlocked');
      chat.systemMessage(socket.chatter.name + ' has unlocked the chat', self.io);
    });
  };

  /**
   *  Initialize the server (express) and create the routes and register
   *  the handlers.
   */
  self.initializeServer = function () {
    self.createRoutes();
    self.app = express();
    var svrOptions = {
      key: fs.readFileSync('keys/serverkey.pem'),
      cert: fs.readFileSync('keys/servercert.pem'),
      ca: fs.readFileSync('keys/cacert.pem')
    };
    // keys_dir = 'keys/';
    self.server = require('https').createServer(svrOptions, self.app);
    self.serverhttp = require('http').createServer(self.app);

    self.app.use(function (req, res, next) {
      if (req.secure) {
        next();
      } else {
        // debug(req.headers.host);
        var slice_point = req.headers.host.lastIndexOf(':');
        var host = req.headers.host.slice(0, slice_point);
        debug('requested: http://%s -> redirected to: https://%s:%s', req.headers.host, host, self.port);
        res.redirect('https://' + host + ':' + self.port);
      }
    });

    self.io = require('socket.io').listen(self.server);
    self.chats = {};
    // self.chats.DaveChat = self.createChat('DaveChat');
    self.listenForConnections();

    //  Add handlers for the app (from the routes).
    for (var r in self.routes) {
      self.app.get(r, self.routes[r]);
    }
  };

  /**
   *  Initializes the application.
   */
  self.initialize = function () {
    self.setupVariables();
    self.static_files = self.dirFiles('./static/');
    // self.image_files = self.dirFiles('./images/');
    self.populateCache();
    self.setupTerminationHandlers();
    setInterval(self.refreshCache, 1000);

    // Create the express server and routes.
    self.initializeServer();
  };

  /**
   *  Start the server (starts up the sample application).
   */
  self.start = function () {
    //  Start the app on the specific interface (and port).
    self.server.listen(self.port, self.ipaddress, function () {
      debug('%s: Node server https started on %s:%d ...',
        Date(Date.now()), self.ipaddress, self.port);
    });
    self.serverhttp.listen(self.httpport, self.ipaddress, function () {
      debug('%s: Node server http started on %s:%d ...',
        Date(Date.now()), self.ipaddress, self.httpport);
    });
  };

};

var zapp = new ChatApp();
zapp.initialize();
zapp.start();
