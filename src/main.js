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

var page = document.location.pathname.split("/").slice(-1);
alert(page);
if (page == "index.html") { page = "in";
} else if (page = "account.html") { page = "acc";
} else page = page.slice(0, -5);
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