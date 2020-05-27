var PORT = process.env.PORT || 5000;
var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');

var http = require('http');
var server = http.Server(app);

app.use(express.static('client'));
app.use(cookieParser());
server.listen(PORT, function() {
  console.log('Chat server running');
});

var io = require('socket.io')(server);


var gameNumber = 1;
var games = [];
app.get('/login', function (req, res) {
  res.sendFile(__dirname+"/client/index.html");
})
function addGames(socket){
}

io.on('connection', function(socket) {
  socket.join("menu");

  io.emit('addGames', games);



  socket.on('newGame', function(msg) {

    games.push(gameNumber);
    io.emit('addGames', games);
    socket.emit('joinedGame',0);
    socket.leave("menu");
    socket.join(gameNumber);
    gameNumber++;

  });
  socket.on('message', function(msg) {
    var rooms = Object.keys(socket.rooms).filter(item => item!=socket.id);
    console.log(rooms[0]);
    io.to(rooms[0]).emit('message', msg);
    
  });
  socket.on('joinGame', function(msg) {
    console.log(msg);
    socket.emit('joinedGame',0);
    socket.leave("menu");
    socket.join(msg);
  });
  socket.on('leaveRoom',function(msg){
    var rooms = Object.keys(socket.rooms).filter(item => item!=socket.id);
    console.log(rooms[0]);
    socket.leave(rooms[0]);
    socket.join("menu");
    socket.emit('leaveRoom',0);
    /*
      if (roommembers == 0){
        deletegame();
      }
    */
  });
});



