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
  }, 500);
}

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
const header_page = document.getElementById("current-page");
header_page.innerHTML = page;
document.getElementById(page).style.backgroundColor = "var(--third-color)";

// navigation
addEventListenerList(document.querySelectorAll(".nav-item"), "mouseover", (e) => {
  header_page.innerHTML = e.target.parentElement.id;
  document.getElementById(page).style = null;
});
document.getElementById("navigation").addEventListener("mouseleave", () => {
  header_page.innerHTML = page;
  document.getElementById(page).style.backgroundColor = "var(--third-color)";
}, false);
addEventListenerList(document.querySelectorAll(".nav-item"), "click", (e) => {
  hrefTo("/" + e.target.parentElement.firstElementChild.innerHTML);
});