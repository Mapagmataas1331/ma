function addEventListenerList(list, event, fn) {
  for (var i = 0, len = list.length; i < len; i++) {
      list[i].addEventListener(event, fn, false);
}}
function hrefTo(page) {
  for (let i = 0; i <= 100; i++) {
    document.getElementById("content").style.left = -i+"%"
  }
  setTimeout(() => {
    if (typeof page != undefined && page != null && page != "/index") {
      location.href = page;
    } else location.href = "/";
  }, 250);
}
function roundChange(el, after) {
  if (el.classList.contains("out")) {
    el.classList.remove("out");
  } else {
    el.classList.add("out");
  }
  setTimeout(() => {
    el.innerHTML = after;
  }, 250);
};

window.addEventListener("load", () => {
  for (let i = 100; i >= 0; i--) {
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