/* jshint esversion: 6 */
/* eslint-env es6 */
/* eslint linebreak-style: ["error", "windows"]*/
/* global window, document, sodium, $*/

/* jshint ignore:start */
async function generateKey() {
  await sodium.ready;
  var rbb = sodium.randombytes_buf(16);
  var res = sodium.to_hex(rbb);
  return Promise.resolve(res);
}
async function gen_name() {
  await sodium.ready;
  var rbb = sodium.randombytes_buf(16);
  var res = sodium.to_hex(rbb).toString();
  return Promise.resolve(res);
}
/* jshint ignore:end */

$(document).ready(function () {
  $('.alert').hide();
  var storage = window.sessionStorage;
  var user = unGen();
  storage.removeItem('chatpass');
  storage.removeItem('chatuname');
  storage.removeItem('chatucol');
  storage.removeItem('chatuani');
  gen_name().then(
    result => $('#chat_name').val(result),
    error => function() {
      console.log('ERROR gen_name:', error);
      $('.alert').html('Something went wrong during name generation... Please reload the page (press F5)').fadeIn(250);
      return;
    }
  );
  $('#chatter_name').val(user.ani);
  $('#btn_gen_name').click(function() {
    gen_name().then(
      result => $('#chat_name').val(result),
      error => function() {
        console.log('ERROR gen_name:', error);
        $('.alert').html('Something went wrong during name generation... Please retry or reload the page (press F5)').fadeIn(250);
        return;
      }
    );
  });
  $('#btn_gen_pass').click(function() {
    $('#chat_pass').val(pGen());
  });
  $('#btn_pass_x').click(function() {
    $('#chat_pass').val('');
  });
  $('#btn_gen_user_name').click(function () {
    user = unGen();
    $('#chatter_name').val(user.ani);
  });
  $('#new_chat_form').submit(function (e) {
    e.preventDefault();
    var pw = '';
    var chat_name = $('#chat_name').val().trim()
      .split(' ').join('_')
      .split('.').join('_')
      .split('?').join('_')
      .split('&').join('_')
      .split('/').join('_')
      .split('<').join('_')
      .split('>').join('_');
    var spw = $('#chat_pass').val();
    var uname = $('#chatter_name').val().trim()
      .split(' ').join('_')
      .split('.').join('_')
      .split('?').join('_')
      .split('&').join('_')
      .split('/').join('_')
      .split('<').join('_')
      .split('>').join('_');
    $('button[type="submit"] .spinner-border').show();
    storage.setItem('chatuname', uname);
    if (!user) user = unGen();
    storage.setItem('chatucol', user.col);
    storage.setItem('chatuani', user.ani);
    // console.log('password value: (' + typeof spw +') ' + spw);
    if (spw && spw !== '') {
      pw = sodium.crypto_pwhash_str(
        spw,
        sodium.crypto_pwhash_OPSLIMIT_MIN,
        sodium.crypto_pwhash_MEMLIMIT_MIN
      );
      // console.log(sodium.crypto_pwhash_str_verify(sodium.from_base64(pw), spw));
      if (sodium.crypto_pwhash_str_verify(pw, spw)) {
        storage.setItem('chatpass', sodium.to_base64(sodium.from_string(pw)));
        // window.alert('Test Password ' + spw + ' OK! [' + pw + ']');
      } // else {
      // window.alert('Test Password ' + spw + ' FAILED! [' + pw + ']');
      // }
      // var sod = sodium.to_base64(sodium.from_string(pw));
      // console.log(sod, sod.length, ' -> to_string: ', sodium.to_string(sod).length, sodium.to_string(sod));
      // console.log(sod, sod.length, ' -> to_base64: ', sodium.to_base64(sod).length, sodium.to_base64(sod));
      // console.log(sod, sod.length, ' -> to_hex: ', sodium.to_hex(sod).length, sodium.to_hex(sod));
      // console.log('test:' + pw, ' - to_base64: ' + sodium.to_base64(pw), ' - from_base64: ' + sodium.from_base64(sodium.to_base64(pw)), ' - to_string: ' + sodium.to_string(sodium.from_base64(sodium.to_base64(pw))), pw === sodium.to_string(sodium.from_base64(sodium.to_base64(pw))));

      pw = '&' + sodium.to_base64(sodium.from_string(pw));
    }
    $.getJSON('new/' + chat_name + pw, function(res) {
      if(res.error) {
        console.log(res.error);
        $('.alert').html(res.error).fadeIn(250);
      } else {
        window.location = res.redirect + '#' + generateKey().then(
          result => window.location = res.redirect + '#' + result,
          error => function() {
            console.log('ERROR generateKey:', error);
            $('.alert').html('Something went wrong during page loading... Please reload the page (press F5)').fadeIn(250);
            return;
          }
        );
      }
    });
  });

  /* $.fn.customShow = function (speed) {
    this.show().find('p, h1, h2, h3, h4, li, button').each(function (i) {
      var elem = $(this).css({position: 'relative', opacity: '0', left: '120px'});
      setTimeout(function() {
        elem.animate({opacity: '1', left: '0px'}, speed);
      }, i * 40);
    });
  }; */

  // eslint-disable-next-line no-unused-vars
  /* var showSection = function (e) {
    console.log(location.hash || 'index');
    if(!showSection.running && $(location.hash).get(0)) {
      showSection.running = true;
      if(!showSection.first_shown) {
        var sec = location.hash;
        $(sec).fadeIn(500);
        showSection.curr_section = sec;
        showSection.first_shown = true;
        console.log('first shown');
        showSection.running = false;
      } else {
        $(showSection.curr_section).fadeOut(200, function () {
          var sec = location.hash;
          $(sec).fadeIn(500);
          showSection.curr_section = sec;
          showSection.running = false;
        });
      }
    }
  };

  window.onload = showSection;
  window.onhashchange = showSection;

  $('.info-links a').click(showSection); */
});

var pGen = function() {
  var specials = '!@#$€%^&*()_+{}:"<>?\\|[];\',./~';
  var lowercase = 'abcdefghijklmnopqrstuvwxyz';
  var uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var numbers = '0123456789';

  var all = specials + lowercase + uppercase + numbers;

  String.prototype.pick = function(min, max) {
    var n, chars = '';

    if (typeof max === 'undefined') {
      n = min;
    } else {
      n = min + Math.floor(Math.random() * (max - min));
    }

    for (var i = 0; i < n; i++) {
      chars += this.charAt(Math.floor(Math.random() * this.length));
    }

    return chars;
  };

  // Credit to @Christoph: http://stackoverflow.com/a/962890/464744
  String.prototype.shuffle = function() {
    var array = this.split('');
    var tmp, current, top = array.length;

    if (top) while (--top) {
      current = Math.floor(Math.random() * (top + 1));
      tmp = array[current];
      array[current] = array[top];
      array[top] = tmp;
    }

    return array.join('');
  };

  var password = '';
  password += specials.pick(1);
  password += lowercase.pick(1);
  password += uppercase.pick(1);
  password += numbers.pick(1);
  password += all.pick(16, 16);
  password = password.shuffle();
  return password;
};

var unGen = function () {
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

  var i = Math.floor(Math.random() * 25);
  var col = colors[i];
  i = Math.floor(Math.random() * 25);
  var ani = animals[i];
  var res = {ani: ani, col: col};
  return res;
};
