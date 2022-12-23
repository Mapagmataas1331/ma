var logged = false;
window.logged = logged;

function log_result(res, text) {
  const res_cont = document.getElementById("log_res-container");
  const res_text = document.getElementById("log_res-text");
  const res_form = document.getElementById("log-form");
  res_text.innerText = text;
  if (res == 1) {
    res_cont.style.backgroundColor = "#33cc33"
    console.log(`Welcome ${db_uname}!`);
    appear(res_form, 100, -5, 40);
    log_next();
  } else {
    res_cont.style.backgroundColor = "#ff9933"
  }
}
window.log_result = log_result;

function appear(elm, i, step, speed){
  var t_o;
  i = i || 0;
  step = step || 5;
  speed = speed || 50; 
  t_o = setInterval(function(){
    var opacity = i / 100;
    i = i + step; 
    if (opacity > 1){
      clearInterval(t_o);
      return; 
    } else if (opacity < 0) {
      elm.style.display = "none";
      clearInterval(t_o);
      return; 
    }
    elm.style.opacity = opacity;
    elm.style.filter = 'alpha(opacity=' + opacity*100 + ')';
  }, speed);
}

