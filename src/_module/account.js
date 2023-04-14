import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update } from 'firebase/database';
import { compareSync, hashSync, genSaltSync } from 'bcryptjs';

trans_arr.push(
  "Login form", "Форма Входа",
  "Registration form", "Форма Регистрации",
  "Username:", "Никнейм:",
  "Password:", "Пароль:",
  "First name:", "Имя:",
  "Last name:", "Фамилия:",
  "Email:", "Почта:",
  "Telegram:", "Телеграм:",
  "Log out", "Выйти",
);

userPage();
async function userPage() {
  if (location.hash == "") return;
  location.href = location.href.toLowerCase();
  get(ref(db, "users/" + location.hash.substring(1))).then(snapshot => {
    if (snapshot.exists()) {
      if (snapshot.key == user.id) document.getElementById("logout").style.display = "block";
      logregForms(0, 0);
      document.getElementById("profile").style.display = "block";
      if (snapshot.child("avatar").exists() && snapshot.child("avatar").val() != null && snapshot.child("avatar").val() != "") {
        document.getElementById("avatar").style.backgroundImage = "url(\"" + snapshot.child("avatar").val() + "\")";
      }
      document.getElementById("username").lastChild.innerHTML = snapshot.child("username").val();
      document.getElementById("first_name").lastChild.innerHTML = snapshot.child("first_name").val();
      document.getElementById("last_name").lastChild.innerHTML = snapshot.child("last_name").val();
      document.getElementById("email").lastChild.innerHTML = snapshot.child("email").val();
      document.getElementById("telegram").lastChild.innerHTML = snapshot.child("telegram").val();
    } else {
      cusAlert("alert", "No such user,", "if you aren't trying to see any profile, remove " + location.hash + " from url");
    }
  });
}

window.onLogin = () => {
  if (location.hash == "" || location.hash.substring(1) == user.id || location.hash.substring(1) == user.name) {
    location.hash = user.id;
    userPage();
  }
}

window.login = (uname, pass) => {
  get(ref(db, "users/" + uname.toLowerCase())).then(snapshot => {
    if (snapshot.exists()) {
      if (compareSync(pass, snapshot.child("salted_password").val())) {
        updateVisitor(uname.toLowerCase(), uname, user.vid);
        location.hash = user.id;
        userPage();
      } else {
        cusAlert("alert", "Wrong password,", "try one more time!");
      }
    } else {
      cusAlert("alert", "No such user,", "looks like you need to register.");
    }
  });
}

window.register = (uname, pass, fname, lname, email, tg) => {
  get(ref(db, "users/" + uname.toLowerCase())).then(snapshot => {
    if (snapshot.exists()) {
      cusAlert("alert", "Username \"" + uname + "\" is already taken,", "looks like you'll have to come up with something else.");
    } else {
      set(ref(db, "users/" + uname.toLowerCase()), {
        username: uname,
        salted_password: hashSync(pass, genSaltSync(10)),
        first_name: fname,
        last_name: lname,
        email: email,
        telegram: tg
      });
      cusAlert("notify", "Welcome " + uname + ",", "you are successfully registered!");
      updateVisitor(uname.toLowerCase(), uname, user.vid);
      location.hash = user.id;
      userPage();
    }
  });
}

window.logregForms = logregForms;
function logregForms(log, reg) {
  const logForm = document.getElementById("log-form");
  if (log == 0) {
    logForm.style.display = "none";
  } else logForm.style.display = "block";
  const regForm = document.getElementById("reg-form");
  if (reg == 0) {
    regForm.style.display = "none";
  } else regForm.style.display = "block";
}

document.getElementById("avatar").addEventListener("click", () => {
  if (user.name == null || user.name != location.hash.substring(1)) {
    cusAlert("alert", "No", "You not")
    return;
  }

}, false);