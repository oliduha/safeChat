/*eslint linebreak-style: ["error", "windows"]*/

var express = require('express');
var debug = require('debug')('*');
var fs = require('fs');
var makeChat = require('./static/chat.js');
var sodium = require('libsodium-wrappers');
var serverConfigurations = require('./serverconfig');
// var common = require('./static/common');

/**
 *  Define the chat application.
 */
var ChatApp = function () {
  //  Scope.
  var self = this;

  /********************************** */
  // set local to true for tests if NOT online !!!
  self.local = false;
  /********************************** */

  /**
   *  Set up server IP address and port # using env variables/defaults.
   */
  /* self.setupVariables = function () {
    //  Set the environment variables we need.
    self.ipaddress = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
    // self.port = process.env.OPENSHIFT_INTERNAL_PORT || 8043;
    // self.httpport = 8080;
    self.port = 8080;

    if (typeof self.ipaddress === 'undefined') {
      //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
      //  allows us to run/test the app locally.
      debug('No OPENSHIFT_INTERNAL_IP var, using 127.0.0.1');
      self.ipaddress = '127.0.0.1';
    }
    debug(self.ipaddress + ':' + self.port);
  }; */

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
    for (var il = 0; il < self.lib_files.length; il++) {
      self.zcache[self.lib_files[il]] = fs.readFileSync('./static/lib/' + self.lib_files[il]);
    }
    for (var j = 0; j < self.image_files.length; j++) {
      self.zcache[self.image_files[j]] = fs.readFileSync('./static/img/' + self.image_files[j]);
    }
    for (var k = 0; k < self.icon_files.length; k++) {
      self.zcache[self.icon_files[k]] = fs.readFileSync('./static/img/icons/' + self.icon_files[k]);
    }
  };

  self.refreshCache = function () {
    for ( var i = 0; i < self.static_files.length; i++) {
      var path = self.static_files[i];
      fs.readFile('./static/' + path, function (error, data) {
        if (!error) {
          self.zcache[path] = data;
        }
      });
    }
  };

  self.dirFiles = function (dir_path) {
    var file_list = [];
    var dir_items = fs.readdirSync(dir_path);
    for (var i = 0; i < dir_items.length; i++) {
      var stats = fs.statSync(dir_path + dir_items[i]);
      if (stats.isFile()) {
        file_list.push(dir_items[i]);
      } // else { // dir_items[i] is a directory }
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
  /*  self.terminator = function (sig) {
    if (typeof sig === 'string') {
      debug('%s: Received %s - terminating sample app ...',
        Date(Date.now()), sig);
      process.exit(1);
    }
    debug('%s: Node server stopped!', Date(Date.now()));
  }; */


  /**
   *  Setup termination handlers (for exit and a list of signals).
   */
  /* self.setupTerminationHandlers = function () {
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
  }; */

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
      var chat_url = '';
      // debug('req: %O', req);
      debug('**req url**:', req.url);
      var pass = '';
      if (slice_point_p > 0) {
        pass = req.url.slice(slice_point_p + 1);
        chat_url = req.url.slice(slice_point + 5, slice_point_p);
      } else {
        chat_url = req.url.slice(slice_point + 5);
      }
      // var chat_url = req.url.slice(slice_point + 5, slice_point_p);
      // debug('*chat pass:', pass);
      debug('*chat url:', chat_url);
      debug('*chat pass:', pass);
      if (slice_point >= 0) {
        if (self.chats[chat_url]/*  && (self.chats[chat_url].chatters.length > 0 || (new Date() - self.chats[chat_url].birth) < 120000) */) {
          debug('chatters.length: %s', self.chats[chat_url].chatters.length);
          debug('chat.age: %ss', (new Date() - self.chats[chat_url].birth) / 1000);
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


    // Add routes for static files in cache
    for (var i = 0; i < self.static_files.length; i++) {
      // debug('Creating cached route for %s', self.static_files[i]);
      self.routes['/' + self.static_files[i]] = self.createStaticRoute(self.static_files[i]);
    }

    // Add routes for library files in cache
    for (var il = 0; il < self.lib_files.length; il++) {
      // debug('Creating cached route for library %s', self.lib_files[il]);
      self.routes['/lib/' + self.lib_files[il]] = self.createStaticRoute(self.lib_files[il]);
    }

    // Add routes for image files in cache
    for (var j = 0; j < self.image_files.length; j++) {
      // debug('Creating cached route for image %s', self.image_files[j]);
      self.routes['/img/' + self.image_files[j]] = self.createStaticRoute(self.image_files[j]);
    }

    // Add routes for icon files in cache
    for (var k = 0; k < self.icon_files.length; k++) {
      // debug('Creating cached route for icon %s', self.icon_files[k]);
      self.routes['/img/icons/' + self.icon_files[k]] = self.createStaticRoute(self.icon_files[k]);
    }

    // Add routes for uncached avatar files
    for (var l = 0; l < self.avatar_files.length; l++) {
      // debug('Creating uncached route for ' + self.avatar_files[l]);
      self.routes['/img/avatars/' + self.avatar_files[l]] = self.createUncachedRoute('./static/img/avatars/' + self.avatar_files[l]);
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
        // if (self.local) {
        debug('redirecting to https://%s', req.headers.host);
        res.setHeader('Location', 'https://' + req.headers.host);
        // } else {
        //   debug('redirecting to http://%s', req.headers.host);
        //   res.setHeader('Location', 'http://' + req.headers.host);
        // }
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
          debug('uncached file: ', uncached_file, mime_type);
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
      debug('static file: ', static_file, mime_type);
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


  /* self.removeFileExtension = function (file_name) {
    var slice = file_name.lastIndexOf('.');
    if (slice > 0) {
      return file_name.substring(0, slice);
    }
    return file_name;
  }; */

  self.createChat = function (chat_name, pw) {
    // debug('pw:', pw);
    var chat = makeChat({
      server: true,
      chat_name: chat_name,
      chat_pass: pw
    });
    // debug(chat);
    chat.initMessage('Chat created', self.io);
    return chat;
  };

  self.listenForConnections = function () {
    self.io.sockets.on('connection', function (socket) {
      var chatName = socket.handshake.headers.referer.slice(socket.handshake.headers.referer.lastIndexOf('/') + 1);
      debug('NEW CONNECTION [ID:%s] - ref: %O', socket.id, socket.handshake.headers.referer);
      self.cnxCount();

      socket.on('check if locked', function (data) {
        debug('checking if locked: %s', data.chat_url);
        if (data.chat_url && self.chats[data.chat_url]) {
          socket.chat_url = data.chat_url;
          if (self.chats[data.chat_url].locked) {
            debug('data.chat_url: %s', data.chat_url);
            // send data to the locked chat members
            var chat = self.chats[data.chat_url];
            if (chat) {
              var message = new chat.Message({
                sender: { name: '', color: '', avatar: 'shield' },
                text: (data.name || 'someone') + ' attempted to join while locked',
                type: 'danger'
              });
              self.io.sockets.to(chatName).emit('alert message', message);
            }
            self.io.sockets.to(chatName).emit('locked try', data);
            socket.emit('new message', {
              text: 'Sorry, this chat is locked'
            });
          } else {
            socket.emit('chat unlocked');
          }
        } else {
          debug('bad request');
          socket.emit('bad request');
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
              var message = new chat.Message({
                sender: { name: '', color: '', avatar: 'shield' },
                text: (data.name || 'someone') + ' attempted to join while locked',
                type: 'danger'
              });
              self.io.sockets.to(chatName).emit('alert message', message);
              self.io.sockets.to(chatName).emit('locked try', data);
            } else if (chat.chatters.get(data.name)) {
              socket.emit('callback', 'join chat', {
                accepted: false,
                error: 'Sorry, the user name ' + data.name + ' is already in use'
              });
            } else if (chat.chat_pass && !data.chat_pass) {
              debug('pass requested w/o password!');
              var msg = new chat.Message({
                sender: { name: '', color: '', avatar: 'shield' },
                text: data.name + ' attempted to join without password',
                type: 'danger'
              });
              self.io.sockets.to(chatName).emit('alert message', msg);
              self.io.sockets.to(chatName).emit('missing pw try', data);
              socket.emit('callback', 'join chat', {
                accepted: false,
                error: 'This chat require a password to connect to it'
              });
            } else {
              // debug('chat: %O', chat);
              if (chat.chat_pass) {
                debug('password requested');
                // debug('pass request data: %O', data);
                var hash = sodium.to_string(sodium.from_base64(chat.chat_pass));
                debug('hash:', hash);
                var pw = sodium.to_string(sodium.from_base64(data.chat_pass));
                // debug('pw:', pw);
                // debug('hash === pw:', hash === pw);
                // debug('compare:', sodium.from_string(hash), sodium.from_string(pw), sodium.compare(sodium.from_string(hash), sodium.from_string(pw)));
                if (sodium.crypto_pwhash_str_verify(hash, pw)) {
                  debug('Password OK!');
                } else if (sodium.from_string(hash).length === sodium.from_string(pw).length && sodium.compare(sodium.from_string(hash), sodium.from_string(pw)) === 0) {
                  debug('Password OK!');
                } else {
                  var alertmsg = new chat.Message({
                    sender: { name: '', color: '', avatar: 'shield' },
                    text: data.name + ' attempted to join with a wrong password',
                    type: 'danger'
                  });
                  self.io.sockets.to(chatName).emit('alert message', alertmsg);
                  self.io.sockets.to(chatName).emit('wrong pw try', data);
                  debug('Wrong password!');
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
        self.cnxCount();
      });
    });
  };

  self.setupEvents = function (socket, chat) {
    self.cnxCount(/* chat.chat_name */);

    socket.on('new message', function (data) {
      new chat.Message(data);
      debug('redirecting new message data: %O', data);
      self.io.sockets.to(chat.chat_name).emit('new message', data);
    });

    socket.on('sys message', function (data) {
      new chat.Message(data);
      debug('redirecting sys message data: %O', data);
      self.io.sockets.to(chat.chat_name).emit('sys message', data);
    });

    socket.on('encrypted message', function (data) {
      new chat.Message(data);
      debug('redirecting encrypted message data: %O', data);
      self.io.sockets.to(chat.chat_name).emit('encrypted message', data);
    });

    socket.on('disconnect',  function (reason) {
      debug('disconnect because %s', reason);
      if (socket.chatter) {
        var name = socket.chatter.name;
        var message = new chat.Message({
          sender: { name: '', color: '', avatar: '' },
          text: name + ' has left the chat',
          type: 'system'
        });
        self.io.sockets.to(chat.chat_name).emit('sys message', message);
        chat.chatters.destroy(socket.chatter.name);
        socket.leave(chat.chat_name);
        self.io.sockets.to(chat.chat_name).emit('chatter disconnected', {
          name: name
        });
        // send nb cnx
        self.cnxCount(/* chat.chat_name */);

        // reset chat if everyone has left
        if (chat.chatters.length === 0) {
          // clearInterval(toCountChatters);
          if (socket.chat_url) {
            self.chats[socket.chat_url] = undefined;
          }
        }
      }
    });
    // socket.on('disconnect', disconnect);
    // socket.on('leave chat', disconnect);

    socket.on('username changed', function (data) {
      // var data = JSON.parse($scope.sDecrypt(dataEnc));
      chat.systemMessage(data.old_name + ' changed name for ' + data.new_name, self.io);
    });

    socket.on('clear messages', function () {
      debug('clear messages');
      chat.messages = [];
      self.io.sockets.to(chat.chat_name).emit('clear messages');
    });

    socket.on('lock chat', function () {
      debug('%s locked the chat %s', socket.chatter.name, chat.chat_name);
      chat.locked = true;
      new chat.Message({
        sender: { name: '', color: '', avatar: '' },
        text: socket.chatter.name + ' has locked the chat',
        type: 'system'
      });
      self.io.sockets.to(chat.chat_name).emit('chat locked', socket.chatter.name + ' has locked the chat');
      // chat.systemMessage(socket.chatter.name + ' has locked the chat', self.io);
    });

    socket.on('unlock chat', function () {
      debug('%s unlocked the chat %s', socket.chatter.name, chat.chat_name);
      chat.locked = false;
      new chat.Message({
        sender: { name: '', color: '', avatar: '' },
        text: socket.chatter.name + ' has unlocked the chat',
        type: 'system'
      });
      self.io.sockets.to(chat.chat_name).emit('chat unlocked', socket.chatter.name + ' has unlocked the chat');
      // chat.systemMessage(socket.chatter.name + ' has unlocked the chat', self.io);
    });

    socket.on('latency', function (startTime, cb) {
      // debug(cb.toString());
      cb(startTime);
    });

    socket.on('ping', function (data) {
      debug('ping: ', data);
    });

    socket.on('pong', function (data) {
      debug('pong: ', data);
    });
  };

  self.cnxCount = function(/* chatName */) {
    // debug(self.chats);
    // Count connexions in each chat room
    if (Object.entries(self.chats)) {
      //for (var chat of self.chats) {
      Object.entries(self.chats).forEach(function (chat) {
        self.io.of('/').in(chat[0]).clients(function (error, clients) {
          debug('connections in %s: %d', chat[0], clients.length);
          self.io.sockets.to(chat[0]).emit('count cnx', clients.length);
        });
      });
    }
    //Count total connexions
    self.io.of('/').clients(function (error, clients) {
      debug('total connections: %d', clients.length);
      /* if (chatName) {
        self.io.sockets.to('/').in(chatName).emit('count totcnx', clients.length);
      } else { */
      self.io.sockets.emit('count totcnx', clients.length);
      /* } */
    });
  };

  self.cnxCount = function(chatName) {
    // Count connexions in each chat room
    for (var chat in self.chats) {
      self.io.of('/').in(chat).clients(function (error, clients) {
        debug('connections in %s: %d', chat, clients.length);
        self.io.sockets.to(chat).emit('count cnx', clients.length);
      });
    }
    //Count total connexions
    self.io.of('/').clients(function (error, clients) {
      debug('total connections: %d', clients.length);
      self.io.sockets.to('/').in(chatName).emit('count totcnx', clients.length);
    });
  };

  self.cleanChats = function () {
    if (Object.entries(self.chats)) {
      var nbchats = self.chats.length, nbchatsc = 0;
      // debug('cleaning chats...');
      //for (var chat of self.chats) {
      Object.entries(self.chats).forEach(function (ochat) {
        // nbchats++;
        // debug('chat: %s (%s)', chat, typeof chat);
        // debug('self.chats[chat]: %s (%s)', self.chats[chat], typeof  self.chats[chat]);
        var chat = ochat[0];
        if (self.chats[chat] === undefined) {
          // nbchatsc++;
          debug('.%s.autoclean remove a deleted chat on %s existing', nbchatsc, nbchats);
          delete self.chats[chat];

          // debug('chat %s have %s chatters)', chat, self.chats[chat].chatters.length);
          // remove a chat if it exists for more than 5 min and has no chatter
        } else if (self.chats[chat] && self.chats[chat].chatters && self.chats[chat].chatters.length === 0 && (new Date() - self.chats[chat].birth) > 1000 * 60 * 5) {
          nbchatsc++;
          debug('.%s.autoclean remove a %sm old chat on %s existing', nbchatsc, (new Date() - self.chats[chat].birth) / (1000 * 60), nbchats);
          // chat = undefined;
          delete self.chats[chat];
        } else {
          // send nb cnx
          self.cnxCount(/* chat */);
        }
      });
      // debug('%s/%s chat(s) cleaned.', nbchatsc, nbchats);
    }
  };

  /**
   *  Initialize the server (express) and create the routes and register
   *  the handlers.
   */
  self.initializeServer = function () {
    self.createRoutes();
    self.app = express();

    // ckeck if local dev for a https server
    if (self.local) {
      var svrOptions = {
        key: fs.readFileSync('../keys/serverkey.pem'),
        cert: fs.readFileSync('../keys/servercert.pem'),
        ca: fs.readFileSync('../keys/cacert.pem')
      };
      self.server = require('https').createServer(svrOptions, self.app);
      self.app.use(function (req, res, next) {
        // debug('req.headers %O',req.headers);
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
    } else {
      self.server = require('http').createServer(self.app);
    }
    // self.serverhttp = require('http').createServer(self.app);

    // eslint-disable-next-line no-unused-vars
    /*self.app.use(function (req, res, next) {
      debug('req.headers %O',req.headers);
      if (req.secure) {
        next();
      } else {
        // debug(req.headers.host);
        var slice_point = req.headers.host.lastIndexOf(':');
        var host = req.headers.host.slice(0, slice_point);
        debug('requested: http://%s -> redirected to: https://%s:%s', req.headers.host, host, self.port);
        res.redirect('https://' + host + ':' + self.port);
      }
    });*/
    // debug('server io:', self.server);
    self.io = require('socket.io').listen(self.server);
    //self.io = require('socket.io').listen(window.location.protocol + '//' + window.location.hostname + ':' + self.port);

    self.chats = {};
    // self.chats.DaveChat = self.createChat('DaveChat');
    self.listenForConnections();

    //  Add handlers for the app (from the routes).
    for (var r in self.routes) {
      self.app.get(r, self.routes[r]);
    }
  };

  /***************************************************************
   *  Initializes the application.
   */
  self.initialize = function () {
    self.port = serverConfigurations.serverPort;
    if (self.local) {
      self.port = 8043;
    }
    // self.setupVariables();
    self.static_files = self.dirFiles('./static/');
    self.lib_files = self.dirFiles('./static/lib/');
    self.image_files = self.dirFiles('./static/img/');
    self.icon_files = self.dirFiles('./static/img/icons/');
    self.avatar_files = self.dirFiles('./static/img/avatars/');
    self.populateCache();
    //self.setupTerminationHandlers();
    // refresh cache every second
    setInterval(self.refreshCache, 1000);
    // clean unused chatnames 10 min
    setInterval(self.cleanChats, 1000 * 60/* * 10*/); // 1mn for tests
    // trace connexions number every min
    setInterval(self.cnxCount, 1000 * 60);

    // Create the express server and routes.
    self.initializeServer();
  };

  /**
   *  Start the server (starts up the sample application).
   */
  self.start = function () {
    self.server.listen(self.port, () => {
      // var serverStatus = `--SERVER LISTENING ON PORT:${self.port}--`;
      debug(`--SERVER LISTENING ON PORT:${self.port}--`);
    });

    // Start the app on the specific interface (and port).
    /* self.server.listen(self.port, self.ipaddress, function () {
      debug('%s: Node server https started on %s:%d ...',
        Date(Date.now()), self.ipaddress, self.port);

    });
    self.serverhttp.listen(self.httpport, self.ipaddress, function () {
      debug('%s: Node server http started on %s:%d ...',
        Date(Date.now()), self.ipaddress, self.httpport);
    }); */
  };
};

var zapp = new ChatApp();
zapp.initialize();
zapp.start();
