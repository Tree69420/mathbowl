var PORT = process.env.PORT || 5000;
var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
var cookie = require('cookie');
var http = require('http');
var server = http.Server(app);
var fs = require('fs');
app.use(express.static('client'));
app.use(cookieParser());
server.listen(PORT, function () {
  console.log('Chat server running');
});
var answers="";
fs.readFile(__dirname + "/client/answers.txt", 'utf8', function (err, data) {
  if (err) {
    return console.log(err);
  }
  answers=JSON.parse(data);
});
var io = require('socket.io')(server);


var gameNumber = 1;
var gameList = {};
var playerList = {};
app.get('/login', function (req, res) {
  res.sendFile(__dirname + "/client/index.html");
})
function addGames(socket) {
}

io.on('connection', function (socket) {
  var cookies;
  var curName = "placeholder";

  socket.join("menu");
  socket.on('nameSet', function (msg) {
    cookies = cookie.parse(socket.handshake.headers.cookie + "");
    curName = cookies.name;
    playerList[socket.id + ""] = { name: curName, room: "menu" };
    io.emit('universalPlayerList', playerList);


  });

  io.emit('universalPlayerList', playerList);

  io.emit('addGames', gameList);



  socket.on('newGame', function (msg) {
    if (msg.timeLimit > 600 || msg.timeLimit < 1) msg.timeLimit = 60;
    if (msg.problems < 1 || msg.problems > 50) msg.problems = 10;


    if(msg.ep<1 || msg.ep>15) msg.ep = 1;
    if(msg.hp<1 || msg.hp>15) msg.hp = 15;
    if(msg.hp<msg.ep) {msg.ep = 1; msg.hp = 15};
    if(msg.gameType!=="timer" && msg.gameType !== "ranked" && msg.gameType !== "singlePoint"){
      msg.gameType = "singlePoint";
    }
    if(msg.name.trim()==""){
      msg.name = curName+"'s Game";
    }
    console.log(msg);
    gameList[gameNumber + ""] = { name: msg.name, timeLimit: msg.timeLimit, problems: msg.problems, ep:parseInt(msg.ep),hp:parseInt(msg.hp), gameType: msg.gameType, answeringPhase: false, currentProblem: 0 };
    console.log(gameList);
    io.emit('addGames', gameList);
    socket.emit('joinedGame', 0);
    socket.leave("menu");
    socket.join(gameNumber);
    playerList[socket.id + ""] = { name: curName, room: gameNumber + "" };

    gameList[gameNumber + ""]["players"] = [{ id: socket.id, name: curName, answered: false,score: 0 }];
    io.to(gameNumber + "").emit('playerList', gameList[gameNumber + ""]["players"]);

    gameNumber++;
    io.emit('universalPlayerList', playerList);

  });
  socket.on('message', function (msg) {
    var rooms = Object.keys(socket.rooms).filter(item => item != socket.id);
    io.to(rooms[0]).emit('message', msg);

  });
  socket.on('joinGame', function (msg) {
    socket.emit('joinedGame', 0);
    socket.leave("menu");
    socket.join(msg);
    gameList[msg + ""]["players"].push({ id: socket.id, name: curName, answered: false, score: 0});

    playerList[socket.id + ""] = { name: curName, room: msg + "" };

    io.to(msg).emit('playerList', gameList[msg + ""]["players"]);
    io.emit('universalPlayerList', playerList);

  });
  socket.on('leaveRoom', function (msg) {
    var rooms = Object.keys(socket.rooms).filter(item => item != socket.id);
    if (playerList[socket.id + ""] === undefined) {
      socket.join("menu");
      socket.emit('leaveRoom', 0);
      io.emit('addGames', gameList);

      io.emit('universalPlayerList', playerList);

      return;
    }
    var currentRoom = playerList[socket.id + ""].room;

    playerList[socket.id + ""].room = "menu";
    socket.leave(currentRoom);
    socket.join("menu");

    socket.emit('leaveRoom', 0);
    console.log(currentRoom + " <----Current Room");
    if (gameList[currentRoom + ""] !== undefined) {
      gameList[currentRoom + ""]["players"] = gameList[currentRoom + ""]["players"].filter(item => item.id != socket.id);
      io.to(currentRoom).emit('playerList', gameList[currentRoom + ""]["players"]);
      checkLeaveRoom(currentRoom);

    }

    io.emit('addGames', gameList);

    io.emit('universalPlayerList', playerList);

  });
  socket.on('disconnect', function () {
    console.log("disconnect" + " " + socket.id);
    if (playerList[socket.id + ""] !== undefined) {
      var currentRoom = playerList[socket.id + ""].room;

      delete playerList[socket.id + ""];

      var rooms = Object.keys(socket.rooms).filter(item => item != socket.id);
      socket.leave(currentRoom);

      if (currentRoom != "menu") {
        if (gameList[currentRoom + ""] !== undefined) {

          gameList[currentRoom + ""]["players"] = gameList[currentRoom + ""]["players"].filter(item => item.id != socket.id);
          io.to(currentRoom + "").emit('playerList', gameList[currentRoom + ""]["players"]);
          checkLeaveRoom(currentRoom);
          io.emit('addGames', gameList);

        }

      }


      io.emit('universalPlayerList', playerList);
    }

  });
  socket.on('start', function (msg) {
    if (playerList[socket.id + ""] === undefined) return;
    waitProblem(playerList[socket.id + ""].room);
  });
  socket.on('submitAns',function(msg){
    if (playerList[socket.id + ""] === undefined) return;
    if (gameList[playerList[socket.id + ""].room] === undefined) return;
    if(parseInt(msg)==gameList[playerList[socket.id + ""].room].answer){
      for(var i = 0; i<gameList[playerList[socket.id + ""].room].players.length; i++){
        if(gameList[playerList[socket.id + ""].room].players[i].id==socket.id && gameList[playerList[socket.id + ""].room].players[i].answered==false){
          gameList[playerList[socket.id + ""].room].players[i].score++;
          gameList[playerList[socket.id + ""].room].players[i].answered=true;
          break;
        }
      }
      gameList[playerList[socket.id + ""].room + ""]["players"].sort((a, b) => (a.score < b.score) ? 1 : -1)
      io.to(playerList[socket.id + ""].room).emit('playerList', gameList[playerList[socket.id + ""].room + ""]["players"]);

    }
  });
});
function checkLeaveRoom(roomName) {
  if (gameList[roomName + ""] !== undefined && gameList[roomName + ""]["players"].length == 0) {
    delete gameList[roomName + ""];
  }

}

