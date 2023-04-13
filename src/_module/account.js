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

import { compareSync, hashSync, genSaltSync } from 'bcryptjs';

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