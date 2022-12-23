import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, update, child } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAcX-IWMEso-jUNNoZqfPOM1MJG5aM8PaM",
  authDomain: "ma-kak-si.firebaseapp.com",
  databaseURL: "https://ma-kak-si-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ma-kak-si",
  storageBucket: "ma-kak-si.appspot.com",
  messagingSenderId: "53690294905",
  appId: "1:53690294905:web:9a6f37e1416eef25042aa8",
  measurementId: "G-6FLL2E44J4"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function log(login, pass) {
  get(ref(db, `users/${login}/password`)).then((snapshot) => {
    if (snapshot.exists()) {
      if (pass == snapshot.val()) {
        var uname = login;
        window.db_uname = uname;
        log_result(1, "Successfully logged in!");
        return true;
      } else {
        log_result(0, "Wrong password!");
        return false;
      }
    } else {
      set(ref(db, `users/${login}`), {
        password: pass
      });
      var uname = login;
      window.db_uname = uname;
      log_result(1, "Successfully registered!");
      return true;
    }
  });
}
window.db_log = log;

function quit() {
  update(ref(db, `users/${db_uname}/game`), {
    online: false
  });
}
window.db_quit = quit;

function logHero() {
  get(ref(db, `users/${db_uname}/game`)).then((snapshot) => {
    if (!(snapshot.exists())) {
      set(ref(db, `users/${db_uname}/game`), {
        cord_x: "0",
        cord_y: "0"
      });
    }
    update(ref(db, `users/${db_uname}/game`), {
      online: true
    });
    var con = true;
    window.db_con = con;
  });
}
window.db_logHero = logHero;

function updateHero(newX, newY) {
  update(ref(db, `users/${db_uname}/game`), {
    cord_x: newX,
    cord_y: newY
  });
}
window.db_updateHero = updateHero;

function getUsers() {
  get(ref(db, 'users')).then((snap) => {
    snap.forEach((userSnap) => {
      if (userSnap.child("game").exists) {
        if (userSnap.child("game/online").val()) {
          createHero(userSnap.key, userSnap.child("game/cord_x").val(), userSnap.child("game/cord_y").val());
        } else {
          removeHero(userSnap.key);
        }
      }
    });
  });
}
window.db_getUsers = getUsers;
