// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {
  const updateCoins = function () {
    $.get('/coins', function(users) {
      console.log(users);
      document.getElementById('users').innerHTML = '';
      users.forEach(function(user) {
        $('<li></li>').text(user[0] + " " + user[1]).appendTo('ul#users');
      });
    });
  }
  updateCoins();

  $('form').submit(function(event) {
    event.preventDefault();
    var fName = $('input#fName').val();
    var lName = $('input#lName').val();
    $.post('/coins?' + $.param({fName:fName, lName:lName}), function() {
      updateCoins();
      $('input#fName').val('');
      $('input#lName').val('');
      $('input').focus();
    });
  });
});
