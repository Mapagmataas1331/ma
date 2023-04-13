function addEventListenerList(list, event, fn) {
  for (var i = 0, len = list.length; i < len; i++) {
      list[i].addEventListener(event, fn, false);
}}
function hrefTo(page) {
  for (var i = 0; i <= 100; i++) {
    document.getElementById("content").style.left = -i+"%"
  }
  setTimeout(() => {
    if (typeof page != undefined && page != null && page != "/index") {
      location.href = page;
    } else location.href = "/";
  }, 250);
}
async function cusAlert(type, title, message, link) {
  var newAlert = document.createElement("div");
  newAlert.className = "notification " + type;
  var alertTitle = document.createElement("p");
  alertTitle.className = "notification-title";
  alertTitle.innerHTML = title;
  newAlert.appendChild(alertTitle);
  var alertMessage = document.createElement("p");
  alertMessage.className = "notification-message";
  alertMessage.innerHTML = message;
  newAlert.appendChild(alertMessage);
  document.getElementById("notification-zone").appendChild(newAlert);
  if (typeof link != "undefined" && link != null) newAlert.addEventListener("click", () => {
    hrefTo(link);
  }, false);
  setTimeout(() => {
    alertTitle.innerHTML = "• " + title;
    setTimeout(() => {
      alertTitle.innerHTML = "•• " + title;
      setTimeout(() => {
        alertTitle.innerHTML = "••• " + title;
        setTimeout(() => {
          document.getElementById("notification-zone").removeChild(newAlert);
        }, 1000);
      }, 1000);
    }, 1000);
  }, 5000);
}

window.addEventListener("load", () => {
  for (var i = 100; i >= 0; i--) {
    document.getElementById("content").style.left = i+"%"
  }
}, false);

var page = String(document.location.pathname.split("/").slice(-1));
if (page == "" || page.slice(0, 3) == "ind") {
  page = "in";
} else if (page.slice(0, 3) == "acc") {
  page = "acc";
} else if (page.slice(0, 3) == "aut") {
  page = "author"
} else {
  hrefTo("/")
}
document.getElementById("title").innerHTML = "ma." + page;
document.getElementById("current-page").innerHTML = page;
document.getElementById(page).style.backgroundColor = "var(--third-color)";

document.getElementById("header").firstElementChild.addEventListener("click", () => {
  if (document.getElementById("navigation").style.display == "none") {
    document.getElementById("settings-menu").style.display = "none";
    document.getElementById("navigation").style.display = "block";
  } else {
    document.getElementById("navigation").style.display = "none";
  }
}, false);

document.getElementById("header").lastElementChild.addEventListener("click", () => {
  if (document.getElementById("settings-menu").style.display == "none") {
    document.getElementById("navigation").style.display = "none";
    document.getElementById("settings-menu").style.display = "block";
  } else {
    document.getElementById("settings-menu").style.display = "none";
  }
}, false);

// navigation
addEventListenerList(document.querySelectorAll(".nav-item"), "mouseover", (e) => {
  document.getElementById("current-page").innerHTML = e.target.parentElement.id;
  document.getElementById(page).style = null;
});
document.getElementById("navigation").addEventListener("mouseleave", () => {
  document.getElementById("current-page").innerHTML = page;
  document.getElementById(page).style.backgroundColor = "var(--third-color)";
}, false);
addEventListenerList(document.querySelectorAll(".nav-item"), "click", (e) => {
  hrefTo("/" + e.target.parentElement.firstElementChild.innerHTML);
});

// settings
var tTimeOut = false;
addEventListenerList(document.querySelectorAll(".setting-param"), "click", (e) => {
  var to = tTimeOut;
  eval("change" + e.target.parentElement.firstElementChild.id + "('" + e.target.id + "');");
  if (e.target.parentElement.firstElementChild.id == "lang" && to) return;
  if (user.name != null) savePreference(e.target.parentElement.firstElementChild.id, e.target.id);
  var params = e.target.parentElement.querySelectorAll(".setting-param");
  for (var i = 0; i < params.length; i++) {
    if (params[i].classList.contains("current")) params[i].classList.remove("current");
  }
  e.target.classList.add("current");
});
function changetheme(theme) {
  if (theme == "dark") {
    document.querySelector("body").className = "";
  } else {
    document.querySelector("body").className = theme;
  }
}
const langEls = document.querySelectorAll('[data-translate]');
var trans_arr = [
  "main page", "главная страница",
  "about author", "об авторе",
  "your account", "ваш аккаунт",
  "General Settings", "Основные Настройки",
  "Theme:", "Тема:",
  "Dark", "Тёмная",
  "Light", "Светлая",
  "Purple", "Фиолетовая",
  "Purple", "Фиолетовая",
  "Ocean", "Морская",
  "Language:", "Язык:",
  "English", "Английский",
  "Russian", "Русский",
  "Report a problem:", "Сообщить о проблеме:",
];
function changelang(lang) {
  if (!tTimeOut) {
    tTimeOut = true;
    langEls.forEach((e) => {
      e.innerHTML = translate(lang, e.innerHTML);
    });
    setTimeout(() => {
      tTimeOut = false;
    }, 1000);
  } else cusAlert("alert", "Timeout", "Calm down! You are changing language too fast.");
}
function translate(lang, text) {
  if (lang != "en") {
    for (let i = 0; i < trans_arr.length - 1; i+=2) {
      if (trans_arr[i] == text) return trans_arr[i+1];
    }
  } else {
    for (let i = 1; i < trans_arr.length; i+=2) {
      if (trans_arr[i] == text) return trans_arr[i-1];
    }
  }
  return text;
}