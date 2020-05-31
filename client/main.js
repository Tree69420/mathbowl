var socket = io();
var currentYear = 0;
var currentYearNumber = 0;
var currentProblem = 0;
var currentProblemInfo = 0;
function setCookie(cname,cvalue,exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  var expires = "expires=" + d.toGMTString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
  console.log(document.cookie);
}

function randomName() {
  let names = ["porcupine","hedgehog","pineapple","chicken","horse","cabbage","watermelon","biswadev","dog","fish","elephant","rose","popcorn", "kitten", "CNCM Bot "];
  let name = names[Math.floor(Math.random() * names.length())];
  let number = Math.ceil(Math.random() * 1000);
  return (name.concat(number.toString()));
}

function promptUser () {
  let person = null;
  console.log(document.cookie);
  if (getCookie("name") != "") {
    socket.emit("nameSet","")
    setCookie("name",getCookie("name"),30);
    putName();
    if (getCookie("hasReported") == "true") {
      document.getElementById("reportIssueButton").style.display = "none";
    }
    return;
  }
  while (person == null) {
    person = prompt("Please enter your name using only letters and numbers", randomName());
    if (person != null) {
      person = person.replace(/\s/g,'');
    }
    if (person != null) {
      if (person.includes(';') || person == "") {
        person = null;
      }
    }
  }
  setCookie("name",person,30);
  setCookie("inGame","false",30);
  location.reload();
}

