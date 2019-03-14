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
  console.log('NewChat name:', $scope.chat_name);
  console.log('NewChat key:', $scope.key || 'no key here!');
  console.log('NewChat pass:', $scope.chat_pass || 'no pass here!');
  $scope.chat_name = $scope.chat_name || $scope.chat_url.split('_').join(' ') || 'Chat';
  // console.log($scope.chat_name, $scope.chat_pass);
  // $scope.chat_pass = $scope.chat_pass || false;
  $scope.my_username = undefined;
  $scope.locked = false;
  $scope.chatters = [];

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
    socket.emit('username changed', {
      old_name: this.name,
      new_name: new_name
    });
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

  $scope.Message = function (data) {
    var self = this;
    data = data || {};
    self.text = data.text;
    self.encrypted = data.encrypted || false;
    // undefined sender indicates system message
    self.sender = data.sender;
    self.type = data.type;
    self.time = (data.time ? new Date(data.time) : new Date());
    $scope.messages.push(self);
    if (!$scope.server) {
      $scope.scrollDown();
    }
    return self;
  };

  $scope.Message.prototype.timeString = function () {
    var mins = this.time.getMinutes();
    var hours = this.time.getHours();
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
    return hours + ':' + mins;
  };

  $scope.newMessage = function (text, encrypted, type, sender, time) {
    new $scope.Message({
      text: text,
      encrypted: encrypted,
      type: type,
      sender: sender,
      time: time
    });
  };

  $scope.systemMessage = function (text, io) {
    if ($scope.server) {
      console.log('emitting sys message from server: ' + text);
      new $scope.Message({
        text: text,
        type: 'system'
      });
      io.sockets.to($scope.chat_name).emit('new message', {
        text: text
      });
    } else {
      console.log('emitting sys message from client: ' + text);
      socket.emit('new message', {
        text: text,
        type: 'system'
      });
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
    socket = io.connect('https://' + window.location.hostname/* + ':' + (self.port || 8080)*/, {
      secure: true
    });
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
      var i;
      $scope.chat_name = data.chat_name;
      // Clear messages array
      $scope.messages = [];
      // Clear chatters array
      while ($scope.chatters.length > 0) {
        $scope.chatters.pop();
      }
      for (i = 0; i < data.messages.length; i++) {
        // data.messages[i].text = $scope.decrypt(data.messages[i].text);
        if (data.messages[i].encrypted) {
          data.messages[i].text = $scope.sDecrypt(data.messages[i].text, $scope.key);
        }
        new $scope.Message(data.messages[i]);
      }
      for (i = 0; i < data.chatters.length; i++) {
        new $scope.Chatter(data.chatters[i]);
      }
      console.log('initialize history');
      $scope.$apply();
      // Scroll to the bottom just for prettyness
      $scope.scrollDown();
    });

    socket.on('new message', function (data) {
      if (data.sender !== $scope.my_username || !data.sender) {
        // data.text = $scope.decrypt(data.text);
        new $scope.Message(data);
      }
      $scope.$apply();
      // Scroll to the bottom jsut for prettyness
    });

    socket.on('encrypted message', function (data) {
      if (data.sender !== $scope.my_username) {
        data.text = $scope.sDecrypt(data.text, $scope.key);
        new $scope.Message(data);
      }
      $scope.$apply();
      // Scroll to the bottom jsut for prettyness
      $scope.scrollDown();
    });

    socket.on('alert message', function (data) {
      console.log('received alert message:', data.text);
      new $scope.Message ({
        text: data.text,
        type: 'danger'
      });
      $scope.$apply();
    });

    $scope.sendMessage = function () {
      var message;
      console.log('Enc & send?', typeof $scope.message_text, '->' + $scope.message_text + '<-');
      if ($scope.message_text !== ('' || ' ' || null) && typeof $scope.message_text !== 'undefined') {
        // console.log('Yes! Encoding & sending:', typeof $scope.message_text, '->' + $scope.message_text + '<-');
        var original_text = $scope.message_text;
        // var enc_text = 'ENCRYPTED: ' + GibberishAES.enc(original_text, $scope.key);
        var enc_text = $scope.sEncrypt(original_text, $scope.key);
        message = new $scope.Message({
          text: enc_text,
          encrypted: true,
          type: 'user',
          sender: $scope.my_username
        });
        $scope.message_text = '';
        console.log('Emiting encrypted message:', typeof message, message);
        socket.emit('encrypted message', message);
        // console.log('Emited encrypted message:', typeof message, message);
        message.text = original_text;
        message.encrypted = false;
        // console.log('Message:', typeof message, message);
      } else {
        console.log('Skip encoding (no message):', typeof $scope.message_text, '->' + $scope.message_text + '<-');
        message = new $scope.Message({
          text: $scope.message_text,
          type: 'init',
          sender: $scope.my_username
        });
        console.log('Emiting new message:', typeof message, message);
        socket.emit('new message', message);
      }

      // key = sodium.to_hex(sodium.crypto_generichash(16, sodium.from_string($scope.chat_name))); // works !

      /* var key = sodium.to_hex(sodium.randombytes_buf(16)); // works to !
      console.log('key:', key.length, key);
      var testSodium = $scope.sEncrypt('*A*B*C*0*1*2*', key);
      console.log('sodium enc:', testSodium);
      testSodium = $scope.sDecrypt(testSodium, key);
      console.log('sodium dec:', testSodium); */
    };

    // Send message on enter key
    $('#message_textarea').keypress(function (event) {
      if (event.which === 13) {
        event.preventDefault();
        $scope.sendMessage();
        $scope.$apply();
      }
    });

    socket.on('clear messages', function () {
      $scope.messages = [];
      $scope.$apply();
    });

    $scope.setUsername = function () {
      if ($scope.new_username !== '') {
        var pw = '';
        // Update name of already existing chatter
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
      console.log('emitting join request');
      socket.emitWithCallback('join chat', {
        name: name,
        chat_url: chat_url,
        chat_pass: pw
      }, function (response) {
        console.log('received join response');
        if (response.accepted) {
          // console.log('$scope:', $scope);
          //window.alert('scope!');
          $scope.my_username = $scope.new_username;
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
      $scope.$apply();
    });
    socket.on('chatter disconnected', function (data) {
      $scope.chatters.destroy(data.name);
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
      $('#user_name').trigger('focus');
      if($scope.storage.getItem('chatpass') !== null) {
        $('#chat_pass').hide();
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

    socket.on('chat locked', function () {
      $scope.locked = true;
      console.log('chat locked');
      $scope.$apply();
    });
    socket.on('chat unlocked', function () {
      $scope.locked = false;
      console.log('chat unlocked');
      $scope.$apply();
    });

    socket.on('count cnx', function (nbcnx) {
      $scope.nbCnx = nbcnx;
      console.log('count cnx:', nbcnx);
      $scope.$apply();
    });
    socket.on('count totcnx', function (totcnx) {
      $scope.totCnx = totcnx;
      console.log('total cnx:', totcnx);
      $scope.$apply();
    });

    socket.on('locked try', function (data) {
      console.log('locked try', data);
    });
    socket.on('missing pw try', function (data) {
      console.log('missing pw try', data);
    });
    socket.on('wrong pw try', function (data) {
      console.log('wrong pw try', data);
    });

    /* $scope.decrypt = function (text) {
      if (text.indexOf('ENCRYPTED:') === 0) {
        text = GibberishAES.dec(text.substring(11), $scope.key);
      }
      return text;
    }; */

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
        window.alert(error.message);
      }
    };

    $scope.sDecrypt = function (nct, key) {
      if (nct) {
        // console.log('sodium text to DEC:', nct);
      } else {
        console.log('sodium NO text to DEC:', '"' + nct + '"');
        return ' ';
      }
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
        window.alert(error.message);
      }
    };

    // Copy URL
    $scope.copyUrl = function() { // eslint-disable-line no-unused-vars
      $('#urlTxt').select();
      // console.log('Copy URL:', $('#urlTxt').val());
      if(document.execCommand('copy')) {
        // console.log('Successfully copied URL:', $('#urlTxt').val());
      } else {
        console.error('FAILED Coping URL:', $('#urlTxt').val());
      }
      return false;
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
    return socket;
  };

  if (!$scope.server) {
    var socket = $scope.clientConnection();
    console.log('$scope.clientConnection(): %O', $scope.clientConnection());
  } else {
    test();
  }

  function test() {
    /*
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
	    */
  }
  return $scope;
}
// for Node require command
var module = module || {};
module.exports = Chat;
