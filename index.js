var PORT = process.env.PORT || 5000;
var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
var cookie = require('cookie');
var http = require('http');
var server = http.Server(app);
var nodemailer = require('nodemailer');
var fs = require('fs');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'aimecdrerrorreports@gmail.com',
    pass: 'aimecdr12345'
  }
});



app.use(express.static('client'));
app.use(cookieParser());
server.listen(PORT, function () {
  console.log('Chat server running');
});
var answers = "";
fs.readFile(__dirname + "/client/answers.txt", 'utf8', function (err, data) {
  if (err) {
    return console.log(err);
  }
  answers = JSON.parse(data);
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


    if (msg.ep < 1 || msg.ep > 15) msg.ep = 1;
    if (msg.hp < 1 || msg.hp > 15) msg.hp = 15;
    if (msg.hp < msg.ep) { msg.ep = 1; msg.hp = 15 };
    if (msg.ca < 1 || msg.ca > 50) msg.ca = 50;
    if (msg.name.trim() == "") {
      msg.name = curName + "'s Game";
    }

    if (msg.gameType.trim() != "ranking" && msg.gameType.trim() != "timing" && msg.gameType.trim() != "correctAnswer") {
      msg.gameType = "correctAnswer";
    }

    console.log(msg);
    gameList[gameNumber + ""] = { name: msg.name, timeLimit: msg.timeLimit, problems: msg.problems, ep: parseInt(msg.ep), hp: parseInt(msg.hp), answeringPhase: false, currentProblem: 0, started: false, ca: msg.ca, gameType: msg.gameType, time: 0 };
    console.log(gameList);
    io.emit('addGames', gameList);
    socket.emit('joinedGame', 0);

    socket.leave("menu");
    socket.join(gameNumber);
    playerList[socket.id + ""] = { name: curName, room: gameNumber + "" };

    gameList[gameNumber + ""]["players"] = [{ id: socket.id, name: curName, answered: false, score: 0 }];
    io.to(gameNumber + "").emit('playerList', gameList[gameNumber + ""]["players"]);

    gameNumber++;
    io.emit('universalPlayerList', playerList);

  });
  socket.on('message', function (msg) {
    var rooms = Object.keys(socket.rooms).filter(item => item != socket.id);
    io.to(rooms[0]).emit('message', msg);

  });
  socket.on('reportError', function (msg) {
    console.log(msg);
    if (playerList[socket.id + ""] === undefined) return;
    if (gameList[playerList[socket.id + ""].room] === undefined) return;
    var mailOptions = {
      from: 'aimecdrerrorreports@gmail.com',
      to: 'aimecdrerrorreports@gmail.com',
      subject: msg,
      text: msg
    };
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
  });
  socket.on('joinGame', function (msg) {
    socket.emit('joinedGame', 0);
    socket.leave("menu");
    socket.join(msg);
    gameList[msg + ""]["players"].push({ id: socket.id, name: curName, answered: false, score: 0 });

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
    if (!gameList[playerList[socket.id + ""].room].started) {
      gameList[playerList[socket.id + ""].room].started = true;
      waitProblem(playerList[socket.id + ""].room);
    }
    io.emit('addGames', gameList);

  });
  socket.on('submitAns', function (msg) {
    if (playerList[socket.id + ""] === undefined) return;
    if (gameList[playerList[socket.id + ""].room] === undefined) return;
    if(!gameList[playerList[socket.id + ""].room].answeringPhase) return;
    if (parseInt(msg) == gameList[playerList[socket.id + ""].room].answer) {
      for (var i = 0; i < gameList[playerList[socket.id + ""].room].players.length; i++) {
        if (gameList[playerList[socket.id + ""].room].players[i].id == socket.id && gameList[playerList[socket.id + ""].room].players[i].answered == false) {
          if (gameList[playerList[socket.id + ""].room].gameType == "timing") {
            gameList[playerList[socket.id + ""].room].players[i].score += gameList[playerList[socket.id + ""].room].timeLimit - gameList[playerList[socket.id + ""].room].time;
          }
          else if (gameList[playerList[socket.id + ""].room].gameType == "ranking") {
            var numOfPlayers =gameList[playerList[socket.id + ""].room].players.length;
            var peopleAnswered = 0;
            for (var j = 0; j < gameList[playerList[socket.id + ""].room].players.length; j++) {
              if (gameList[playerList[socket.id + ""].room].players[j].answered == true) {
                peopleAnswered++;
              }
            }
            gameList[playerList[socket.id + ""].room].players[i].score+=numOfPlayers-peopleAnswered;
          }
          else if (gameList[playerList[socket.id + ""].room].gameType == "correctAnswer") {
            gameList[playerList[socket.id + ""].room].players[i].score++;
          }
          gameList[playerList[socket.id + ""].room].players[i].answered = true;
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

function UrlExists(url) {
  var http = new XMLHttpRequest();
  http.open('HEAD', url, false);
  http.send();
  if (http.status != 404) {
    return true;
  }
  else {
    return false;
  }
}

function startProblem(roomName) {

  if (!roomStillOpen(roomName)) return false;

  var randint = Math.floor(Math.random() * 58);
  if (randint < 17) {
    currentYear = randint + 1983;
    currentYearNumber = 0;
    currentProblem = Math.floor(Math.random() * (gameList[roomName + ""].hp - gameList[roomName + ""].ep + 1)) + gameList[roomName + ""].ep;
    gameList[roomName + ""]["answer"] = parseInt(answers[currentYear + ""][currentProblem + ""]);
    io.to(roomName).emit('console', currentYear + " Problem: " + currentProblem + " Answer: " + gameList[roomName + ""]["answer"]);

    fs.readFile(__dirname + "/client/math-problems-master/AIME/" + currentYear + "/" + currentProblem + "/latex.txt", 'utf8', function (err, data) {
      if (err) {
        return console.log(err);
      }
      var problemStatement = data;
      problemStatement = problemStatement.split("\\begin{center}").join(" ");
      problemStatement = problemStatement.split("\\end{center}").join(" ");
      problemStatement = problemStatement.split("\\begin{itemize}").join(" ");
      problemStatement = problemStatement.split("\\end{itemize}").join(" ");
      problemStatement = problemStatement.split("\\item").join(" ");
      problemStatement = problemStatement.split("<").join(" < ");
      problemStatement = problemStatement.split(">").join(" > ");

      io.to(roomName).emit('showProblem', problemStatement);
      io.to(roomName).emit('currentProblemInfo',{currentYear:currentYear,currentYearNumber:currentYearNumber,currentProblem,currentProblem});

      console.log(currentYear + " Problem: " + currentProblem);
      console.log(gameList[roomName + ""]["answer"]);


      var mailOptions = {
        from: 'aimecdrerrorreports@gmail.com',
        to: 'aimecdrerrorreports@gmail.com',
        subject: currentYear + " Problem: " + currentProblem,
        text: problemStatement
      };
      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
    });
    var url = "https://raw.githubusercontent.com/RadiantCheddar/mathbowl/master/client/math-problems-master/AIME/" + currentYear + "/" + currentProblem + "/images/0.png";
    if (UrlExists(url)) {
      console.log("WORKS");
      io.to(roomName).emit('imgSetup');
      io.to(roomName).emit('showImage', url);
    }
    else {
      io.to(roomName).emit('noImgSetup');
      console.log("Bruh no url here rn");
    }
  } else if (randint >= 17) {
    currentYear = Math.floor((randint - 17) / 2) + 2000;
    if (randint % 2 == 0) {
      currentYearNumber = 2;
    } else {
      currentYearNumber = 1;
    }
    currentProblem = Math.floor(Math.random() * (gameList[roomName + ""].hp - gameList[roomName + ""].ep + 1)) + gameList[roomName + ""].ep;
    /////// if you want to specify problem for testing
  /*  currentProblem = 11;
    currentYear = 2010;
    currentYearNumber=2;
*/
    ///////
    if (currentYearNumber == 1) gameList[roomName + ""]["answer"] = parseInt(answers[currentYear + "_I"][currentProblem + ""]);
    if (currentYearNumber == 2) gameList[roomName + ""]["answer"] = parseInt(answers[currentYear + "_II"][currentProblem + ""]);

    io.to(roomName).emit('console', currentYear + " " + currentYearNumber + " Problem: " + currentProblem + " Answer: " + gameList[roomName + ""]["answer"]);

    fs.readFile(__dirname + "/client/math-problems-master/AIME/" + currentYear + "/" + currentYearNumber + "/" + currentProblem + "/latex.txt", 'utf8', function (err, data) {
      if (err) {
        return console.log(err);
      }
      var problemStatement = data;
      problemStatement = problemStatement.split("\\begin{center}").join(" ");
      problemStatement = problemStatement.split("\\end{center}").join(" ");
      problemStatement = problemStatement.split("\\begin{itemize}").join(" ");
      problemStatement = problemStatement.split("\\end{itemize}").join(" ");
      problemStatement = problemStatement.split("\\item").join(" ");
      problemStatement = problemStatement.split("<").join(" < ");
      problemStatement = problemStatement.split(">").join(" > ");
      
      io.to(roomName).emit('showProblem', problemStatement);
      io.to(roomName).emit('currentProblemInfo',{currentYear:currentYear,currentYearNumber:currentYearNumber,currentProblem,currentProblem});
      console.log(currentYear + " " + currentYearNumber + " Problem: " + currentProblem);
      console.log(gameList[roomName + ""]["answer"]);


      var mailOptions = {
        from: 'aimecdrerrorreports@gmail.com',
        to: 'aimecdrerrorreports@gmail.com',
        subject: currentYear + " " + currentYearNumber + " Problem: " + currentProblem,
        text: problemStatement
      };
      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });

    });

    var url = "https://raw.githubusercontent.com/RadiantCheddar/mathbowl/master/client/math-problems-master/AIME/" + currentYear + "/" + currentYearNumber + "/" + currentProblem + "/images/0.png";
    if (UrlExists(url)) {
      io.to(roomName).emit('imgSetup');
      io.to(roomName).emit('showImage', url);
      console.log("WORKS");
    }
    else {
      io.to(roomName).emit('noImgSetup');
      console.log("Bruh this url no here rn");
    }
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
    gameList[roomName + ""].time = elapsed;
    if (roomStillOpen(roomName) && elapsed < gameList[roomName + ""].timeLimit) {
      io.to(roomName).emit('clock', gameList[roomName + ""].timeLimit - elapsed);
    }
    else if (roomStillOpen(roomName)) {
      gameList[roomName + ""].answeringPhase = false;
      io.to(roomName).emit('clock', 0);

    }
    var numOfPlayers = gameList[roomName + ""].players.length;
    var peopleAnswered = 0;
    for (var i = 0; i < gameList[roomName + ""].players.length; i++) {
      if (gameList[roomName + ""].players[i].answered == true) {
        peopleAnswered++;
      }
    }
    if (peopleAnswered >= gameList[roomName + ""].ca ||peopleAnswered>=numOfPlayers ) {

      clearTimeout(stopTimer);
      clearInterval(gameTimer);
      waitProblem(roomName);
    }

  }, 10);
  io.emit('addGames', gameList);

  var stopTimer = setTimeout(function () {
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

    for (var i = 0; i < gameList[roomName + ""].players.length; i++) {
      gameList[roomName + ""].players[i].answered = false;
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
