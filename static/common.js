/* jshint esversion: 6 */
/* eslint-env es6 */
/*eslint linebreak-style: ["error", "windows"]*/

var unGen = function () {
  var animals = [
    'Dog', 'Cat', 'Bird', 'Butterfly', 'Ant',
    'Rabbit', 'Ape', 'Panther', 'Mouse', 'Elephant',
    'Fish', 'Bear', 'Turtle', 'Spider', 'Bat',
    'Giraffe', 'Cow', 'Shark', 'Horse', 'Duck',
    'Deer', 'Fox', 'Frog', 'Pig', 'Snake'
  ];
  // eslint-disable-next-line no-unused-vars
  var qualifs = [
    'Dark', 'Angry', 'Happy', 'Sad', 'Wonderful',
    'Awsome', 'Degenerated', 'Zombi', 'Slow', 'Flying',
    'Migthy', 'Magic', 'Mad', 'Running', 'Speedy',
    'Little', 'Big', 'Stupid', 'Bad', 'Nice'];
  var colors = [
    'Blue', 'Red', 'Yellow', 'Green', 'Purple',
    'Pink', 'Marron', 'Black', 'Magenta', 'Cyan',
    'Aquamarine', 'Orange', 'Indigo', 'Gray', 'Silver',
    'Amethyst', 'Sienna', 'Brown', 'Tan', 'Navy',
    'Teal', 'Lime', 'Chartreuse', 'Lavender', 'Gold'
  ];

  /*var i = Math.floor(Math.random() * 20);
  var res = qualifs[i];*/
  var i = Math.floor(Math.random() * 25);
  var res = [colors[i]];
  i = Math.floor(Math.random() * 25);
  res.push(animals[i]);
  return res;
};

module.exports = unGen;
