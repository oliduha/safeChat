# SafeChat

Project largely based on Tim's ChatSafe so following is his readme...

I've mostly adapted it to work with lastest vesions of most libs.

The app is deployed on Heroku: https://aqueous-spire-27960.herokuapp.com/

Update 02/22/2019: replaced gibberish by libsodium - secretbox (XChaCha20-Poly1305) - , added an optional password for creating a chat, alert messages, predefined icons and names...

oliduha

#####################################################################

## ChatSafe

A secure chat room service based on Node.js, Socket.io and AngularJS with AES encryption

### How to use ChatSafe

The following steps will allow you to use ChatSafe securely:

    1.  Use private/incognito browsing mode.

    2.  Create a chat using the box on the homepage.
        [*] Generate a secure name for your chat whit the button on the right of the name field.
        [*] Optionaly add a password for your chat. You'll have to send it to your contact(s) preferably in a seperate message or an other way than which you use to send the chat URL (see bellow). You can generate a secured password for your chat whit the button next to the password field.

    3.  Send the address of the newly created chat to anyone you want to chat with. This address contains the key to the chat, so keep it safe. I recommend using <a href="https://privnote.com/">privnote</a> to send the address. Be sure to select the note will be destroy after read AND check "do not ask confirmation before showing and destroying the note"
        [*] If you added a password for you chat, send it to the same person(s) whith the address or, better, using another note or another secure way you trust.

    4.  Once everyone has joined the chat, click the 'lock chat' button on the left of the chat page.

    5.  When you finish your conversation, click 'unlock chat' and when prompted click 'yes' to clear all messages
      from the chat.

### How it works

  When you create a chat, a random key is generated and stored in the hash part of the URL. That's the part which
  your browser can see but is not sent over the internet to the server. This key used to encrypt your messages
  in your browser before they are sent to the server. Once the message reaches the other members of the chat,
  their browsers will get the key from the URL you sent them to join the chat, and use it to decrypt the message
  back to its original form.

  All encryption is done using the Gibberish AES library (see <https://github.com/mdp/gibberish-aes>), so it
  follows the 256 bit AES specification. Because all encryption is done in the browser, not even the ChatSafe server
  can read messages, as it does not have the encryption key.

  In case somebody does manage to get your chat URL, with the key to decrypt the messages, the lock feature can be used
  to stop any new members from joining the chat, so they cannot access the messages. The chat is deleted from the server
  once all members have left.

  [*] All encryption is now done using the Libsodium library. See ['here'](https://github.com/jedisct1/libsodium), ending whith the Gibberish vulnerabilities.
  [*] The optional password is only used on joining the chat. It is hashed both server and client sides using the libsodium library.

### Why was ChatSafe created

  People have a right to communicate in private without being tracked, recorded or monitored. Chatsafe provides
  a simple, fast, browser-based instant messaging service for people to do this. You shouldn't have to trust any
  external service to protect your communication data. With ChatSafe, even if somebody has access to our servers
  they cannot read your messages.

### Who Created ChatSafe

  ChatSafe was created by
  David Timms,
  a student and web developer from Bristol, UK. If you have any questions or feedback about the site, send me a message on my website. [*] Removed broken links.

### Can I trust you

  You don't have to. ChatSafe is open source software, meaning anybody can view the source code at <https://github.com/DavidTimms/ChatSafe>, so you can check that it does what I say it does.

### SSL connection

ChatSafe now uses an SSL connection for an extra layer of security. If you wish to host your own version, put the SSL keys in the ```keys``` folder: *ssl.key* for private, *ssl.crt* for the certificate and for CA *ca.unified.pem*.

[*] Added for SafeChat
