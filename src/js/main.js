var logged = false;
window.logged = logged;

function log_result(res, text) {
  const res_cont = document.getElementById("log_res-container");
  const res_text = document.getElementById("log_res-text");
  res_text.innerText = text;
  if (res == 1) {
    res_cont.style.backgroundColor = "#33cc33"
    console.log(`Welcome ${db_uname}!`);
    opasity_show(document.getElementById("log-form"), "none");
    log_next();
  } else {
    res_cont.style.backgroundColor = "#ff9933"
  }
}
window.log_result = log_result;

function opasity_show(el, di) {
  if (di !== "none") {
    el.style.opasity = 0;
    el.style.display = di;
    var i = 0;
    setTimeout(() => {
      if (i < 100) {
        i++;
        el.style.opasity = i / 100;
      }
    }, 100); 
    el.style.opasity = 1;
  } else {
    var i = 100;
    el.style.opasity = 1;
    if (i > 0) {
      setTimeout(() => {
          i--;
          el.style.opasity = i / 100;
          console.log(el.style.opasity);
      }, 100 * 100 - i);
    }
    el.style.display = "none";
  }
}

