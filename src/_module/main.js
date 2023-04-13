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

window.user = {name: null, vid: null};

fpPromise
.then(fp => fp.get())
.then(result => {
  user.vid = result.visitorId;
  console.log("\nVisitor identifier:\n" + user.vid + "\n\n");
  tryToLog(user.vid)
  .then(uname => {
    if (typeof uname != "undefined" && uname != null) {
      updateVisitor(uname, user.vid);
    }
  });
});

async function tryToLog(vid) {
  return get(ref(db, "visitor_ids/" + vid)).then((snapshot) => {
    return snapshot.child("user").val();
  });
}

async function timeFromLastVisit(vid) {
  return get(ref(db, "visitor_ids/" + vid)).then((snapshot) => {
    return ((new Date() - Date.parse(snapshot.child("last_visit").val())) / 60000).toFixed(2);
  });
}

window.updateVisitor = async (uname, vid) => {
  user.name = uname;
  console.log("\nLogged in as:\n" + user.name + "\n\n");
  set(ref(db, "visitor_ids/" + vid), {
    user: uname,
    last_visit: String(new Date())
  });
  setPreferences();
  cusAlert("notify", "Welcome back " + user.name + ",", "you are successfully logged in!");
  console.log("\nSince last visit:\n" + await timeFromLastVisit(vid) + " minutes\n\n");
}

async function setPreferences() {
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

window.savePreference = async (name, value) => {
  update(ref(db, "users/" + user.name + "/preferences"), {
    [name]: value
  });
  console.log("\n" + name + " remembered:\n" + value + "\n\n");
}

window.sendReport = (text) => {
  if (user.name != null) {
    update(ref(db, "reports/" + user.name), {
      [String(new Date())]: text
    })
    cusAlert("notify", "Thank you " + user.name + ",", "your report has been sent!");
  } else {
    cusAlert("alert", "First you need to log in,", "click me to go to login page.", "https://ma.kak.si/account")
  }
}