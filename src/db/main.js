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

// ---------- Game ---------- \\
function checkAfk() {
  get(ref(db, 'users')).then((snap) => {
    snap.forEach((userSnap) => {
      if (userSnap.child("game").exists) {
        if (userSnap.child("game/online").val()) {
          if (userSnap.child("game/cord_x").val() == userSnap.child("game/cordOld_x").val() && userSnap.child("game/cord_y").val() == userSnap.child("game/cordOld_y").val()) {
            if (userSnap.child("game/afk_time").val() >= 600) {
              update(ref(db, `users/${userSnap.key}/game`), {
                online: false
              });
              update(ref(db, `users/${userSnap.key}/game`), {
                afk_time: 0
              });
            } else {
              update(ref(db, `users/${userSnap.key}/game`), {
                afk_time: userSnap.child("game/afk_time").val() + 1
              });
            }
          } else {
            update(ref(db, `users/${userSnap.key}/game`), {
              cordOld_x: userSnap.child("game/cord_x").val(),
              cordOld_y: userSnap.child("game/cord_y").val(),
              afk_time: 0
            });
          }
        }
      }
    });
  });
}
window.db_checkAfk = checkAfk;

function logHero() {
  get(ref(db, `users/${db_uname}/game`)).then((snapshot) => {
    if (!(snapshot.exists())) {
      set(ref(db, `users/${db_uname}/game`), {
        cord_x: 0,
        cord_y: 0
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

function getHeroes() {
  // var id = 0;
  get(ref(db, 'users')).then((snap) => {
    snap.forEach((userSnap) => {
      // id += 1;
      if (userSnap.child("game").exists) {
        if (userSnap.child("game/online").val()) {
          if (userSnap.child("game/afk_time").val() >= 100) {
            createHero(userSnap.key, `${userSnap.key}\n\n\n\n\nAFK: ${Math.trunc(userSnap.child("game/afk_time").val() / 10)}\nkick: ${Math.trunc((600 - userSnap.child("game/afk_time").val()) / 10) + 1}`, userSnap.child("game/cord_x").val(), userSnap.child("game/cord_y").val());
          } else {
            createHero(userSnap.key, `${userSnap.key}`, userSnap.child("game/cord_x").val(), userSnap.child("game/cord_y").val());
          }
          // if (userSnap.child("game/afk_time").val() == 400 && userSnap.key == db_uname) {
          //   customAlert("warn", "You are AFK!", "If you don't move you will be kicked soon.");
          // }
        } else {
          removeHero(userSnap.key);
          if (userSnap.key == db_uname) {
            defFunc("reload");
          }
        }
      }
    });
  });
}
window.db_getHeroes = getHeroes;