function getCookie(cname) {
  var name = cname + "=";
  var ca = document.cookie.split(';');
  for(var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function putName() {
  document.getElementById("putNameHere").innerText = getCookie("name");
  document.getElementById("gameName").value = getCookie("name")+"'s game";
}

var form = document.getElementById("chatForm");

form.addEventListener('submit', function(e) {
  e.preventDefault();
  var input = document.querySelector('#message');
  var text = input.value;
  if (text == "") {
    return;
  }
  var userName = getCookie("name");
  text = "<b>"+userName + "</b>: " + text;
  socket.emit('message', text);
  input.value = '';
});
$("#createGame").click(function(){
  var easiestProblem = parseInt(document.getElementById("ep").value);
  var hardestProblem = parseInt(document.getElementById("hp").value);
  document.body.style.overflowY = "auto";
  if (getCookie("inGame") == "true") {
    inGame();
    return;
  }
  if(document.getElementById("gameTimeLimit").value<1 || document.getElementById("gameTimeLimit").value>600) document.getElementById("gameTimeLimit").value = 60;
  if(document.getElementById("gameProblems").value<1 || document.getElementById("gameProblems").value>50) document.getElementById("gameProblems").value = 10;

  if(easiestProblem<1 || easiestProblem.value>15) {
    console.log("issue 1");
    document.getElementById("ep").value = 1;
  }
  if(hardestProblem<1 || hardestProblem>15) {
    console.log("issue 2");
    document.getElementById("hp").value = 15;
  }
  if(hardestProblem<easiestProblem) {
    console.log("issue 3");
    document.getElementById("ep").value = 1; 
    document.getElementById("hp").value = 15;
  }
  if(parseInt(document.getElementById("correctAnswers").value)<1 || parseInt(document.getElementById("correctAnswers").value)>50) {
    document.getElementById("correctAnswers").value = 50;
  }

  if(document.getElementById("scoringType").value.trim()!="ranking" && document.getElementById("scoringType").value.trim()!="timing" && document.getElementById("scoringType").value.trim()!="correctAnswer") {
    document.getElementById("scoringType").value= "correctAnswer";
  }
  document.getElementById("start").style.display = "inline-block";
  setCookie("inGame","true",30);
  easiestProblem = parseInt(document.getElementById("ep").value);
  hardestProblem = parseInt(document.getElementById("hp").value);
  socket.emit('newGame',{
    name:document.getElementById("gameName").value,
    timeLimit:document.getElementById("gameTimeLimit").value,
    problems: document.getElementById("gameProblems").value,
    ep: easiestProblem,
    hp: hardestProblem,
    ca: document.getElementById("correctAnswers").value,
    gameType: document.getElementById("scoringType").value

  });
});
$("#start").click(function(){
  socket.emit('start',0);
  document.getElementById("start").style.display = "none";
});
$("#leave").click(function(){
  setCookie("inGame","false",30);
  socket.emit('leaveRoom',0);
});
$("#submitAns").click(function(){
  socket.emit('submitAns',document.getElementById("ansBox").value);
  document.getElementById("ansBox").value="";
});
socket.on('message', function(text) {
  if (!text) {
    return;
  }
  var d = new Date();
  if (d.getHours() < 10){
    var timeHrs = "[0"+d.getHours();
  } else{
    var timeHrs = "["+d.getHours(); 
  }
  if (d.getMinutes() < 10){
    var timeMins = ":0"+d.getMinutes()+"] ";
  } else{
    var timeMins = ":"+d.getMinutes()+"] "; 
  }
  var finMsg = timeHrs + timeMins + text;
  var container = document.getElementById('chatBox');
  var newMessage = document.createElement('p');
  newMessage.innerHTML = finMsg;
  container.appendChild(newMessage);

  var seperator = document.createElement('br');
  container.appendChild(seperator);

  container.scrollTop = container.scrollHeight;
  /* KaTeX renditioning of LaTeX in the chat box
  renderMathInElement(document.getElementById("chatBox"),
      {
        delimiters: [
            {left: "\\begin\{equation*\}", right: "\\end\{equation*\}", display: true},
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false},
            {left: "\\[", right: "\\]", display: true},
            {left: "[display]", right: "[/display]", display: true},
            {left: "[inline]", right: "[/inline]", display: false},
            {left: "\\(", right: "\\)", display: false},
        ]
      });*/
});
window.onbeforeunload = function(e) {
    setCookie("inGame","false",30);
};
socket.on('addGames',function(data){
  $("#games").empty();
  $("#games").append("<p class='labeller'>Games in progress:</p>");

  for(var key in data){
    if(data.hasOwnProperty(key)){
      var styleProps = "";
      if(data[key+""].started){
        styleProps+='background-color:#f1cf91;'
      }

      $("#games").append("<button class='gameBtn' style='"+styleProps+"' onclick='joinGame("+key+")'>"+data[key+""]["name"]+"<br>"+data[key+""]["currentProblem"]+"/"+data[key+""]["problems"]+"</button>")
    }
  }
});
socket.on('currentProblemInfo',function(data){
  currentProblemInfo=data;
})
socket.on('playerList',function(data){
  $("#names").empty();
  $("#names").append("<p class='labeller'>Users online:</p>");
  for(var i = 0; i<data.length; i++){
    $("#names").append("<p><b>"+data[i].name+"</b> - "+data[i].score+"</p>");

  }
});
socket.on('universalPlayerList',function(data){
  $("#universalNames").empty();
  $("#universalNames").append("<p class='labeller'>Users online:</p>");
  for(var key in data){
    if(data.hasOwnProperty(key) && data[key+""].room=="menu"){
      $("#universalNames").append("<p><b>"+data[key+""].name+"</b></p>");
    }
  }
});

socket.on('clock',function(data){
  if(data == 0)document.getElementById("gameTimer").style = "color:red;";
  else document.getElementById("gameTimer").style = "color:black;";

  document.getElementById("gameTimer").innerHTML = "Timer: "+data.toFixed(2);
});

document.getElementById("reportIssue").onclick = function () {
  document.getElementById("myModal2").style.display = "none";
  document.body.style.overflowY = "auto";
  if (document.getElementById("issue").value == "") {
    return;
  }
  setCookie("hasReported","true",30);
  document.getElementById("reportIssueButton").style.display = "none";
  let toPrint = currentProblemInfo.currentYear + " AIME " + currentProblemInfo.currentYearNumber + " Problem " + currentProblemInfo.currentProblem + ". User had following complaint: " + document.getElementById("issue").value;
  socket.emit('reportError',toPrint);
}

socket.on('waiting',function(data){
setCookie("hasReported","false",30);
 document.getElementById("gameTimer").style = "color:black;";
 document.getElementById("questionStatement").innerHTML = "";
 document.getElementById("questionImg").src = "";
 document.getElementById("reportIssueButton").style.display = "none";
  document.getElementById("gameTimer").innerHTML = "The Next Problem Will Start Soon";
});
/* For switching to KaTeX for problem statements as well
document.addEventListener("DOMContentLoaded", function() {
  renderMathInElement(document.getElementById("questionStatement"),
      {
        delimiters: [
            {left: "\\begin\{equation*\}", right: "\\end\{equation*\}", display: true},
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false},
            {left: "\\[", right: "\\]", display: true},
            {left: "[display]", right: "[/display]", display: true},
            {left: "[inline]", right: "[/inline]", display: false},
            {left: "\\(", right: "\\)", display: false},
        ]
      });
});*/

socket.on('showProblem',function(data){
  document.getElementById("questionStatement").innerHTML = data;
  document.getElementById("reportIssueButton").style.display = "inline-block";
  MathJax.Hub.Queue(["Typeset",MathJax.Hub,document.getElementById("questionStatement")]); //Current MathJax rendition of problems
  /* For switching to KaTeX for problem statements as well
  renderMathInElement(document.getElementById("questionStatement"),
      {
        delimiters: [
            {left: "\\begin\{equation*\}", right: "\\end\{equation*\}", display: true},
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false},
            {left: "\\[", right: "\\]", display: true},
            {left: "[display]", right: "[/display]", display: true},
            {left: "[inline]", right: "[/inline]", display: false},
            {left: "\\(", right: "\\)", display: false},
        ]
      });*/
});
socket.on('showImage',function(data){
    document.getElementById("questionImg").src = data;
});
function joinGame(gameNum){
  if(getCookie("inGame") == "true") {
    inGame();
    return;
  }
  setCookie("inGame","true",30);
  socket.emit('joinGame',gameNum);
}

function inGame() {
  window.alert("You're already in a game! Please hunt around your tabs and check if you're in a game.");
  return;
}

socket.on('joinedGame',function(data){
  hideMenu();
  showGame();
  document.getElementById("gameTimer").innerHTML = "";
  document.getElementById("questionStatement").innerHTML = "";
  document.getElementById("questionImg").src = "";


})
socket.on('leaveRoom',function(data){
  hideGame();
  document.getElementById("reportIssueButton").style.display = "none";
  showMenu();
})
socket.on('gameOver',function(data){
  document.getElementById("questionStatement").innerHTML = "Game Over";
  document.getElementById("questionImg").src = "";
  document.getElementById("gameTimer").innerHTML = "";


});

function hideMenu(){
  $("#menu").hide();
}
function showGame(){
  $("#game").show();

}
function showMenu(){
  $("#menu").show();

}
function hideGame(){
  $("#game").hide();

}

socket.on('imgSetup',function(data){
    document.getElementById("question").style.width = "59.5%";
    document.getElementById("img").style.width = "39.5%";
    document.getElementById("img").style.display = "inline-block";
})


socket.on('noImgSetup',function(data){
  document.getElementById("question").style.width = "100%";
  document.getElementById("img").style.width = "0%";
  document.getElementById("img").style.display = "none";
})

socket.on("console",function(msg){
  console.log(msg);
});
