function addEventListenerList(list, event, fn) {
  for (var i = 0, len = list.length; i < len; i++) {
      list[i].addEventListener(event, fn, false);
  }
}

const header_page = document.getElementById("current-page");
const page = document.location.pathname.split("/").slice(-1);

// navigation
addEventListenerList(document.querySelectorAll(".nav-item"), "mouseover", (e) => {
  header_page.innerHTML = e.target.id;
});