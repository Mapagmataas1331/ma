trans_arr.push(
  "Ma_dot is <i><a class=\"link\" href=\"author\">my (author)</a></i> website with my current projects", "Ма_точка это <i><a class=\"link\" href=\"author\">мой (автор)</a></i> сайт с моими текущими проектами",
);

document.getElementById("imgs").querySelectorAll("img")[0].addEventListener("click", () => {
  hrefTo("https://ma.kak.si");
}, false);
document.getElementById("imgs").querySelectorAll("img")[1].addEventListener("click", () => {
  hrefTo("https://mr.kak.si");
}, false);