function startProblem(roomName) {
  if (!roomStillOpen(roomName)) return false;

  var randint = Math.floor(Math.random() * 58);
  if (randint < 17) {
    currentYear = randint + 1983;
    currentProblem = Math.floor(Math.random() * (gameList[roomName+""].hp - gameList[roomName+""].ep + 1)) + gameList[roomName+""].ep;
    gameList[roomName + ""]["answer"]=parseInt(answers[currentYear+""][currentProblem+""]);
    fs.readFile(__dirname + "/client/math-problems-master/AIME/" + currentYear + "/" + currentProblem + "/latex.txt", 'utf8', function (err, data) {
      if (err) {
        return console.log(err);
      }
      var problemStatement = data;
      io.to(roomName).emit('showProblem', problemStatement);
      console.log(problemStatement)
      console.log(gameList[roomName + ""]["answer"]);
    });
    io.to(roomName).emit('showImage', "/math-problems-master/AIME/" + currentYear + "/" + currentProblem + "/images/0.png");


  } else if (randint >= 17) {
    currentYear = Math.floor((randint - 17) / 2) + 2000;
    if (randint % 2 == 0) {
      currentYearNumber = 2;
    } else {
      currentYearNumber = 1;
    }
    currentProblem = Math.floor(Math.random() * (gameList[roomName+""].hp - gameList[roomName+""].ep + 1)) + gameList[roomName+""].ep;

    if(currentYearNumber==1) gameList[roomName + ""]["answer"]=parseInt(answers[currentYear+"_I"][currentProblem+""]);
    if(currentYearNumber==2) gameList[roomName + ""]["answer"]=parseInt(answers[currentYear+"_II"][currentProblem+""]);

    console.log(gameList[roomName + ""]["answer"]);

    fs.readFile(__dirname + "/client/math-problems-master/AIME/" + currentYear + "/" + currentYearNumber + "/" + currentProblem + "/latex.txt", 'utf8', function (err, data) {
      if (err) {
        return console.log(err);
      }
      var problemStatement = data;
      io.to(roomName).emit('showProblem', problemStatement);
      console.log(problemStatement)
    });
    io.to(roomName).emit('showImage', "/math-problems-master/AIME/" + currentYear + "/" + currentYearNumber + "/" + currentProblem + "/images/0.png");

  }

  gameList[roomName + ""].answeringPhase = true;
  gameList[roomName + ""].currentProblem++;

  var d = new Date();
  var startingTime = d.getTime();
  var gameTimer = setInterval(function () {
    d = new Date();

    var elapsed = (d.getTime() - startingTime) / 1000;
    elapsed = (Math.round(elapsed * 100) / 100);
    if (!roomStillOpen(roomName)) return;

    if (roomStillOpen(roomName) && elapsed < gameList[roomName + ""].timeLimit) {
      io.to(roomName).emit('clock', gameList[roomName + ""].timeLimit - elapsed);
    }
    else if (roomStillOpen(roomName)) {
      gameList[roomName + ""].answeringPhase = false;
      io.to(roomName).emit('clock', 0);

    }
  }, 10);
  setTimeout(function () {
    clearInterval(gameTimer);
    waitProblem(roomName);
  }, gameList[roomName + ""].timeLimit * 1000 + 1000);

  console.log("answering " + gameList[roomName + ""].currentProblem);

}
function waitProblem(roomName) {
  if (!roomStillOpen(roomName)) return false;

  if (gameList[roomName + ""].currentProblem >= gameList[roomName + ""].problems) {
    io.to(roomName).emit("gameOver", gameList[roomName + ""].players);
    return;
  }
  else {

    for(var i=0; i<gameList[roomName+""].players.length; i++){
      gameList[roomName+""].players[i].answered=false;
    }


    io.to(roomName).emit('closeProblem', 0);

    gameList[roomName + ""].answeringPhase = false;
    io.to(roomName).emit('waiting', 0);
    console.log("waiting");
    setTimeout(function () {
      startProblem(roomName);
    }, 5000);
  }
}
function roomStillOpen(roomName) {
  if (gameList[roomName + ""] !== undefined) return true;
  else return false;
}
