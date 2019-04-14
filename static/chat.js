/*eslint linebreak-style: ["error", "windows"]*/
/*global window, location, self, document, io, sodium, $*/

function Chat($scope) {
  if (!$scope.server) {
    window.ng_scope = $scope;
    $scope.chat_url = $scope.chat_url || location.pathname.substring(1);
    $scope.key = location.hash.substring(1);
    $scope.page_url = location.href;
    $scope.storage = window.sessionStorage;
  }
  $scope.chat_name = $scope.chat_name || $scope.chat_url.split('_').join(' ') || 'Chat';
  console.log('NewChat name:', $scope.chat_name);
  console.log('NewChat key:', $scope.key || 'no key here!');
  console.log('NewChat pass:', $scope.chat_pass || 'no pass here!');
  // console.log($scope.chat_name, $scope.chat_pass);
  // $scope.chat_pass = $scope.chat_pass || false;
  $scope.my_username = undefined;
  $scope.my_color = undefined;
  $scope.my_avatar = undefined;
  $scope.locked = false;
  $scope.viewSysMsg = true;
  $scope.chatters = [];
  $scope.birth = new Date();

  $scope.chatters.get = function (name) {
    for (var i = 0; i < this.length; i++) {
      if (this[i].name === name) {
        return this[i];
      }
    }
    return undefined;
  };

  $scope.Chatter = function (data) {
    var self = this;
    self.name = data.name;
    self.id = data.id;
    if (!self.id) {
      var max_id = -1;
      for (var i = 0; i < $scope.chatters.length; i++) {
        if ($scope.chatters[i].id > max_id) {
          max_id = $scope.chatters[i].id;
        }
      }
      self.id = max_id + 1;
    }
    self.color = data.color;
    self.avatar = data.avatar;
    $scope.chatters.push(self);
    return self;
  };

  $scope.Chatter.prototype.isMe = function () {
    if (this.name === $scope.my_username) {
      return 'is_me';
    }
    return '';
  };

  $scope.Chatter.prototype.updateName = function (new_name) {
    // console.log(this.name + ' is now named ' + new_name);
    var user = {
      old_name: this.name,
      new_name: new_name
    };
    socket.emit('username changed', $scope.sEncrypt(JSON.stringify(user), $scope.key));
    if (this.name == $scope.my_username) {
      $scope.my_username = $scope.new_username;
    }
    this.name = $scope.new_username;
  };

  $scope.chatters.destroy = function (name) {
    for (var i = 0; i < this.length; i++) {
      if (this[i].name === name) {
        this.splice(i, 1);
      }
    }
    return undefined;
  };

  $scope.messages = [];

  $scope.Message = function (rdata) {
    var self = this;
    var data = {};

    console.log('new $scope.Message(): ', rdata);
    console.log('server: ', $scope.server ? 'yes' : 'no');
    if (rdata) {
      if (rdata.text === undefined) {
        if ($scope.server) {
          data.encmsg = rdata;
          data.text = 'ENCRYPTED';
          data.sender = { name: 'ENCRYPTED', avatar: 'ENCRYPTED', color: 'ENCRYPTED' };
          data.type = 'ENCRYPTED';
          data.fullenc = true;
        } else {
          data = JSON.parse($scope.sDecrypt(rdata, $scope.key));
        }
      } else {
        data = rdata;
      }
    }
    self.text = data.text;
    self.encrypted = data.encrypted || false;
    self.fullenc = data.fullenc || false;
    // undefined sender indicates system message
    self.sender = data.sender;
    console.log('Message.sender: ', data.sender);
    /* self.avatarCol = data.sender.split('-')[0];
    self.avatarImg = data.sender.split('-')[1]; */
    self.type = data.type;
    self.nb = 1;
    self.time = (data.time ? new Date(data.time) : new Date());
    self.encmsg = data.encmsg || null;
    $scope.messages.push(self);
    console.log($scope.messages);
    if (!$scope.server) {
      $scope.scrollDown();
    }
    return self;
  };

  $scope.Message.prototype.timeString = function () {
    var secs = this.time.getSeconds();
    var mins = this.time.getMinutes();
    var hours = this.time.getHours();
    if (secs === 0) {
      secs = '00';
    } else if (secs < 10) {
      secs = '0' + secs;
    }
    if (mins === 0) {
      mins = '00';
    } else if (mins < 10) {
      mins = '0' + mins;
    }
    if (hours === 0) {
      hours = '00';
    } else if (hours < 10) {
      hours = '0' + hours;
    }
    return hours + ':' + mins + ':' + secs;
  };

  // $scope.newMessage = function (text, encrypted, type, sender, time) {
  //   new $scope.Message({
  //     text: text,
  //     encrypted: encrypted,
  //     type: type,
  //     sender: sender,
  //     time: time
  //   });
  // };

  $scope.systemMessage = function (text, io) {
    console.log(text);
    var msg = {
      sender: { name: '', color: '', avatar: '' },
      text: text,
      type: 'system'
    };
    console.log('$scope.systemMessage:', msg);
    //var encmsg = $scope.sEncrypt(JSON.stringify(msg), $scope.key);
    if ($scope.server) {
      console.log('emitting sys message from server: ' + text);
      new $scope.Message(msg);
      io.sockets.to($scope.chat_name).emit('sys message', msg);
    } else {
      console.log('emitting sys message from client: ' + text);
      socket.emit('sys message', msg);
    }
  };

  $scope.initMessage = function (text, io) {
    var msg = {
      sender: { name: '', color: '', avatar: '' },
      text: text,
      type: 'system'
    };
    if ($scope.server) {
      console.log('emitting init message from server: ' + text);
      new $scope.Message(msg);
      io.sockets.to($scope.chat_name).emit('init message', msg);
    } else {
      console.log('emitting init message from client: ' + text);
      socket.emit('init message', msg);
    }
  };

  $scope.clearMessages = function () {
    $scope.confirm('Clear all messages?',
      'Are you sure you want to delete all messages from the chat history?',
      function (accepted) {
        if (accepted) {
          $scope.messages = [];
          if ($scope.server) {
            self.io.sockets.to($scope.chat_name).emit('clear messages');
          } else {
            socket.emit('clear messages');
          }
          $scope.systemMessage('All messages cleared');
        }
      });
  };

  // Client-side only logic
  $scope.clientConnection = function () {
    document.title = $scope.chat_name + ' | ' + document.title;
    // console.log('self.port', self.port);
    // console.log('https://' + window.location.hostname + ':' + (self.port || 8043));
    // socket = io.connect('https://' + window.location.hostname + ':' + (self.port || 8043), {

    if (window.location.hostname === 'localhost') {
      socket = io.connect('https://' + window.location.hostname + ':' + (self.port || 8043), {
        secure: true
      });
    } else {
      socket = io.connect('http://' + window.location.hostname/* + ':' + (self.port || 8080)*/, {
        secure: true
      });
    }

    //console.log('self.port:', self.port);

    socket.callback = {};

    socket.emitWithCallback = function (name, data, callback) {
      socket.emit(name, data);
      socket.callback[name] = callback;
    };

    socket.on('callback', function (func, response) {
      console.log('callback:', func, '(' + typeof socket.callback[func] + ')');
      socket.callback[func](response);
    });

    socket.on('connect', function () {
      console.log('checking if chat is locked');
      socket.emit('check if locked', {
        chat_url: $scope.chat_url
      });
    });

    socket.on('initialize history', function (data) {
      var i, last;
      $scope.chat_name = data.chat_name;
      // Clear messages array
      $scope.messages = [];
      // Clear chatters array
      while ($scope.chatters.length > 0) {
        $scope.chatters.pop();
      }
      for (i = 0; i < data.messages.length; i++) {
        if (data.messages[i].text === 'ENCRYPTED') {
          data.messages[i] = JSON.parse($scope.sDecrypt(data.messages[i].encmsg, $scope.key));
        }
        if (data.messages[i].encrypted) {
          data.messages[i].text = $scope.sDecrypt(data.messages[i].text, $scope.key);
        }
        // console.log('data.messages: ', data.messages);
        // console.log('data.messages[' + i + ']');
        // console.log('=> data.messages[' + i + ']: ', data.messages[i]);
        // console.log(data.messages[i].sender.name + ': ' + data.messages[i].text);
        if (last && last.sender && last.sender.name === data.messages[i].sender.name && last.text === data.messages[i].text) {
          $scope.messages[$scope.messages.length - 1].nb++;
        } else {
          new $scope.Message(data.messages[i]);
          last = { sender: data.messages[i].sender, text: data.messages[i].text };
        }
      }
      for (i = 0; i < data.chatters.length; i++) {
        new $scope.Chatter(data.chatters[i]);
      }
      console.log('initialize history');
      $scope.$apply();
      // Scroll to the bottom just for prettyness
      $scope.scrollDown();


      // init the chart
      $scope.initChart();
    });

    socket.on('init message', function (data) {
      if (!data.sender || data.sender.name !== $scope.my_username) {
        // data.text = $scope.decrypt(data.text);
        new $scope.Message(data);
      }
      $scope.updateATS(750);
      $scope.lastMsg = { sender: data.sender, text: data.text };
      $scope.$apply();
      // Scroll to the bottom jsut for prettyness
      $scope.scrollDown();
    });

    socket.on('new message', function (data) {
      if (!data.sender || data.sender.name !== $scope.my_username) {
        // data.text = $scope.decrypt(data.text);
        new $scope.Message(data);
      }
      $scope.updateATS(750);
      $scope.lastMsg = { sender: data.sender, text: data.text };
      $scope.$apply();
      // Scroll to the bottom jsut for prettyness
      $scope.scrollDown();
    });

    socket.on('sys message', function (data) {
      // console.log($scope.key);
      // if (!data.text) {
      //   console.log('sys msg received enc: ', data);
      //   data = JSON.parse($scope.sDecrypt(data, $scope.key));
      // }
      console.log('sys msg received: ', data);
      if (!data.sender || data.sender.name !== $scope.my_username) {
        // data.text = $scope.decrypt(data.text);
        new $scope.Message(data);
      }
      $scope.updateATS(750);
      $scope.lastMsg = { sender: data.sender, text: data.text };
      $scope.$apply();
      // Scroll to the bottom jsut for prettyness
      $scope.scrollDown();
    });

    socket.on('encrypted message', function (dataEnc) {
      // console.log('dataEnc: ', dataEnc);
      var data = JSON.parse($scope.sDecrypt(dataEnc, $scope.key));
      if (data.sender.name !== $scope.my_username) {
        data.text = $scope.sDecrypt(data.text, $scope.key);
        new $scope.Message(data);
      }
      $scope.updateATS(750);
      $scope.lastMsg = { sender: data.sender, text: data.text };
      $scope.$apply();
      // Scroll to the bottom jsut for prettyness
      $scope.scrollDown();
    });

    socket.on('alert message', function (data) {
      console.log('received alert message:', data.text);
      if ($scope.lastMsg && $scope.lastMsg.sender && $scope.lastMsg.sender.name === data.sender.name && $scope.lastMsg.text === data.text) {
        // update the last message instead of adding one more
        $scope.messages[$scope.messages.length - 1].nb++;
      } else {
        new $scope.Message({
          sender: { name: '', color: '', avatar: 'shield' },
          text: data.text,
          type: 'danger'
        });
        $scope.lastMsg = { sender: data.sender, text: data.text };
      }
      $scope.updateAATS(950);
      $scope.$apply();
      $scope.scrollDown();
    });

    $scope.sendMessage = function () {
      var message;
      // console.log('Enc & send?', typeof $scope.message_text, '\'' + $scope.message_text + '\'');
      if ($scope.message_text !== ('') && typeof $scope.message_text !== 'undefined') {
        // console.log('Yes! Encoding & sending:', typeof $scope.message_text, '->' + $scope.message_text + '<-');
        var original_text = $scope.message_text;
        // var enc_text = 'ENCRYPTED: ' + GibberishAES.enc(original_text, $scope.key);
        var enc_text = $scope.sEncrypt(original_text, $scope.key);
        message = new $scope.Message({
          text: enc_text,
          encrypted: true,
          type: 'user',
          sender: { name: $scope.my_username, avatar: $scope.my_avatar, color: $scope.my_color }
        });
        // console.log('cryptom ori: ', message);
        var cryptom = $scope.sEncrypt(JSON.stringify(message), $scope.key);
        // console.log('cryptom enc: ', cryptom);
        // cryptom = JSON.parse($scope.sDecrypt(cryptom, $scope.key));
        // console.log('cryptom dec: ', cryptom);
        $scope.message_text = '';
        console.log('Emiting encrypted message:', cryptom);
        socket.emit('encrypted message', cryptom);
        // console.log('Emited encrypted message:', typeof message, message);
        message.text = original_text;
        message.encrypted = false;
        // console.log('Message:', typeof message, message);
      } else {
        console.log('Skip emmiting (blank message):', typeof $scope.message_text, '\'' + $scope.message_text + '\'');
        /*message = new $scope.Message({
          text: $scope.message_text,
          type: 'init',
          sender: $scope.my_username
        });
        console.log('Emiting new message:', typeof message, message);
        socket.emit('new message', message);*/
      }

      // key = sodium.to_hex(sodium.crypto_generichash(16, sodium.from_string($scope.chat_name))); // works !

      /* var key = sodium.to_hex(sodium.randombytes_buf(16)); // works to !
      console.log('key:', key.length, key);
      var testSodium = $scope.sEncrypt('*A*B*C*0*1*2*', key);
      console.log('sodium enc:', testSodium);
      testSodium = $scope.sDecrypt(testSodium, key);
      console.log('sodium dec:', testSodium); */
    };

    // Send message on enter key press
    $('#message_textarea').keypress(function (event) {
      if (event.which === 13) {
        event.preventDefault();
        $scope.sendMessage();
        $scope.$apply();
      }
    });

    socket.on('clear messages', function () {
      $scope.messages = [];
      $scope.updateATS(500);
      $scope.$apply();
    });

    $scope.setUsername = function () {
      if ($scope.new_username !== '') {
        var pw = '', uname;
        // Update name of already existing chatter
        console.log('$scope.new_username: ', $scope.new_username);
        console.log('$scope.my_username: ', $scope.my_username);
        if ($scope.my_username) {
          $scope.chatters.get($scope.my_username).updateName($scope.new_username);
          $('#username_modal').modal('hide');
          $scope.username_error = undefined;
        } else { // New chatter connection
          // Take pw from the chat_pass input field
          // var hash;
          pw = $('input#chat_pass').val().trim().substr(0, 32) || '';
          if (pw && pw !== '') {
            // console.log('pw:',typeof pw, pw.length, pw);
            // hash = sodium.from_string(sodium.crypto_pwhash_str(
            //   pw,
            //   sodium.crypto_pwhash_OPSLIMIT_MIN,
            //   sodium.crypto_pwhash_MEMLIMIT_MIN
            // ));
            // hash = sodium.from_string(pw);
            pw = sodium.to_base64(pw);
          }
          // Take pw from sessionStorage if exists
          if ($scope.storage.getItem('chatpass') !== null) {
            pw = $scope.storage.getItem('chatpass');
          }
          // console.log('setUsername chat_pass:', typeof pw, pw.length, pw);
          uname = $scope.sanithize($('#username_modal .userinput').val());
          if (!$scope.new_username) {
            $scope.new_username = uname;
          }
          $scope.joinChat($scope.new_username, pw);
        }
      }
    };

    // Set username on enter key
    $('#username_modal .userinput').keypress(function (event) {
      if (event.which === 13) {
        event.preventDefault();
        $scope.setUsername();
        $scope.$apply();
      }
    });

    $scope.joinChat = function (name, pw) {
      $scope.join_loading = true;
      var chat_url = location.pathname.substring(1);
      var color = $scope.storage.getItem('chatucol');
      var avatar = $scope.storage.getItem('chatuani') + $scope.contrast(color);
      console.log('emitting join request');
      socket.emitWithCallback('join chat', {
        name: name,
        chat_url: chat_url,
        chat_pass: pw,
        color: color,
        avatar: avatar
      }, function (response) {
        console.log('received join response');
        if (response.accepted) {
          // console.log('$scope:', $scope);
          //window.alert('scope!');
          $scope.my_username = $scope.new_username;
          $scope.my_color = color;
          $scope.my_avatar = avatar;
          $('#username_modal').modal('hide');
          $scope.username_error = undefined;
          $scope.systemMessage(name + ' has joined the chat');
        } else if (response.error.indexOf('require a password') !== -1) {
          // console.log('$scope:', $scope);
          if (pw) {
            if (sodium.crypto_pwhash_str_verify($scope.chat_pass, pw)) {
              console.log('Password OK!');
            } else {
              console.log('Wrong password!');
            }
          }
          $scope.username_error = response.error;

        } else {
          $scope.username_error = response.error;
        }
        $scope.join_loading = false;
        $scope.$apply();
      });
    };

    socket.on('new chatter', function (data) {
      new $scope.Chatter(data);
      $scope.updateATS(500);
      $scope.$apply();
    });

    socket.on('chatter disconnected', function (data) {
      $scope.chatters.destroy(data.name);
      $scope.updateATS(500);
      $scope.$apply();
    });

    $scope.leaveChat = function () {
      $scope.confirm('Leave chat?',
        'Are you sure you wish to leave the chat?',
        function (accepted) {
          if (accepted) {
            $scope.chatters.destroy($scope.my_username);
            //socket.emit('leave chat');
            //$scope.my_username = undefined;
            socket.disconnect();
            location.reload();
            //window.socket = $scope.clientConnection();
          }
        });
    };

    $scope.initChart = function () {
      $scope.serverMonitor = new SmoothieChart({ // eslint-disable-line no-undef
        grid: {
          strokeStyle: 'rgb(125, 0, 0)',
          fillStyle: 'rgb(0, 0, 0)',
          lineWidth: 1,
          millisPerLine: 60000,
          verticalSections: 4,
        },
        maxDataSetLength: 5,
        displayDataFromPercentile: 1,
        millisPerPixel: 300,
        minValue: -1000,
        maxValue: 1000,
        labels: { disabled: true }
      });
      $scope.serverMonitor.streamTo(document.getElementById('monitor'));
      // Data
      $scope.smootHB = new TimeSeries(); // eslint-disable-line no-undef
      // Initial value
      $scope.smootHB.append(new Date().getTime(), 0);
      $scope.ping();
      // setTimeout(function () {
      //   $scope.smootHB.append(new Date().getTime(), 0);
      // }, 9000);
      // Add latency value to monitor regulary
      setInterval(function () {
        $scope.ping();
      }, 10000);
      // Add to Smoothie Charts
      $scope.serverMonitor.addTimeSeries($scope.smootHB, {
        strokeStyle: 'rgb(0, 255, 0)',
        fillStyle: 'rgba(0, 255, 0, 0.3)',
        lineWidth: 2
      });
      $scope.serverActivity = new SmoothieChart({ // eslint-disable-line no-undef
        grid: {
          strokeStyle: 'rgb(125, 0, 0)',
          fillStyle: 'rgb(0, 0, 0)',
          lineWidth: 1,
          millisPerLine: 60000,
          verticalSections: 4,
        },
        maxDataSetLength: 15,
        displayDataFromPercentile: 1,
        millisPerPixel: 300,
        minValue: -100,
        maxValue: 1000,
        labels: { disabled: true }
      });
      $scope.serverActivity.streamTo(document.getElementById('activity'));
      $scope.smootAct = new TimeSeries(); // eslint-disable-line no-undef
      $scope.smootAct.append(new Date().getTime(), 0);
      $scope.serverActivity.addTimeSeries($scope.smootAct, {
        strokeStyle: 'rgb(0, 255, 255)',
        fillStyle: 'rgba(0, 255, 255, 0.3)',
        lineWidth: 2
      });
      $scope.smootAAct = new TimeSeries(); // eslint-disable-line no-undef
      $scope.updateAATS(-50);
      $scope.serverActivity.addTimeSeries($scope.smootAAct, {
        strokeStyle: 'rgb(255, 0, 0)',
        fillStyle: 'rgba(255, 0, 0, 0.5)',
        lineWidth: 2
      });
    };

    // Named interval (clearable)
    $scope.ivUATS, $scope.ivUAATS;

    // Update Activity serie
    $scope.updateATS = function (val) {
      clearInterval($scope.ivUATS);
      if ($scope.smootAct) {
        $scope.smootAct.append(new Date().getTime(), val);
        $scope.ivUATS = setInterval(function () {
          $scope.smootAct.append(new Date().getTime(), 0);
        }, 600);
      }
    };

    // Update Alert Activity serie
    $scope.updateAATS = function (val) {
      clearInterval($scope.ivUAATS);
      if ($scope.smootAAct) {
        $scope.smootAAct.append(new Date().getTime(), val);
        $scope.ivUAATS = setInterval(function () {
          $scope.smootAAct.append(new Date().getTime(), -50);
        }, 600);
      }
    };

    $scope.ping = function () {
      //console.log('Sending ping...');
      //socket.emit('ping');
      var res = 0;
      socket.emit('latency', Date.now(), function(startTime) {
        var latency = Date.now() - startTime;
        console.log('latency: ', latency);
        // Update HB serie
        res = 1000 - latency;
        $scope.smootHB.append(new Date().getTime(), res);
      });
      setTimeout(function () {
        $scope.smootHB.append(new Date().getTime(), -res/2);
        setTimeout(function () {
          $scope.smootHB.append(new Date().getTime(), 0);
          setTimeout(function () {
            $scope.smootHB.append(new Date().getTime(), 0);
          }, 7000);
        }, 1000);
      }, 1000);
    };

    socket.on('ping', function() {
      console.log('Received Ping');
      if($scope.smootAct) $scope.smootAct.append(new Date().getTime(), -40);
    });

    socket.on('pong', function(data) {
      // var res = 1000 - data;
      // $scope.smootHB.append(new Date().getTime(), res);
      console.log('Received Pong: ', data);
      $scope.updateATS(1000 - data);
      // setTimeout(function () {
      //   $scope.smootHB.append(new Date().getTime(), 0);
      // }, 300);
    });

    socket.on('bad request', function () {
      window.alert('Bad request!\n\nThis is probably caused by a server restart...\n\nBy hitting OK, you\'ll be redirected to the home page.');
      $scope.chatters.destroy($scope.my_username);
      socket.disconnect();
      location.reload();
    });

    // Confirm Modal
    // confirm modal default
    $scope.confirm_modal = {
      title: 'Are you sure?',
      message: 'Are you sure?',
      respond: function () {}
    };

    $scope.confirm = function (title, message, callback) {
      $scope.confirm_modal.title = title;
      $scope.confirm_modal.message = message;
      $scope.confirm_modal.respond = function (response) {
        $('#confirm_modal').modal('hide');
        callback(response);
      };
      $('#confirm_modal').modal('show');
    };

    // Give focus to the input on modal show
    $('#username_modal').on('shown.bs.modal', function () {
      // var ispp = false;
      $('#user_name').trigger('focus');
      if ($scope.storage.getItem('chatpass') !== null) {
        // ispp = true;
        $('#chat_pass').hide();
      }
      if($scope.storage.getItem('chatuname') !== null) {
        $('#user_name').val($scope.storage.getItem('chatuname'));
        // if (ispp) {
        $scope.setUsername();
        $scope.$apply();
        // }
      } else {
        var u_name = $scope.unGen();
        $('#user_name').val(u_name.ani);
        $scope.storage.setItem('chatuname', u_name.ani);
        $scope.storage.setItem('chatucol', u_name.col);
        $scope.storage.setItem('chatuani', u_name.ani);
      }
    });

    $scope.scrollDown = function () {
      setTimeout(function () {
        $('html, body').stop().animate({
          scrollTop: $(document).height()
        }, 'slow');
      }, 50);
    };

    $scope.toggleLocked = function () {
      if ($scope.locked) {
        $scope.confirm('Clear messages?',
          'Would you like to delete all messages from the chat history before unlocking?',
          function (accepted) {
            if (accepted) {
              socket.emit('clear messages');
              $scope.systemMessage('All messages cleared');
            } else {
              $scope.confirm('Don\'t clear messages?',
                'Are you sure you don\'t want to delete all messages from the chat history before unlocking?',
                function (accepted) {
                  if (!accepted) {
                    socket.emit('clear messages');
                    $scope.systemMessage('All messages cleared');
                  }
                });
            }
            socket.emit('unlock chat');
          });
      } else {
        socket.emit('lock chat');
      }
    };

    socket.on('chat locked', function (data) {
      $scope.locked = true;
      console.log('chat locked');
      if (data) {
        new $scope.Message({
          sender: { name: '', color: '', avatar: '' },
          text: data,
          type: 'system'
        });
      }
      $scope.updateATS(500);
      $scope.$apply();
    });

    socket.on('chat unlocked', function (data) {
      $scope.locked = false;
      console.log('chat unlocked');
      if (data) {
        new $scope.Message({
          sender: { name: '', color: '', avatar: '' },
          text: data,
          type: 'system'
        });
      }
      $scope.updateATS(500);
      $scope.$apply();
    });

    $scope.toggleSysMsg = function () {
      $scope.viewSysMsg = !$scope.viewSysMsg;
      $scope.scrollDown();
    };

    socket.on('count cnx', function (nbcnx) {
      $scope.nbCnx = nbcnx;
      console.log('count cnx:', nbcnx);
      $scope.updateATS(500);
      $scope.$apply();
    });

    socket.on('count totcnx', function (totcnx) {
      $scope.totCnx = totcnx;
      console.log('total cnx:', totcnx);
      $scope.updateATS(500);
      $scope.$apply();
    });

    socket.on('locked try', function (data) {
      console.log('locked try', data);
      $scope.updateAATS(900);
    });
    socket.on('missing pw try', function (data) {
      console.log('missing pw try', data);
      $scope.updateAATS(900);
    });
    socket.on('wrong pw try', function (data) {
      console.log('wrong pw try', data);
      $scope.updateAATS(900);
    });

    $scope.unGen = function () {
      var animals = [
        'Dog', 'Cat', 'Bird', 'Butterfly', 'Ant',
        'Rabbit', 'Ape', 'Panther', 'Mouse', 'Elephant',
        'Fish', 'Bear', 'Turtle', 'Spider', 'Bat',
        'Giraffe', 'Cow', 'Shark', 'Horse', 'Duck',
        'Deer', 'Fox', 'Frog', 'Pig', 'Snake'
      ];
      var colors = [
        // dark colors
        'Blue', 'Red', 'Green', 'Purple', 'Olive',
        'Maroon', 'Black', 'Magenta', 'Teal', 'Sienna',
        'Indigo', 'LightSlateBlue', 'BlueRibbon', 'Brown', 'Navy',
        // light colors
        'Lime', 'Chartreuse', 'Lavender', 'Gold', 'Orange',
        'Tan', 'Pink', 'Cyan', 'Aquamarine', 'Yellow'
      ];
      // for (var n = 0; n < colors.length; ++n) {
      //   console.log(colors[n] + ' -> ' + $scope.contrast(colors[n]));
      // }
      var i = Math.floor(Math.random() * 25);
      var col = colors[i];
      i = Math.floor(Math.random() * 25);
      var ani = animals[i];
      var res = {ani: ani, col: col};
      return res;
    };

    /**
     * Convert color NAME to HEX
     */
    // $scope.standardize_color = function (str) {
    //   var ctx = document.createElement('canvas').getContext('2d');
    //   ctx.fillStyle = str;
    //   return ctx.fillStyle;
    // };

    /**
     * Convert HEX color to RGB
     */
    $scope.hex2Rgb = function(hex) {
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };

    /**
     * Calculate the contrast of color NAME
     * return string '' for black or '-i' for white
     */
    $scope.contrast = function (str) {
      var ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = str;
      var rgb = $scope.hex2Rgb(ctx.fillStyle);
      // calculate contrast of color (standard grayscale algorithmic formula)
      var contrast = (Math.round(rgb.r * 299) + Math.round(rgb.g * 587) + Math.round(rgb.b * 114)) / 1000;
      return (contrast >= 128) ? '' : '-i';
    };

    // Sidebar sliding
    var slide_speed = 300;
    var sidebar = $('.left-column');
    $scope.showSidebar = function () {
      sidebar.animate({
        left: '0px'
      }, slide_speed, function () {
        sidebar.addClass('sidebar_out').css({
          left: ''
        });
      });
    };

    $scope.hideSidebar = function () {
      sidebar.animate({
        left: '-220px'
      }, slide_speed, function () {
        sidebar.removeClass('sidebar_out').css({
          left: ''
        });
      });
    };

    // Copy URL
    $scope.copyUrl = function() { // eslint-disable-line no-unused-vars
      $('#url-txt').select();
      if(!document.execCommand('copy')) {
        console.error('FAILED Coping URL:', $('#url-txt').val());
      }
      return false;
    };

    console.log('*/!\\* NEW CONNECTION: %O', socket);
    return socket;
  };

  $scope.sEncrypt = function (txt, key) {
    try {
      // console.log('sodium msg to enc:', txt);
      var nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
      // console.log('sodium enc nonce:', nonce);
      var csb = sodium.crypto_secretbox_easy(txt, nonce, key);
      // console.log('sodium csb:', csb);
      var arr = new Uint8Array(nonce.length + csb.length);
      arr.set(nonce);
      arr.set(csb, nonce.length);
      var res = sodium.to_hex(arr);
      // console.log('sodium enc msg:', res);
      return res;
    }
    catch(error) {
      console.error(error.message);
      // window.alert(error.message);
    }
  };

  $scope.sDecrypt = function (nct, key) {
    if (!nct) {
      console.log('sodium NO text to DEC:', '"' + nct + '"');
      return;
    }/*  else {
      // console.log('sodium text to DEC:', nct);
    } */
    if (nct.length < sodium.crypto_secretbox_NONCEBYTES + sodium.crypto_secretbox_MACBYTES) {
      console.error('sodium THROW Short message');
      console.log('sodium Short message:', nct);
      return;
    }
    nct = sodium.from_hex(nct);
    var nonce = nct.slice(0, sodium.crypto_secretbox_NONCEBYTES),
      ct = nct.slice(sodium.crypto_secretbox_NONCEBYTES);
    try {
      var res = new TextDecoder('utf-8').decode(sodium.crypto_secretbox_open_easy(ct, nonce, key));
      // console.log('returning text DEC:', res);
      return res;
    }
    catch(error) {
      console.error(error.message);
      // window.alert(error.message);
    }
  };

  $scope.sanithize = function (str) {
    return str.trim()
      .split(' ').join('_')
      .split('.').join('_')
      .split('?').join('_')
      .split('&').join('_')
      .split('/').join('_')
      .split('<').join('_')
      .split('>').join('_');
  };

  if (!$scope.server) {
    var socket = $scope.clientConnection();
    // console.log('$scope.clientConnection(): %O', $scope.clientConnection());
  }
  /* else {
    test();
  }

  function test() {
		new $scope.Chatter({name: 'Dave'});
		new $scope.Chatter({name: 'Rob'});
		new $scope.Chatter({name: 'Dan'});
		new $scope.Chatter({name: 'Matt'});

		var mins_ago = function (mins) {
			var time = new Date();
			time.setMinutes(time.getMinutes() - mins);
			return time;
		};

	    new $scope.newMessage('hello world', 'Dave', mins_ago(12));
	    new $scope.newMessage('foo!', 'Rob', mins_ago(10));
	    new $scope.newMessage('foo?', 'Dave', mins_ago(9));
	    new $scope.newMessage('bar', 'Rob', mins_ago(9));
	    new $scope.newMessage('humbug', 'Dave', mins_ago(8));
	    new $scope.newMessage('Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et ', 'Ved Uttamchandani', mins_ago(8));
	    new $scope.newMessage('Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.', 'Dave', mins_ago(6));
	    new $scope.newMessage('Matt has joined the chat', undefined, mins_ago(5));
	    new $scope.newMessage('Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.', 'Matt', mins_ago(4));
	    new $scope.newMessage('lol TDD 4life', 'Rob', mins_ago(3));
	    new $scope.newMessage('goodbye world', 'Dave', mins_ago(3));

  }*/
  return $scope;
}
// for Node require command
var module = module || {};
module.exports = Chat;
