var logged = false;

function log_result(res, text) {
  const res_cont = document.getElementById("log_res-container");
  const res_text = document.getElementById("log_res-text");
  res_text.innerText = text;
  if (res == 1) {
    res_cont.style.backgroundColor = "#33cc33"
    console.log(`Welcome ${db_uname}!`);
    appear();
    logNext();
  } else {
    res_cont.style.backgroundColor = "#ff9933"
  }
}

function appear(){
  var bg = document.getElementById("black-bg");
  var form = document.getElementById("log-form");
  var t_o;
  var speed = 20;
  if (bg.style.display == "none") {
    var i = 0;
    var step = 2;
    bg.style.opacity = 0;
    bg.style.display = "block";
  } else if (bg.style.opacity == 1) {
    var i = 100;
    var step = -2;
  }
  t_o = setInterval(function(){
    var opacity = i / 100;
    var margin = (100 - i) ** 2 / 16 + 240;
    i += step; 
    if (i > 100 + step) {
      clearInterval(t_o);
      return; 
    } else if (i < 0 + step) {
      bg.style.display = "none";
      form.style.marginTop = "calc(50vh - 240px)";
      clearInterval(t_o);
      return; 
    }
    bg.style.opacity = opacity;
    form.style.marginTop = "calc(50vh - " + margin + "px)";
  }, speed);
}

