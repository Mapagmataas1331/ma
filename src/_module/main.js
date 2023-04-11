const { initializeApp } = require('firebase/app');
const { getAnalytics } = require('firebase/analytics');
const { getDatabase, ref, set, get, update, child } = require('firebase/database');

const bcrypt = require('bcryptjs');

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
const analytics = getAnalytics(app);
const db = getDatabase(app);

const fpPromise = import('@fingerprintjs/fingerprintjs')
.then(FingerprintJS => FingerprintJS.load());

window.user = {name: null, vid: null};

fpPromise
.then(fp => fp.get())
.then(result => {
  user.vid = result.visitorId;
  console.log("\nVisitor identifier:\n" + user.vid + "\n\n");
  tryToLog(user.vid);
});

function tryToLog(vid) {
  return get(ref(db, "users")).then((snapshot) => {
    return snapshot.forEach(childSnapshot => {
      if (childSnapshot.child("visitor_id").val() == vid) {
        user.name = childSnapshot.key;
        cusAlert("notify", "Welcome back " + user.name + ",", "you are successfully logged!");
        console.log("Logged in as:\n" + user.name);
        return;
      }
    });
  });
}

window.reglog = async (uname, pass) => {
  return get(ref(db, "users/" + uname)).then(async (snapshot) => {
    if (snapshot.exists()) {
      if (await bcrypt.compareSync(pass, snapshot.child("salted_password").val())) {
        cusAlert("notify", "Welcome back " + uname + ",", "you are successfully logged!");
      } else {
        cusAlert("error", "Wrong password,", "try one more time!");
        return;
      }
    } else {
      set(ref(db, "users/" + uname), {
        salted_password: await bcrypt.hashSync(pass, await bcrypt.genSaltSync(10))
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
        console.log("Logged out:\n" + childSnapshot.key);
      }
    });
  }).then(() => {
    update(ref(db, "users/" + uname), {
      visitor_id: vid
    });
    console.log("Logged in as:\n" + user.name);
  });
}