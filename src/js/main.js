var logged = false;
window.logged = logged;

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
window.log_result = log_result;

function appear(){
  var menu = document.getElementById("log-menu");
  var form = document.getElementById("log-form");
  var t_o;
  var speed = 20;
  var m = 0;
  if (menu.style.display == "none") {
    var i = 0;
    var step = 2;
    menu.style.opacity = 0;
    menu.style.display = "block";
  } else if (menu.style.opacity == 1) {
    var i = 100;
    step = -2
  }
  t_o = setInterval(function(){
    m += 0.25;
    var opacity = i / 100;
    var margin = (100 - i) ** 2 / 16;
    i += step; 
    if (i > 100 + step) {
      form.style.marginTop = "calc(50vh - 240px)";
      clearInterval(t_o);
      return; 
    } else if (i < 0 + step) {
      menu.style.display = "none";
      form.style.marginTop = "calc(50vh - 240px)";
      clearInterval(t_o);
      return; 
    }
    menu.style.opacity = opacity;
    form.style.marginTop = "calc(50vh - 240px - " + margin + "px)";
  }, speed);
}

