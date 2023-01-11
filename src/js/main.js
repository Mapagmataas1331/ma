var logged = false;
window.logged = logged;

function log_result(res, text) {
  const res_cont = document.getElementById("log_res-container");
  const res_text = document.getElementById("log_res-text");
  res_text.innerText = text;
  if (res == 1) {
    res_cont.style.backgroundColor = "#33cc33"
    console.log(`Welcome ${db_uname}!`);
    appear(document.getElementById("log-menu"), 5, 40, false);
    appear(document.getElementById("log-form"), 5, 40, true);
    logNext();
  } else {
    res_cont.style.backgroundColor = "#ff9933"
  }
}
window.log_result = log_result;

function appear(elm, step, speed, bool){
  var t_o;
  if (elm.style.display == 'none') {
    var i = 0;
    if (bool) {
      elm.style.marginTop = '-480px';
    } else {
      elm.style.opacity = 0;
    }
    elm.style.display = 'block';
  } else if (elm.style.opacity == 1 || elm.style.marginTop == 'none') {
    var i = 100;
    step = -step
  }
  if (bool) {
    t_o = setInterval(function(){
      var margin = i * i / 12;
      i += step;
      if (i > 100) {
        elm.style.marginTop = 'none';
        elm.style.display = 'none';
        clearInterval(t_o);
        return; 
      } else if (i < 0) {
        elm.style.marginTop = 'none';
        clearInterval(t_o);
        return; 
      }
      elm.style.marginTop = "calc(50vh - 240px - " + margin + "px)";
    }, speed);
  } else {
    t_o = setInterval(function(){
      var opacity = i / 100;
      i += step; 
      if (opacity > 1) {
        clearInterval(t_o);
        return; 
      } else if (opacity < 0) {
        elm.style.display = 'none';
        clearInterval(t_o);
        return; 
      }
      elm.style.opacity = opacity;
    }, speed);
  }
}

