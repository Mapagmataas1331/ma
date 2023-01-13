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
const database = getDatabase(app);
window.db = {};

function log(login, pass) {
  get(ref(database, `users/${login}/password`)).then((snapshot) => {
    if (snapshot.exists()) {
      if (pass == snapshot.val()) {
        valsArr.uname = login;
        log_result(1, "Successfully logged in!");
        return true;
      } else {
        log_result(0, "Wrong password!");
        return false;
      }
    } else {
      set(ref(database, `users/${login}`), {
        password: pass
      });
      valsArr.uname = login;
      log_result(1, "Successfully registered!");
      return true;
    }
  });
}
window.db.log = log;

// ---------- Game ---------- \\
function checkAfk() {
  get(ref(database, 'users')).then((snap) => {
    snap.forEach((userSnap) => {
      if (userSnap.child("game").exists) {
        if (userSnap.child("game/online").val()) {
          if (userSnap.child("game/cord_x").val() == userSnap.child("game/cordOld_x").val() && userSnap.child("game/cord_y").val() == userSnap.child("game/cordOld_y").val()) {
            if (userSnap.child("game/afk_time").val() >= 600) {
              update(ref(database, `users/${userSnap.key}/game`), {
                online: false
              });
              update(ref(database, `users/${userSnap.key}/game`), {
                afk_time: 0
              });
            } else {
              update(ref(database, `users/${userSnap.key}/game`), {
                afk_time: userSnap.child("game/afk_time").val() + 1
              });
            }
          } else {
            update(ref(database, `users/${userSnap.key}/game`), {
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
window.db.checkAfk = checkAfk;

function logHero() {
  get(ref(database, `users/${valsArr.uname}/game`)).then((snapshot) => {
    if (!(snapshot.exists())) {
      set(ref(database, `users/${valsArr.uname}/game`), {
        cord_x: 0,
        cord_y: 0
      });
    }
    update(ref(database, `users/${valsArr.uname}/game`), {
      online: true,
      img_0: "0",
      img_1: "0"
    });
    window.db.con = true;
  });
}
window.db.logHero = logHero;

function updateHero(newX, newY) {
  update(ref(database, `users/${valsArr.uname}/game`), {
    cord_x: newX,
    cord_y: newY
  });
}
window.db.updateHero = updateHero;

function getHeroes() {
  // var id = 0;
  get(ref(database, 'users')).then((snap) => {
    snap.forEach((userSnap) => {
      // id += 1;
      if (userSnap.child("game").exists) {
        if (userSnap.child("game/online").val()) {
          if (userSnap.child("game/afk_time").val() >= 300) {
            createHero(userSnap.key, `${userSnap.key}\n\n\n\n\nAFK: ${Math.trunc(userSnap.child("game/afk_time").val() / 10)}\nkick: ${Math.trunc((600 - userSnap.child("game/afk_time").val()) / 10) + 1}`,
            "00", userSnap.child("game/img_0").val(), userSnap.child("game/img_1").val(), userSnap.child("game/transform").val(), userSnap.child("game/cord_x").val(), userSnap.child("game/cord_y").val());
            window.db.afk = true;
          } else {
            createHero(userSnap.key, `${userSnap.key}`, "00", userSnap.child("game/img_0").val(), userSnap.child("game/img_1").val(), userSnap.child("game/transform").val(), userSnap.child("game/cord_x").val(), userSnap.child("game/cord_y").val());
            window.db.afk = false;
          }
          // if (userSnap.child("game/afk_time").val() == 400 && userSnap.key == valsArr.uname) {
          //   customAlert("warn", "You are AFK!", "If you don't move you will be kicked soon.");
          // }
        } else {
          removeHero(userSnap.key);
          if (userSnap.key == valsArr.uname) {
            defFunc("reload");
          }
        }
      }
    });
  });
}
window.db.getHeroes = getHeroes;

function idleAnim(randv) {
  if (db.afk && valsArr.idleAnim) {
    valsArr.idleAnim = false;
    setTimeout(function() {
      update(ref(database, `users/${valsArr.uname}/game`), {
        img_0: "1",
      });
      setTimeout(function() {
        update(ref(database, `users/${valsArr.uname}/game`), {
          img_0: "2",
        });
      }, 0.05 * randv);
    }, 0.05 * randv);
  } else if (!db.afk){
    valsArr.idleAnim = true;
    setTimeout(function() {
      update(ref(database, `users/${valsArr.uname}/game`), {
        img_0: "1",
      });
      setTimeout(function() {
        update(ref(database, `users/${valsArr.uname}/game`), {
          img_0: "2",
        });
        setTimeout(function() {
          update(ref(database, `users/${valsArr.uname}/game`), {
            img_0: "1",
          });
         setTimeout(function() {
          update(ref(database, `users/${valsArr.uname}/game`), {
            img_0: "0",
          });
         }, 0.05 * randv);
        }, 0.05 * randv);
      }, 0.05 * randv);
    }, 0.05 * randv);
  }
}
window.db.idleAnim = idleAnim;

function updateHeroTransform(value) {
  update(ref(database, `users/${valsArr.uname}/game`), {
    transform: value
  });
}
window.db.updateHeroTransform = updateHeroTransform;
