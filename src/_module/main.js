import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCPdKPTedeFiYCAJvypIgTR3dFxq17yKlc",
  authDomain: "ma-d0t.firebaseapp.com",
  databaseURL: "https://ma-d0t-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ma-d0t",
  storageBucket: "ma-d0t.appspot.com",
  messagingSenderId: "805036478851",
  appId: "1:805036478851:web:8c7339f74c4c1bbc8ce6b6",
  measurementId: "G-HNT2YBHY27"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const fpPromise = import('@fingerprintjs/fingerprintjs')
.then(FingerprintJS => FingerprintJS.load());

import { compareSync, hashSync, genSaltSync } from 'bcryptjs';

window.user = {name: null, vid: null};

fpPromise
.then(fp => fp.get())
.then(result => {
  user.vid = result.visitorId;
  console.log("\nVisitor identifier:\n" + user.vid + "\n\n");
  tryToLog(user.vid).then (() => {
    if (user.name != null) setPreferences()
  });
});

function tryToLog(vid) {
  return get(ref(db, "users")).then((snapshot) => {
    return snapshot.forEach(childSnapshot => {
      if (childSnapshot.child("visitor_id").val() == vid) {
        user.name = childSnapshot.key;
        cusAlert("notify", "Welcome back " + user.name + ",", "you are successfully logged in!");
        console.log("\nLogged in as:\n" + user.name + "\n\n");
        return;
      }
    });
  });
}

function setPreferences() {
  get(ref(db, "users/" + user.name + "/preferences")).then((snapshot) => {
    snapshot.forEach(childSnapshot => {
      var active = document.getElementById(childSnapshot.val());
      if (typeof active != "undefined" && active != null) {
        var params = active.parentElement.querySelectorAll(".setting-param");
        for (var i = 0; i < params.length; i++) {
          if (params[i].classList.contains("current")) params[i].classList.remove("current");
        }
        active.classList.add("current");
        eval("change" + childSnapshot.key + "('" + childSnapshot.val() + "');");
      }
    });
  });
}

window.savePreference = (name, value) => {
  update(ref(db, "users/" + user.name + "/preferences"), {
    [name]: value
  });
  console.log("\n" + name + " remembered:\n" + value + "\n\n");
}

window.reglog = (uname, pass) => {
  return get(ref(db, "users/" + uname)).then((snapshot) => {
    if (snapshot.exists()) {
      if (compareSync(pass, snapshot.child("salted_password").val())) {
        cusAlert("notify", "Welcome back " + uname + ",", "you are successfully logged in!");
      } else {
        cusAlert("error", "Wrong password,", "try one more time!");
        return;
      }
    } else {
      set(ref(db, "users/" + uname), {
        salted_password: hashSync(pass, genSaltSync(10))
      });
      cusAlert("notify", "Welcome " + uname + ",", "you are successfully registered!");
    }
    user.name = uname;
    updateVisitorID(user.name, user.vid)
    return;
  });
}
function updateVisitorID(uname, vid) {
  get(ref(db, "users")).then((snapshot) => {
    snapshot.forEach(childSnapshot => {
      if (childSnapshot.child("visitor_id").val() == vid && childSnapshot.key != uname) {
        update(ref(db, "users/" + childSnapshot.key), {
          visitor_id: "none"
        });
        console.log("\nLogged out on:\n" + childSnapshot.key + "\n\n");
      }
    });
  }).then(() => {
    update(ref(db, "users/" + uname), {
      visitor_id: vid
    });
    console.log("\nLogged in as:\n" + user.name + "\n\n");
  });
}