(function () {
  function r(e, n, t) {
    function o(i, f) {
      if (!n[i]) {
        if (!e[i]) {
          var c = 'function' == typeof require && require;
          if (!f && c) return c(i, !0);
          if (u) return u(i, !0);
          var a = new Error('Cannot find module \'' + i + '\'');
          throw a.code = 'MODULE_NOT_FOUND', a;
        }
        var p = n[i] = {
          exports: {}
        };
        e[i][0].call(p.exports, function (r) {
          var n = e[i][1][r];
          return o(n || r);
        }, p, p.exports, r, e, n, t);
      }
      return n[i].exports;
    }
    for (var u = 'function' == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
    return o;
  }
  return r;
})()({
  // eslint-disable-next-line no-unused-vars
  1: [function (require, module, exports) {
    /*eslint linebreak-style: ["error", "windows"]*/
    /*global window, location, self, document, io, sodium, $*/
    function Chat($scope) {
      if (!$scope.server) {
        window.ng_scope = $scope;
        $scope.chat_url = $scope.chat_url || location.pathname.substring(1);
        $scope.key = location.hash.substring(1);
        $scope.page_url = location.href;
      }
      console.log($scope.key || 'no key here!');
      $scope.chat_name = $scope.chat_name || $scope.chat_url.split('_').join(' ') || 'Chat';
      console.log($scope.chat_name);
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
        console.log(new_name);
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

      $scope.newMessage = function (text, encrypted, sender, time) {
        new $scope.Message({
          text: text,
          encrypted: encrypted,
          sender: sender,
          time: time
        });
      };

      $scope.systemMessage = function (text, io) {
        if ($scope.server) {
          new $scope.Message({
            text: text
          });
          io.sockets.to($scope.chat_name).emit('new message', {
            text: text
          });
        } else {
          console.log('emitting message: ' + text);
          socket.emit('new message', {
            text: text
          });
        }
        console.log('emitting sys message: ' + text);
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
        console.log('self.port', self.port);
        console.log('https://' + window.location.hostname + ':' + (self.port || 8043));
        socket = io.connect('https://' + window.location.hostname + ':' + (self.port || 8043), {
          secure: true
        });

        socket.callback = {};

        socket.emitWithCallback = function (name, data, callback) {
          socket.emit(name, data);
          socket.callback[name] = callback;
        };

        socket.on('callback', function (func, response) {
          console.log('callback:', func, typeof socket.callback[func]);
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
        });

        $scope.sendMessage = function () {
          var message;
          console.log('Enc & send?', typeof $scope.message_text, '->' + $scope.message_text + '<-');
          if ($scope.message_text !== ('' || ' ') && typeof $scope.message_text !== 'undefined') {
            console.log('Yes! Encoding & sending:', typeof $scope.message_text, '->' + $scope.message_text + '<-');
            var original_text = $scope.message_text;
            // var enc_text = 'ENCRYPTED: ' + GibberishAES.enc(original_text, $scope.key);
            var enc_text = $scope.sEncrypt(original_text, $scope.key);
            message = new $scope.Message({
              text: enc_text,
              encrypted: true,
              sender: $scope.my_username
            });
            $scope.message_text = '';
            console.log('Emiting encrypted message:', typeof message, message);
            socket.emit('encrypted message', message);
            // console.log('Emited encrypted message:', typeof message, message);
            message.text = original_text;
            message.encrypted = false;
            console.log('Message:', typeof message, message);
          } else {
            console.log('No! Skip encoding: BUG HERE?', typeof $scope.message_text, '->' + $scope.message_text + '<-');
            message = new $scope.Message({
              text: $scope.message_text,
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
            if ($scope.my_username) {
              $scope.chatters.get($scope.my_username).updateName($scope.new_username);
              $('#username_modal').modal('hide');
              $scope.username_error = undefined;
            } else {
              $scope.joinChat($scope.new_username);
            }
          }
        };

        // Set username on enter key
        $('#username_modal .username').keypress(function (event) {
          if (event.which === 13) {
            event.preventDefault();
            $scope.setUsername();
            $scope.$apply();
          }
        });

        $scope.joinChat = function (name) {
          $scope.join_loading = true;
          var chat_url = location.pathname.substring(1);
          console.log('emitting join request');
          socket.emitWithCallback('join chat', {
            name: name,
            chat_url: chat_url
          }, function (response) {
            console.log('received join request');
            if (response.accepted) {
              $scope.my_username = $scope.new_username;
              $('#username_modal').modal('hide');
              $scope.username_error = undefined;
              $scope.systemMessage(name + ' has joined the chat');
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

        $('#username_modal').on('shown', function () {
          $('#username_modal .username').first().focus();
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

        /* $scope.decrypt = function (text) {
          if (text.indexOf('ENCRYPTED:') === 0) {
            text = GibberishAES.dec(text.substring(11), $scope.key);
          }
          return text;
        }; */

        $scope.sEncrypt = function (txt, key) {
          console.log('sodium msg to enc:', txt);
          var nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
          // console.log('sodium enc nonce:', nonce);
          var csb = sodium.crypto_secretbox_easy(txt, nonce, key);
          // console.log('sodium csb:', csb);
          var arr = new Uint8Array(nonce.length + csb.length);
          arr.set(nonce);
          arr.set(csb, nonce.length);
          var res = sodium.to_hex(arr);
          console.log('sodium enc msg:', res);
          return res;
        };

        $scope.sDecrypt = function (nct, key) {
          if (nct) {
            console.log('sodium text to DEC:', nct);
          } else {
            console.log('sodium NO text to DEC:', '"' + nct + '"');
            return ' ';
          }
          if (nct.length < sodium.crypto_secretbox_NONCEBYTES + sodium.crypto_secretbox_MACBYTES) {
            console.log('sodium THROW Short message');
            console.log('sodium Short message:', nct);
            // return nct;
          }
          nct = sodium.from_hex(nct);
          var nonce = nct.slice(0, sodium.crypto_secretbox_NONCEBYTES),
            ct = nct.slice(sodium.crypto_secretbox_NONCEBYTES);
          var res = new TextDecoder('utf-8').decode(sodium.crypto_secretbox_open_easy(ct, nonce, key));
          console.log('returning text DEC:', res);
          return res;
        };

        // Copy URL
        $scope.copyUrl = function () { // eslint-disable-line no-unused-vars
          $('#urlTxt').select();
          console.log('Copy URL:', $('#urlTxt').val());
          if (document.execCommand('copy')) {
            console.log('Successfully copied URL:', $('#urlTxt').val());
          } else {
            console.log('FAILED Coping URL:', $('#urlTxt').val());
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
    // eslint-disable-next-line no-redeclare
    var module = module || {};
    module.exports = Chat;

  }, {}]
}, {}, [1]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6L1VzZXJzL2Jpb2xpdmFsL0FwcERhdGEvUm9hbWluZy9ucG0vbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImNoYXQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiLyplc2xpbnQgbGluZWJyZWFrLXN0eWxlOiBbXCJlcnJvclwiLCBcIndpbmRvd3NcIl0qL1xyXG4vKmdsb2JhbCB3aW5kb3csIGxvY2F0aW9uLCBzZWxmLCBkb2N1bWVudCwgaW8sIHNvZGl1bSwgJCovXHJcbmZ1bmN0aW9uIENoYXQoJHNjb3BlKSB7XHJcbiAgaWYgKCEkc2NvcGUuc2VydmVyKSB7XHJcbiAgICB3aW5kb3cubmdfc2NvcGUgPSAkc2NvcGU7XHJcbiAgICAkc2NvcGUuY2hhdF91cmwgPSAkc2NvcGUuY2hhdF91cmwgfHwgbG9jYXRpb24ucGF0aG5hbWUuc3Vic3RyaW5nKDEpO1xyXG4gICAgJHNjb3BlLmtleSA9IGxvY2F0aW9uLmhhc2guc3Vic3RyaW5nKDEpO1xyXG4gICAgJHNjb3BlLnBhZ2VfdXJsID0gbG9jYXRpb24uaHJlZjtcclxuICB9XHJcbiAgY29uc29sZS5sb2coJHNjb3BlLmtleSB8fCAnbm8ga2V5IGhlcmUhJyk7XHJcbiAgJHNjb3BlLmNoYXRfbmFtZSA9ICRzY29wZS5jaGF0X25hbWUgfHwgJHNjb3BlLmNoYXRfdXJsLnNwbGl0KCdfJykuam9pbignICcpIHx8ICdDaGF0JztcclxuICBjb25zb2xlLmxvZygkc2NvcGUuY2hhdF9uYW1lKTtcclxuICAkc2NvcGUubXlfdXNlcm5hbWUgPSB1bmRlZmluZWQ7XHJcbiAgJHNjb3BlLmxvY2tlZCA9IGZhbHNlO1xyXG4gICRzY29wZS5jaGF0dGVycyA9IFtdO1xyXG5cclxuICAkc2NvcGUuY2hhdHRlcnMuZ2V0ID0gZnVuY3Rpb24gKG5hbWUpIHtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBpZiAodGhpc1tpXS5uYW1lID09PSBuYW1lKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXNbaV07XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfTtcclxuXHJcbiAgJHNjb3BlLkNoYXR0ZXIgPSBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gICAgc2VsZi5uYW1lID0gZGF0YS5uYW1lO1xyXG4gICAgc2VsZi5pZCA9IGRhdGEuaWQ7XHJcbiAgICBpZiAoIXNlbGYuaWQpIHtcclxuICAgICAgdmFyIG1heF9pZCA9IC0xO1xyXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8ICRzY29wZS5jaGF0dGVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGlmICgkc2NvcGUuY2hhdHRlcnNbaV0uaWQgPiBtYXhfaWQpIHtcclxuICAgICAgICAgIG1heF9pZCA9ICRzY29wZS5jaGF0dGVyc1tpXS5pZDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgc2VsZi5pZCA9IG1heF9pZCArIDE7XHJcbiAgICB9XHJcbiAgICAkc2NvcGUuY2hhdHRlcnMucHVzaChzZWxmKTtcclxuICAgIHJldHVybiBzZWxmO1xyXG4gIH07XHJcblxyXG4gICRzY29wZS5DaGF0dGVyLnByb3RvdHlwZS5pc01lID0gZnVuY3Rpb24gKCkge1xyXG4gICAgaWYgKHRoaXMubmFtZSA9PT0gJHNjb3BlLm15X3VzZXJuYW1lKSB7XHJcbiAgICAgIHJldHVybiAnaXNfbWUnO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuICcnO1xyXG4gIH07XHJcblxyXG4gICRzY29wZS5DaGF0dGVyLnByb3RvdHlwZS51cGRhdGVOYW1lID0gZnVuY3Rpb24gKG5ld19uYW1lKSB7XHJcbiAgICBjb25zb2xlLmxvZyhuZXdfbmFtZSk7XHJcbiAgICBzb2NrZXQuZW1pdCgndXNlcm5hbWUgY2hhbmdlZCcsIHtcclxuICAgICAgb2xkX25hbWU6IHRoaXMubmFtZSxcclxuICAgICAgbmV3X25hbWU6IG5ld19uYW1lXHJcbiAgICB9KTtcclxuICAgIGlmICh0aGlzLm5hbWUgPT0gJHNjb3BlLm15X3VzZXJuYW1lKSB7XHJcbiAgICAgICRzY29wZS5teV91c2VybmFtZSA9ICRzY29wZS5uZXdfdXNlcm5hbWU7XHJcbiAgICB9XHJcbiAgICB0aGlzLm5hbWUgPSAkc2NvcGUubmV3X3VzZXJuYW1lO1xyXG4gIH07XHJcblxyXG4gICRzY29wZS5jaGF0dGVycy5kZXN0cm95ID0gZnVuY3Rpb24gKG5hbWUpIHtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBpZiAodGhpc1tpXS5uYW1lID09PSBuYW1lKSB7XHJcbiAgICAgICAgdGhpcy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfTtcclxuXHJcbiAgJHNjb3BlLm1lc3NhZ2VzID0gW107XHJcblxyXG4gICRzY29wZS5NZXNzYWdlID0gZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgIGRhdGEgPSBkYXRhIHx8IHt9O1xyXG4gICAgc2VsZi50ZXh0ID0gZGF0YS50ZXh0O1xyXG4gICAgc2VsZi5lbmNyeXB0ZWQgPSBkYXRhLmVuY3J5cHRlZCB8fCBmYWxzZTtcclxuICAgIC8vIHVuZGVmaW5lZCBzZW5kZXIgaW5kaWNhdGVzIHN5c3RlbSBtZXNzYWdlXHJcbiAgICBzZWxmLnNlbmRlciA9IGRhdGEuc2VuZGVyO1xyXG4gICAgc2VsZi50aW1lID0gKGRhdGEudGltZSA/IG5ldyBEYXRlKGRhdGEudGltZSkgOiBuZXcgRGF0ZSgpKTtcclxuICAgICRzY29wZS5tZXNzYWdlcy5wdXNoKHNlbGYpO1xyXG4gICAgaWYgKCEkc2NvcGUuc2VydmVyKSB7XHJcbiAgICAgICRzY29wZS5zY3JvbGxEb3duKCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gc2VsZjtcclxuICB9O1xyXG5cclxuICAkc2NvcGUuTWVzc2FnZS5wcm90b3R5cGUudGltZVN0cmluZyA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBtaW5zID0gdGhpcy50aW1lLmdldE1pbnV0ZXMoKTtcclxuICAgIHZhciBob3VycyA9IHRoaXMudGltZS5nZXRIb3VycygpO1xyXG4gICAgaWYgKG1pbnMgPT09IDApIHtcclxuICAgICAgbWlucyA9ICcwMCc7XHJcbiAgICB9IGVsc2UgaWYgKG1pbnMgPCAxMCkge1xyXG4gICAgICBtaW5zID0gJzAnICsgbWlucztcclxuICAgIH1cclxuICAgIGlmIChob3VycyA9PT0gMCkge1xyXG4gICAgICBob3VycyA9ICcwMCc7XHJcbiAgICB9IGVsc2UgaWYgKGhvdXJzIDwgMTApIHtcclxuICAgICAgaG91cnMgPSAnMCcgKyBob3VycztcclxuICAgIH1cclxuICAgIHJldHVybiBob3VycyArICc6JyArIG1pbnM7XHJcbiAgfTtcclxuXHJcbiAgJHNjb3BlLm5ld01lc3NhZ2UgPSBmdW5jdGlvbiAodGV4dCwgZW5jcnlwdGVkLCBzZW5kZXIsIHRpbWUpIHtcclxuICAgIG5ldyAkc2NvcGUuTWVzc2FnZSh7XHJcbiAgICAgIHRleHQ6IHRleHQsXHJcbiAgICAgIGVuY3J5cHRlZDogZW5jcnlwdGVkLFxyXG4gICAgICBzZW5kZXI6IHNlbmRlcixcclxuICAgICAgdGltZTogdGltZVxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgJHNjb3BlLnN5c3RlbU1lc3NhZ2UgPSBmdW5jdGlvbiAodGV4dCwgaW8pIHtcclxuICAgIGlmICgkc2NvcGUuc2VydmVyKSB7XHJcbiAgICAgIG5ldyAkc2NvcGUuTWVzc2FnZSh7XHJcbiAgICAgICAgdGV4dDogdGV4dFxyXG4gICAgICB9KTtcclxuICAgICAgaW8uc29ja2V0cy50bygkc2NvcGUuY2hhdF9uYW1lKS5lbWl0KCduZXcgbWVzc2FnZScsIHtcclxuICAgICAgICB0ZXh0OiB0ZXh0XHJcbiAgICAgIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc29sZS5sb2coJ2VtaXR0aW5nIG1lc3NhZ2U6ICcgKyB0ZXh0KTtcclxuICAgICAgc29ja2V0LmVtaXQoJ25ldyBtZXNzYWdlJywge1xyXG4gICAgICAgIHRleHQ6IHRleHRcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBjb25zb2xlLmxvZygnZW1pdHRpbmcgc3lzIG1lc3NhZ2U6ICcgKyB0ZXh0KTtcclxuICB9O1xyXG5cclxuICAkc2NvcGUuY2xlYXJNZXNzYWdlcyA9IGZ1bmN0aW9uICgpIHtcclxuICAgICRzY29wZS5jb25maXJtKCdDbGVhciBhbGwgbWVzc2FnZXM/JyxcclxuICAgICAgJ0FyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBkZWxldGUgYWxsIG1lc3NhZ2VzIGZyb20gdGhlIGNoYXQgaGlzdG9yeT8nLFxyXG4gICAgICBmdW5jdGlvbiAoYWNjZXB0ZWQpIHtcclxuICAgICAgICBpZiAoYWNjZXB0ZWQpIHtcclxuICAgICAgICAgICRzY29wZS5tZXNzYWdlcyA9IFtdO1xyXG4gICAgICAgICAgaWYgKCRzY29wZS5zZXJ2ZXIpIHtcclxuICAgICAgICAgICAgc2VsZi5pby5zb2NrZXRzLnRvKCRzY29wZS5jaGF0X25hbWUpLmVtaXQoJ2NsZWFyIG1lc3NhZ2VzJyk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBzb2NrZXQuZW1pdCgnY2xlYXIgbWVzc2FnZXMnKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgICRzY29wZS5zeXN0ZW1NZXNzYWdlKCdBbGwgbWVzc2FnZXMgY2xlYXJlZCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgLy8gQ2xpZW50LXNpZGUgb25seSBsb2dpY1xyXG4gICRzY29wZS5jbGllbnRDb25uZWN0aW9uID0gZnVuY3Rpb24gKCkge1xyXG4gICAgZG9jdW1lbnQudGl0bGUgPSAkc2NvcGUuY2hhdF9uYW1lICsgJyB8ICcgKyBkb2N1bWVudC50aXRsZTtcclxuICAgIGNvbnNvbGUubG9nKCdzZWxmLnBvcnQnLCBzZWxmLnBvcnQpO1xyXG4gICAgY29uc29sZS5sb2coJ2h0dHBzOi8vJyArIHdpbmRvdy5sb2NhdGlvbi5ob3N0bmFtZSArICc6JyArIChzZWxmLnBvcnQgfHwgODA0MykpO1xyXG4gICAgc29ja2V0ID0gaW8uY29ubmVjdCgnaHR0cHM6Ly8nICsgd2luZG93LmxvY2F0aW9uLmhvc3RuYW1lICsgJzonICsgKHNlbGYucG9ydCB8fCA4MDQzKSwge1xyXG4gICAgICBzZWN1cmU6IHRydWVcclxuICAgIH0pO1xyXG5cclxuICAgIHNvY2tldC5jYWxsYmFjayA9IHt9O1xyXG5cclxuICAgIHNvY2tldC5lbWl0V2l0aENhbGxiYWNrID0gZnVuY3Rpb24gKG5hbWUsIGRhdGEsIGNhbGxiYWNrKSB7XHJcbiAgICAgIHNvY2tldC5lbWl0KG5hbWUsIGRhdGEpO1xyXG4gICAgICBzb2NrZXQuY2FsbGJhY2tbbmFtZV0gPSBjYWxsYmFjaztcclxuICAgIH07XHJcblxyXG4gICAgc29ja2V0Lm9uKCdjYWxsYmFjaycsIGZ1bmN0aW9uIChmdW5jLCByZXNwb25zZSkge1xyXG4gICAgICBjb25zb2xlLmxvZygnY2FsbGJhY2s6JywgZnVuYywgdHlwZW9mIHNvY2tldC5jYWxsYmFja1tmdW5jXSk7XHJcbiAgICAgIHNvY2tldC5jYWxsYmFja1tmdW5jXShyZXNwb25zZSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBzb2NrZXQub24oJ2Nvbm5lY3QnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKCdjaGVja2luZyBpZiBjaGF0IGlzIGxvY2tlZCcpO1xyXG4gICAgICBzb2NrZXQuZW1pdCgnY2hlY2sgaWYgbG9ja2VkJywge1xyXG4gICAgICAgIGNoYXRfdXJsOiAkc2NvcGUuY2hhdF91cmxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBzb2NrZXQub24oJ2luaXRpYWxpemUgaGlzdG9yeScsIGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgIHZhciBpO1xyXG4gICAgICAkc2NvcGUuY2hhdF9uYW1lID0gZGF0YS5jaGF0X25hbWU7XHJcbiAgICAgIC8vIENsZWFyIG1lc3NhZ2VzIGFycmF5XHJcbiAgICAgICRzY29wZS5tZXNzYWdlcyA9IFtdO1xyXG4gICAgICAvLyBDbGVhciBjaGF0dGVycyBhcnJheVxyXG4gICAgICB3aGlsZSAoJHNjb3BlLmNoYXR0ZXJzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAkc2NvcGUuY2hhdHRlcnMucG9wKCk7XHJcbiAgICAgIH1cclxuICAgICAgZm9yIChpID0gMDsgaSA8IGRhdGEubWVzc2FnZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAvLyBkYXRhLm1lc3NhZ2VzW2ldLnRleHQgPSAkc2NvcGUuZGVjcnlwdChkYXRhLm1lc3NhZ2VzW2ldLnRleHQpO1xyXG4gICAgICAgIGlmIChkYXRhLm1lc3NhZ2VzW2ldLmVuY3J5cHRlZCkge1xyXG4gICAgICAgICAgZGF0YS5tZXNzYWdlc1tpXS50ZXh0ID0gJHNjb3BlLnNEZWNyeXB0KGRhdGEubWVzc2FnZXNbaV0udGV4dCwgJHNjb3BlLmtleSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG5ldyAkc2NvcGUuTWVzc2FnZShkYXRhLm1lc3NhZ2VzW2ldKTtcclxuICAgICAgfVxyXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgZGF0YS5jaGF0dGVycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIG5ldyAkc2NvcGUuQ2hhdHRlcihkYXRhLmNoYXR0ZXJzW2ldKTtcclxuICAgICAgfVxyXG4gICAgICBjb25zb2xlLmxvZygnaW5pdGlhbGl6ZSBoaXN0b3J5Jyk7XHJcbiAgICAgICRzY29wZS4kYXBwbHkoKTtcclxuICAgICAgLy8gU2Nyb2xsIHRvIHRoZSBib3R0b20ganVzdCBmb3IgcHJldHR5bmVzc1xyXG4gICAgICAkc2NvcGUuc2Nyb2xsRG93bigpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgc29ja2V0Lm9uKCduZXcgbWVzc2FnZScsIGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgIGlmIChkYXRhLnNlbmRlciAhPT0gJHNjb3BlLm15X3VzZXJuYW1lIHx8ICFkYXRhLnNlbmRlcikge1xyXG4gICAgICAgIC8vIGRhdGEudGV4dCA9ICRzY29wZS5kZWNyeXB0KGRhdGEudGV4dCk7XHJcbiAgICAgICAgbmV3ICRzY29wZS5NZXNzYWdlKGRhdGEpO1xyXG4gICAgICB9XHJcbiAgICAgICRzY29wZS4kYXBwbHkoKTtcclxuICAgICAgLy8gU2Nyb2xsIHRvIHRoZSBib3R0b20ganN1dCBmb3IgcHJldHR5bmVzc1xyXG4gICAgfSk7XHJcblxyXG4gICAgc29ja2V0Lm9uKCdlbmNyeXB0ZWQgbWVzc2FnZScsIGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgIGlmIChkYXRhLnNlbmRlciAhPT0gJHNjb3BlLm15X3VzZXJuYW1lKSB7XHJcbiAgICAgICAgZGF0YS50ZXh0ID0gJHNjb3BlLnNEZWNyeXB0KGRhdGEudGV4dCwgJHNjb3BlLmtleSk7XHJcbiAgICAgICAgbmV3ICRzY29wZS5NZXNzYWdlKGRhdGEpO1xyXG4gICAgICB9XHJcbiAgICAgICRzY29wZS4kYXBwbHkoKTtcclxuICAgICAgLy8gU2Nyb2xsIHRvIHRoZSBib3R0b20ganN1dCBmb3IgcHJldHR5bmVzc1xyXG4gICAgfSk7XHJcblxyXG4gICAgJHNjb3BlLnNlbmRNZXNzYWdlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICB2YXIgbWVzc2FnZTtcclxuICAgICAgY29uc29sZS5sb2coJ0VuYyAmIHNlbmQ/JywgdHlwZW9mICRzY29wZS5tZXNzYWdlX3RleHQsICctPicgKyAkc2NvcGUubWVzc2FnZV90ZXh0ICsgJzwtJyk7XHJcbiAgICAgIGlmICgkc2NvcGUubWVzc2FnZV90ZXh0ICE9PSAoJycgfHwgJyAnKSAmJiB0eXBlb2YgJHNjb3BlLm1lc3NhZ2VfdGV4dCAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnWWVzISBFbmNvZGluZyAmIHNlbmRpbmc6JywgdHlwZW9mICRzY29wZS5tZXNzYWdlX3RleHQsICctPicgKyAkc2NvcGUubWVzc2FnZV90ZXh0ICsgJzwtJyk7XHJcbiAgICAgICAgdmFyIG9yaWdpbmFsX3RleHQgPSAkc2NvcGUubWVzc2FnZV90ZXh0O1xyXG4gICAgICAgIC8vIHZhciBlbmNfdGV4dCA9ICdFTkNSWVBURUQ6ICcgKyBHaWJiZXJpc2hBRVMuZW5jKG9yaWdpbmFsX3RleHQsICRzY29wZS5rZXkpO1xyXG4gICAgICAgIHZhciBlbmNfdGV4dCA9ICRzY29wZS5zRW5jcnlwdChvcmlnaW5hbF90ZXh0LCAkc2NvcGUua2V5KTtcclxuICAgICAgICBtZXNzYWdlID0gbmV3ICRzY29wZS5NZXNzYWdlKHtcclxuICAgICAgICAgIHRleHQ6IGVuY190ZXh0LFxyXG4gICAgICAgICAgZW5jcnlwdGVkOiB0cnVlLFxyXG4gICAgICAgICAgc2VuZGVyOiAkc2NvcGUubXlfdXNlcm5hbWVcclxuICAgICAgICB9KTtcclxuICAgICAgICAkc2NvcGUubWVzc2FnZV90ZXh0ID0gJyc7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0VtaXRpbmcgZW5jcnlwdGVkIG1lc3NhZ2U6JywgdHlwZW9mIG1lc3NhZ2UsIG1lc3NhZ2UpO1xyXG4gICAgICAgIHNvY2tldC5lbWl0KCdlbmNyeXB0ZWQgbWVzc2FnZScsIG1lc3NhZ2UpO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdFbWl0ZWQgZW5jcnlwdGVkIG1lc3NhZ2U6JywgdHlwZW9mIG1lc3NhZ2UsIG1lc3NhZ2UpO1xyXG4gICAgICAgIG1lc3NhZ2UudGV4dCA9IG9yaWdpbmFsX3RleHQ7XHJcbiAgICAgICAgbWVzc2FnZS5lbmNyeXB0ZWQgPSBmYWxzZTtcclxuICAgICAgICBjb25zb2xlLmxvZygnTWVzc2FnZTonLCB0eXBlb2YgbWVzc2FnZSwgbWVzc2FnZSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ05vISBTa2lwIGVuY29kaW5nOiBCVUcgSEVSRT8nLCB0eXBlb2YgJHNjb3BlLm1lc3NhZ2VfdGV4dCwgJy0+JyArICRzY29wZS5tZXNzYWdlX3RleHQgKyAnPC0nKTtcclxuICAgICAgICBtZXNzYWdlID0gbmV3ICRzY29wZS5NZXNzYWdlKHtcclxuICAgICAgICAgIHRleHQ6ICRzY29wZS5tZXNzYWdlX3RleHQsXHJcbiAgICAgICAgICBzZW5kZXI6ICRzY29wZS5teV91c2VybmFtZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdFbWl0aW5nIG5ldyBtZXNzYWdlOicsIHR5cGVvZiBtZXNzYWdlLCBtZXNzYWdlKTtcclxuICAgICAgICBzb2NrZXQuZW1pdCgnbmV3IG1lc3NhZ2UnLCBtZXNzYWdlKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8ga2V5ID0gc29kaXVtLnRvX2hleChzb2RpdW0uY3J5cHRvX2dlbmVyaWNoYXNoKDE2LCBzb2RpdW0uZnJvbV9zdHJpbmcoJHNjb3BlLmNoYXRfbmFtZSkpKTsgLy8gd29ya3MgIVxyXG5cclxuICAgICAgLyogdmFyIGtleSA9IHNvZGl1bS50b19oZXgoc29kaXVtLnJhbmRvbWJ5dGVzX2J1ZigxNikpOyAvLyB3b3JrcyB0byAhXHJcbiAgICAgIGNvbnNvbGUubG9nKCdrZXk6Jywga2V5Lmxlbmd0aCwga2V5KTtcclxuICAgICAgdmFyIHRlc3RTb2RpdW0gPSAkc2NvcGUuc0VuY3J5cHQoJypBKkIqQyowKjEqMionLCBrZXkpO1xyXG4gICAgICBjb25zb2xlLmxvZygnc29kaXVtIGVuYzonLCB0ZXN0U29kaXVtKTtcclxuICAgICAgdGVzdFNvZGl1bSA9ICRzY29wZS5zRGVjcnlwdCh0ZXN0U29kaXVtLCBrZXkpO1xyXG4gICAgICBjb25zb2xlLmxvZygnc29kaXVtIGRlYzonLCB0ZXN0U29kaXVtKTsgKi9cclxuICAgIH07XHJcblxyXG4gICAgLy8gU2VuZCBtZXNzYWdlIG9uIGVudGVyIGtleVxyXG4gICAgJCgnI21lc3NhZ2VfdGV4dGFyZWEnKS5rZXlwcmVzcyhmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgICAgaWYgKGV2ZW50LndoaWNoID09PSAxMykge1xyXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgJHNjb3BlLnNlbmRNZXNzYWdlKCk7XHJcbiAgICAgICAgJHNjb3BlLiRhcHBseSgpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBzb2NrZXQub24oJ2NsZWFyIG1lc3NhZ2VzJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAkc2NvcGUubWVzc2FnZXMgPSBbXTtcclxuICAgICAgJHNjb3BlLiRhcHBseSgpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgJHNjb3BlLnNldFVzZXJuYW1lID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICBpZiAoJHNjb3BlLm5ld191c2VybmFtZSAhPT0gJycpIHtcclxuICAgICAgICBpZiAoJHNjb3BlLm15X3VzZXJuYW1lKSB7XHJcbiAgICAgICAgICAkc2NvcGUuY2hhdHRlcnMuZ2V0KCRzY29wZS5teV91c2VybmFtZSkudXBkYXRlTmFtZSgkc2NvcGUubmV3X3VzZXJuYW1lKTtcclxuICAgICAgICAgICQoJyN1c2VybmFtZV9tb2RhbCcpLm1vZGFsKCdoaWRlJyk7XHJcbiAgICAgICAgICAkc2NvcGUudXNlcm5hbWVfZXJyb3IgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICRzY29wZS5qb2luQ2hhdCgkc2NvcGUubmV3X3VzZXJuYW1lKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLy8gU2V0IHVzZXJuYW1lIG9uIGVudGVyIGtleVxyXG4gICAgJCgnI3VzZXJuYW1lX21vZGFsIC51c2VybmFtZScpLmtleXByZXNzKGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgICBpZiAoZXZlbnQud2hpY2ggPT09IDEzKSB7XHJcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAkc2NvcGUuc2V0VXNlcm5hbWUoKTtcclxuICAgICAgICAkc2NvcGUuJGFwcGx5KCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgICRzY29wZS5qb2luQ2hhdCA9IGZ1bmN0aW9uIChuYW1lKSB7XHJcbiAgICAgICRzY29wZS5qb2luX2xvYWRpbmcgPSB0cnVlO1xyXG4gICAgICB2YXIgY2hhdF91cmwgPSBsb2NhdGlvbi5wYXRobmFtZS5zdWJzdHJpbmcoMSk7XHJcbiAgICAgIGNvbnNvbGUubG9nKCdlbWl0dGluZyBqb2luIHJlcXVlc3QnKTtcclxuICAgICAgc29ja2V0LmVtaXRXaXRoQ2FsbGJhY2soJ2pvaW4gY2hhdCcsIHtcclxuICAgICAgICBuYW1lOiBuYW1lLFxyXG4gICAgICAgIGNoYXRfdXJsOiBjaGF0X3VybFxyXG4gICAgICB9LCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygncmVjZWl2ZWQgam9pbiByZXF1ZXN0Jyk7XHJcbiAgICAgICAgaWYgKHJlc3BvbnNlLmFjY2VwdGVkKSB7XHJcbiAgICAgICAgICAkc2NvcGUubXlfdXNlcm5hbWUgPSAkc2NvcGUubmV3X3VzZXJuYW1lO1xyXG4gICAgICAgICAgJCgnI3VzZXJuYW1lX21vZGFsJykubW9kYWwoJ2hpZGUnKTtcclxuICAgICAgICAgICRzY29wZS51c2VybmFtZV9lcnJvciA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICRzY29wZS5zeXN0ZW1NZXNzYWdlKG5hbWUgKyAnIGhhcyBqb2luZWQgdGhlIGNoYXQnKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgJHNjb3BlLnVzZXJuYW1lX2Vycm9yID0gcmVzcG9uc2UuZXJyb3I7XHJcbiAgICAgICAgfVxyXG4gICAgICAgICRzY29wZS5qb2luX2xvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAkc2NvcGUuJGFwcGx5KCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIHNvY2tldC5vbignbmV3IGNoYXR0ZXInLCBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICBuZXcgJHNjb3BlLkNoYXR0ZXIoZGF0YSk7XHJcbiAgICAgICRzY29wZS4kYXBwbHkoKTtcclxuICAgIH0pO1xyXG4gICAgc29ja2V0Lm9uKCdjaGF0dGVyIGRpc2Nvbm5lY3RlZCcsIGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICRzY29wZS5jaGF0dGVycy5kZXN0cm95KGRhdGEubmFtZSk7XHJcbiAgICAgICRzY29wZS4kYXBwbHkoKTtcclxuICAgIH0pO1xyXG4gICAgJHNjb3BlLmxlYXZlQ2hhdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgJHNjb3BlLmNvbmZpcm0oJ0xlYXZlIGNoYXQ/JyxcclxuICAgICAgICAnQXJlIHlvdSBzdXJlIHlvdSB3aXNoIHRvIGxlYXZlIHRoZSBjaGF0PycsXHJcbiAgICAgICAgZnVuY3Rpb24gKGFjY2VwdGVkKSB7XHJcbiAgICAgICAgICBpZiAoYWNjZXB0ZWQpIHtcclxuICAgICAgICAgICAgJHNjb3BlLmNoYXR0ZXJzLmRlc3Ryb3koJHNjb3BlLm15X3VzZXJuYW1lKTtcclxuICAgICAgICAgICAgLy9zb2NrZXQuZW1pdCgnbGVhdmUgY2hhdCcpO1xyXG4gICAgICAgICAgICAvLyRzY29wZS5teV91c2VybmFtZSA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgc29ja2V0LmRpc2Nvbm5lY3QoKTtcclxuICAgICAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XHJcbiAgICAgICAgICAgIC8vd2luZG93LnNvY2tldCA9ICRzY29wZS5jbGllbnRDb25uZWN0aW9uKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIENvbmZpcm0gTW9kYWxcclxuICAgIC8vIGNvbmZpcm0gbW9kYWwgZGVmYXVsdFxyXG4gICAgJHNjb3BlLmNvbmZpcm1fbW9kYWwgPSB7XHJcbiAgICAgIHRpdGxlOiAnQXJlIHlvdSBzdXJlPycsXHJcbiAgICAgIG1lc3NhZ2U6ICdBcmUgeW91IHN1cmU/JyxcclxuICAgICAgcmVzcG9uZDogZnVuY3Rpb24gKCkge31cclxuICAgIH07XHJcbiAgICAkc2NvcGUuY29uZmlybSA9IGZ1bmN0aW9uICh0aXRsZSwgbWVzc2FnZSwgY2FsbGJhY2spIHtcclxuICAgICAgJHNjb3BlLmNvbmZpcm1fbW9kYWwudGl0bGUgPSB0aXRsZTtcclxuICAgICAgJHNjb3BlLmNvbmZpcm1fbW9kYWwubWVzc2FnZSA9IG1lc3NhZ2U7XHJcbiAgICAgICRzY29wZS5jb25maXJtX21vZGFsLnJlc3BvbmQgPSBmdW5jdGlvbiAocmVzcG9uc2UpIHtcclxuICAgICAgICAkKCcjY29uZmlybV9tb2RhbCcpLm1vZGFsKCdoaWRlJyk7XHJcbiAgICAgICAgY2FsbGJhY2socmVzcG9uc2UpO1xyXG4gICAgICB9O1xyXG4gICAgICAkKCcjY29uZmlybV9tb2RhbCcpLm1vZGFsKCdzaG93Jyk7XHJcbiAgICB9O1xyXG5cclxuICAgICQoJyN1c2VybmFtZV9tb2RhbCcpLm9uKCdzaG93bicsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgJCgnI3VzZXJuYW1lX21vZGFsIC51c2VybmFtZScpLmZpcnN0KCkuZm9jdXMoKTtcclxuICAgIH0pO1xyXG4gICAgJHNjb3BlLnNjcm9sbERvd24gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICQoJ2h0bWwsIGJvZHknKS5zdG9wKCkuYW5pbWF0ZSh7XHJcbiAgICAgICAgICBzY3JvbGxUb3A6ICQoZG9jdW1lbnQpLmhlaWdodCgpXHJcbiAgICAgICAgfSwgJ3Nsb3cnKTtcclxuICAgICAgfSwgNTApO1xyXG4gICAgfTtcclxuICAgICRzY29wZS50b2dnbGVMb2NrZWQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIGlmICgkc2NvcGUubG9ja2VkKSB7XHJcbiAgICAgICAgJHNjb3BlLmNvbmZpcm0oJ0NsZWFyIG1lc3NhZ2VzPycsXHJcbiAgICAgICAgICAnV291bGQgeW91IGxpa2UgdG8gZGVsZXRlIGFsbCBtZXNzYWdlcyBmcm9tIHRoZSBjaGF0IGhpc3RvcnkgYmVmb3JlIHVubG9ja2luZz8nLFxyXG4gICAgICAgICAgZnVuY3Rpb24gKGFjY2VwdGVkKSB7XHJcbiAgICAgICAgICAgIGlmIChhY2NlcHRlZCkge1xyXG4gICAgICAgICAgICAgIHNvY2tldC5lbWl0KCdjbGVhciBtZXNzYWdlcycpO1xyXG4gICAgICAgICAgICAgICRzY29wZS5zeXN0ZW1NZXNzYWdlKCdBbGwgbWVzc2FnZXMgY2xlYXJlZCcpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICRzY29wZS5jb25maXJtKCdEb25cXCd0IGNsZWFyIG1lc3NhZ2VzPycsXHJcbiAgICAgICAgICAgICAgICAnQXJlIHlvdSBzdXJlIHlvdSBkb25cXCd0IHdhbnQgdG8gZGVsZXRlIGFsbCBtZXNzYWdlcyBmcm9tIHRoZSBjaGF0IGhpc3RvcnkgYmVmb3JlIHVubG9ja2luZz8nLFxyXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gKGFjY2VwdGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgIGlmICghYWNjZXB0ZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBzb2NrZXQuZW1pdCgnY2xlYXIgbWVzc2FnZXMnKTtcclxuICAgICAgICAgICAgICAgICAgICAkc2NvcGUuc3lzdGVtTWVzc2FnZSgnQWxsIG1lc3NhZ2VzIGNsZWFyZWQnKTtcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgc29ja2V0LmVtaXQoJ3VubG9jayBjaGF0Jyk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBzb2NrZXQuZW1pdCgnbG9jayBjaGF0Jyk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICBzb2NrZXQub24oJ2NoYXQgbG9ja2VkJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAkc2NvcGUubG9ja2VkID0gdHJ1ZTtcclxuICAgICAgY29uc29sZS5sb2coJ2NoYXQgbG9ja2VkJyk7XHJcbiAgICAgICRzY29wZS4kYXBwbHkoKTtcclxuICAgIH0pO1xyXG4gICAgc29ja2V0Lm9uKCdjaGF0IHVubG9ja2VkJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAkc2NvcGUubG9ja2VkID0gZmFsc2U7XHJcbiAgICAgIGNvbnNvbGUubG9nKCdjaGF0IHVubG9ja2VkJyk7XHJcbiAgICAgICRzY29wZS4kYXBwbHkoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8qICRzY29wZS5kZWNyeXB0ID0gZnVuY3Rpb24gKHRleHQpIHtcclxuICAgICAgaWYgKHRleHQuaW5kZXhPZignRU5DUllQVEVEOicpID09PSAwKSB7XHJcbiAgICAgICAgdGV4dCA9IEdpYmJlcmlzaEFFUy5kZWModGV4dC5zdWJzdHJpbmcoMTEpLCAkc2NvcGUua2V5KTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gdGV4dDtcclxuICAgIH07ICovXHJcblxyXG4gICAgJHNjb3BlLnNFbmNyeXB0ID0gZnVuY3Rpb24gKHR4dCwga2V5KSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKCdzb2RpdW0gbXNnIHRvIGVuYzonLCB0eHQpO1xyXG4gICAgICB2YXIgbm9uY2UgPSBzb2RpdW0ucmFuZG9tYnl0ZXNfYnVmKHNvZGl1bS5jcnlwdG9fc2VjcmV0Ym94X05PTkNFQllURVMpO1xyXG4gICAgICAvLyBjb25zb2xlLmxvZygnc29kaXVtIGVuYyBub25jZTonLCBub25jZSk7XHJcbiAgICAgIHZhciBjc2IgPSBzb2RpdW0uY3J5cHRvX3NlY3JldGJveF9lYXN5KHR4dCwgbm9uY2UsIGtleSk7XHJcbiAgICAgIC8vIGNvbnNvbGUubG9nKCdzb2RpdW0gY3NiOicsIGNzYik7XHJcbiAgICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShub25jZS5sZW5ndGggKyBjc2IubGVuZ3RoKTtcclxuICAgICAgYXJyLnNldChub25jZSk7XHJcbiAgICAgIGFyci5zZXQoY3NiLCBub25jZS5sZW5ndGgpO1xyXG4gICAgICB2YXIgcmVzID0gc29kaXVtLnRvX2hleChhcnIpO1xyXG4gICAgICBjb25zb2xlLmxvZygnc29kaXVtIGVuYyBtc2c6JywgcmVzKTtcclxuICAgICAgcmV0dXJuIHJlcztcclxuICAgIH07XHJcblxyXG4gICAgJHNjb3BlLnNEZWNyeXB0ID0gZnVuY3Rpb24gKG5jdCwga2V5KSB7XHJcbiAgICAgIGlmIChuY3QpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnc29kaXVtIHRleHQgdG8gREVDOicsIG5jdCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ3NvZGl1bSBOTyB0ZXh0IHRvIERFQzonLCAnXCInICsgbmN0ICsgJ1wiJyk7XHJcbiAgICAgICAgcmV0dXJuICcgJztcclxuICAgICAgfVxyXG4gICAgICBpZiAobmN0Lmxlbmd0aCA8IHNvZGl1bS5jcnlwdG9fc2VjcmV0Ym94X05PTkNFQllURVMgKyBzb2RpdW0uY3J5cHRvX3NlY3JldGJveF9NQUNCWVRFUykge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdzb2RpdW0gVEhST1cgU2hvcnQgbWVzc2FnZScpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdzb2RpdW0gU2hvcnQgbWVzc2FnZTonLCBuY3QpO1xyXG4gICAgICAgIC8vIHJldHVybiBuY3Q7XHJcbiAgICAgIH1cclxuICAgICAgbmN0ID0gc29kaXVtLmZyb21faGV4KG5jdCk7XHJcbiAgICAgIHZhciBub25jZSA9IG5jdC5zbGljZSgwLCBzb2RpdW0uY3J5cHRvX3NlY3JldGJveF9OT05DRUJZVEVTKSxcclxuICAgICAgICBjdCA9IG5jdC5zbGljZShzb2RpdW0uY3J5cHRvX3NlY3JldGJveF9OT05DRUJZVEVTKTtcclxuICAgICAgdmFyIHJlcyA9IG5ldyBUZXh0RGVjb2RlcigndXRmLTgnKS5kZWNvZGUoc29kaXVtLmNyeXB0b19zZWNyZXRib3hfb3Blbl9lYXN5KGN0LCBub25jZSwga2V5KSk7XHJcbiAgICAgIGNvbnNvbGUubG9nKCdyZXR1cm5pbmcgdGV4dCBERUM6JywgcmVzKTtcclxuICAgICAgcmV0dXJuIHJlcztcclxuICAgIH07XHJcblxyXG4gICAgLy8gQ29weSBVUkxcclxuICAgICRzY29wZS5jb3B5VXJsID0gZnVuY3Rpb24oKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcclxuICAgICAgJCgnI3VybFR4dCcpLnNlbGVjdCgpO1xyXG4gICAgICBjb25zb2xlLmxvZygnQ29weSBVUkw6JywgJCgnI3VybFR4dCcpLnZhbCgpKTtcclxuICAgICAgaWYoZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ2NvcHknKSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdTdWNjZXNzZnVsbHkgY29waWVkIFVSTDonLCAkKCcjdXJsVHh0JykudmFsKCkpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdGQUlMRUQgQ29waW5nIFVSTDonLCAkKCcjdXJsVHh0JykudmFsKCkpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcblxyXG4gICAgLy8gU2lkZWJhciBzbGlkaW5nXHJcbiAgICB2YXIgc2xpZGVfc3BlZWQgPSAzMDA7XHJcbiAgICB2YXIgc2lkZWJhciA9ICQoJy5sZWZ0LWNvbHVtbicpO1xyXG4gICAgJHNjb3BlLnNob3dTaWRlYmFyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICBzaWRlYmFyLmFuaW1hdGUoe1xyXG4gICAgICAgIGxlZnQ6ICcwcHgnXHJcbiAgICAgIH0sIHNsaWRlX3NwZWVkLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgc2lkZWJhci5hZGRDbGFzcygnc2lkZWJhcl9vdXQnKS5jc3Moe1xyXG4gICAgICAgICAgbGVmdDogJydcclxuICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgJHNjb3BlLmhpZGVTaWRlYmFyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICBzaWRlYmFyLmFuaW1hdGUoe1xyXG4gICAgICAgIGxlZnQ6ICctMjIwcHgnXHJcbiAgICAgIH0sIHNsaWRlX3NwZWVkLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgc2lkZWJhci5yZW1vdmVDbGFzcygnc2lkZWJhcl9vdXQnKS5jc3Moe1xyXG4gICAgICAgICAgbGVmdDogJydcclxuICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIHNvY2tldDtcclxuICB9O1xyXG5cclxuICBpZiAoISRzY29wZS5zZXJ2ZXIpIHtcclxuICAgIHZhciBzb2NrZXQgPSAkc2NvcGUuY2xpZW50Q29ubmVjdGlvbigpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICB0ZXN0KCk7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiB0ZXN0KCkge1xyXG4gICAgLypcclxuXHRcdG5ldyAkc2NvcGUuQ2hhdHRlcih7bmFtZTogJ0RhdmUnfSk7XHJcblx0XHRuZXcgJHNjb3BlLkNoYXR0ZXIoe25hbWU6ICdSb2InfSk7XHJcblx0XHRuZXcgJHNjb3BlLkNoYXR0ZXIoe25hbWU6ICdEYW4nfSk7XHJcblx0XHRuZXcgJHNjb3BlLkNoYXR0ZXIoe25hbWU6ICdNYXR0J30pO1xyXG5cclxuXHRcdHZhciBtaW5zX2FnbyA9IGZ1bmN0aW9uIChtaW5zKSB7XHJcblx0XHRcdHZhciB0aW1lID0gbmV3IERhdGUoKTtcclxuXHRcdFx0dGltZS5zZXRNaW51dGVzKHRpbWUuZ2V0TWludXRlcygpIC0gbWlucyk7XHJcblx0XHRcdHJldHVybiB0aW1lO1xyXG5cdFx0fTtcclxuXHJcblx0ICAgIG5ldyAkc2NvcGUubmV3TWVzc2FnZSgnaGVsbG8gd29ybGQnLCAnRGF2ZScsIG1pbnNfYWdvKDEyKSk7XHJcblx0ICAgIG5ldyAkc2NvcGUubmV3TWVzc2FnZSgnZm9vIScsICdSb2InLCBtaW5zX2FnbygxMCkpO1xyXG5cdCAgICBuZXcgJHNjb3BlLm5ld01lc3NhZ2UoJ2Zvbz8nLCAnRGF2ZScsIG1pbnNfYWdvKDkpKTtcclxuXHQgICAgbmV3ICRzY29wZS5uZXdNZXNzYWdlKCdiYXInLCAnUm9iJywgbWluc19hZ28oOSkpO1xyXG5cdCAgICBuZXcgJHNjb3BlLm5ld01lc3NhZ2UoJ2h1bWJ1ZycsICdEYXZlJywgbWluc19hZ28oOCkpO1xyXG5cdCAgICBuZXcgJHNjb3BlLm5ld01lc3NhZ2UoJ1NlZCB1dCBwZXJzcGljaWF0aXMgdW5kZSBvbW5pcyBpc3RlIG5hdHVzIGVycm9yIHNpdCB2b2x1cHRhdGVtIGFjY3VzYW50aXVtIGRvbG9yZW1xdWUgbGF1ZGFudGl1bSwgdG90YW0gcmVtIGFwZXJpYW0sIGVhcXVlIGlwc2EgcXVhZSBhYiBpbGxvIGludmVudG9yZSB2ZXJpdGF0aXMgZXQgJywgJ1ZlZCBVdHRhbWNoYW5kYW5pJywgbWluc19hZ28oOCkpO1xyXG5cdCAgICBuZXcgJHNjb3BlLm5ld01lc3NhZ2UoJ1NlZCB1dCBwZXJzcGljaWF0aXMgdW5kZSBvbW5pcyBpc3RlIG5hdHVzIGVycm9yIHNpdCB2b2x1cHRhdGVtIGFjY3VzYW50aXVtIGRvbG9yZW1xdWUgbGF1ZGFudGl1bSwgdG90YW0gcmVtIGFwZXJpYW0sIGVhcXVlIGlwc2EgcXVhZSBhYiBpbGxvIGludmVudG9yZSB2ZXJpdGF0aXMgZXQgcXVhc2kgYXJjaGl0ZWN0byBiZWF0YWUgdml0YWUgZGljdGEgc3VudCBleHBsaWNhYm8uIE5lbW8gZW5pbSBpcHNhbSB2b2x1cHRhdGVtIHF1aWEgdm9sdXB0YXMgc2l0IGFzcGVybmF0dXIgYXV0IG9kaXQgYXV0IGZ1Z2l0LCBzZWQgcXVpYSBjb25zZXF1dW50dXIgbWFnbmkgZG9sb3JlcyBlb3MgcXVpIHJhdGlvbmUgdm9sdXB0YXRlbSBzZXF1aSBuZXNjaXVudC4gTmVxdWUgcG9ycm8gcXVpc3F1YW0gZXN0LCBxdWkgZG9sb3JlbSBpcHN1bSBxdWlhIGRvbG9yIHNpdCBhbWV0LCBjb25zZWN0ZXR1ciwgYWRpcGlzY2kgdmVsaXQsIHNlZCBxdWlhIG5vbiBudW1xdWFtIGVpdXMgbW9kaSB0ZW1wb3JhIGluY2lkdW50IHV0IGxhYm9yZSBldCBkb2xvcmUgbWFnbmFtIGFsaXF1YW0gcXVhZXJhdCB2b2x1cHRhdGVtLicsICdEYXZlJywgbWluc19hZ28oNikpO1xyXG5cdCAgICBuZXcgJHNjb3BlLm5ld01lc3NhZ2UoJ01hdHQgaGFzIGpvaW5lZCB0aGUgY2hhdCcsIHVuZGVmaW5lZCwgbWluc19hZ28oNSkpO1xyXG5cdCAgICBuZXcgJHNjb3BlLm5ld01lc3NhZ2UoJ0xvcmVtIGlwc3VtIGRvbG9yIHNpdCBhbWV0LCBjb25zZWN0ZXR1ciBhZGlwaXNpY2luZyBlbGl0LCBzZWQgZG8gZWl1c21vZCB0ZW1wb3IgaW5jaWRpZHVudCB1dCBsYWJvcmUgZXQgZG9sb3JlIG1hZ25hIGFsaXF1YS4gVXQgZW5pbSBhZCBtaW5pbSB2ZW5pYW0sIHF1aXMgbm9zdHJ1ZCBleGVyY2l0YXRpb24gdWxsYW1jbyBsYWJvcmlzIG5pc2kgdXQgYWxpcXVpcCBleCBlYSBjb21tb2RvIGNvbnNlcXVhdC4gRHVpcyBhdXRlIGlydXJlIGRvbG9yIGluIHJlcHJlaGVuZGVyaXQgaW4gdm9sdXB0YXRlIHZlbGl0IGVzc2UgY2lsbHVtIGRvbG9yZSBldSBmdWdpYXQgbnVsbGEgcGFyaWF0dXIuIEV4Y2VwdGV1ciBzaW50IG9jY2FlY2F0IGN1cGlkYXRhdCBub24gcHJvaWRlbnQsIHN1bnQgaW4gY3VscGEgcXVpIG9mZmljaWEgZGVzZXJ1bnQgbW9sbGl0IGFuaW0gaWQgZXN0IGxhYm9ydW0uJywgJ01hdHQnLCBtaW5zX2Fnbyg0KSk7XHJcblx0ICAgIG5ldyAkc2NvcGUubmV3TWVzc2FnZSgnbG9sIFRERCA0bGlmZScsICdSb2InLCBtaW5zX2FnbygzKSk7XHJcblx0ICAgIG5ldyAkc2NvcGUubmV3TWVzc2FnZSgnZ29vZGJ5ZSB3b3JsZCcsICdEYXZlJywgbWluc19hZ28oMykpO1xyXG5cdCAgICAqL1xyXG4gIH1cclxuICByZXR1cm4gJHNjb3BlO1xyXG59XHJcbi8vIGZvciBOb2RlIHJlcXVpcmUgY29tbWFuZFxyXG52YXIgbW9kdWxlID0gbW9kdWxlIHx8IHt9O1xyXG5tb2R1bGUuZXhwb3J0cyA9IENoYXQ7XHJcbiJdfQ==
