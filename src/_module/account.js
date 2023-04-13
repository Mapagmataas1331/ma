import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update } from 'firebase/database';
import { compareSync, hashSync, genSaltSync } from 'bcryptjs';

trans_arr.push(
  "*Username:", "*Никнейм:",
  "*Password:", "*Пароль:",
  "Login form", "Форма Входа",
  "Registration form", "Форма Регистрации",
);

userPage();
function userPage() {
  if (location.hash == "") return;
  console.log(location.hash.substring(1));
}

window.onLogin = () => {
  if (location.hash == "") {
    location.hash = user.name;
    userPage();
  }
}

window.login = (uname, pass) => {
  get(ref(db, "users/" + uname)).then((snapshot) => {
    if (snapshot.exists()) {
      if (compareSync(pass, snapshot.child("salted_password").val())) {
        updateVisitor(uname, user.vid);
      } else {
        cusAlert("alert", "Wrong password,", "try one more time!");
      }
    } else {
      cusAlert("alert", "No such account,", "first you need to register.");
    }
  });
}

window.register = (uname, pass) => {
  get(ref(db, "users/" + uname)).then((snapshot) => {
    if (snapshot.exists()) {
      cusAlert("alert", "Username \"" + uname + "\" is already taken,", "looks like you'll have to come up with something else.");
    } else {
      set(ref(db, "users/" + uname), {
        salted_password: hashSync(pass, genSaltSync(10))
      });
      cusAlert("notify", "Welcome " + uname + ",", "you are successfully registered!");
      updateVisitor(uname, user.vid);
    }
  });
}