var logged = false;
window.logged = logged;

function log_result(res, text) {
  const res_cont = document.getElementById("log_res-container");
  const res_text = document.getElementById("log_res-text");
  const log_menu = document.getElementById("log-menu");
  res_text.innerText = text;
  if (res == 1) {
    res_cont.style.backgroundColor = "#33cc33"
    setTimeout(() => {
      log_menu.style.display = "none";
      next();
    }, 3000)
  } else {
    res_cont.style.backgroundColor = "#ff9933"
  }
}
window.log_result = log_result;