import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, update } from "firebase/database";

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
var uname = "nouser";
window.db_uname = uname;

function log(login, pass) {
  get(ref(db, `users/${login}/password`)).then((snapshot) => {
    if (snapshot.exists()) {
      if (pass == snapshot.val()) {
        uname = login;
        return true;
      } else {
        return false;
      }
    } else {
      set(ref(db, `users/${login}`), {
        password: pass
      });
      uname = login;
      return true;
    }
  });
}
window.db_log = log;

function checkuname() {
  if (uname != "nouser") {
    return true;
  } else {
    return false;
  }
}
window.db_checkuname = checkuname;

// function getTables() {
//   get(ref(db, `users/${uname}/table_1`)).then((snapshot) => {
//     if (snapshot.exists()) {
//       snapshot.forEach(childSnapshot => {
//         newTbel(1, childSnapshot.key);
//       });
//     }
//   });
//   get(ref(db, `users/${uname}/table_2`)).then((snapshot) => {
//     if (snapshot.exists()) {
//       snapshot.forEach(childSnapshot => {
//         newTbel(2, childSnapshot.key);
//       });
//     }
//   });
// }
// function writeTable(tbn, tname, trowid, trowvalue) {
//   if (uname == "") {
//     alert("Вы не вошли!");
//     return false;
//   } else if (nolog == true) {
//     alert("Вы не имеете права редактирования!");
//     return false;
//   } else {
//     update(ref(db, `users/${uname}/table_${tbn}/${tname}`), {
//       ["table_row_" + String("0" + trowid).slice(-2)]: trowvalue
//     });
//     return true;
//   }
// }
// window.writeTable = writeTable;

// function getTable(tbn, tname, trowid) {
//   if (uname == "") {
//     alert("Вы не вошли!");
//     return false;
//   }
//   return get(ref(db, `users/${uname}/table_${tbn}/${tname}/table_row_${String("0" + trowid).slice(-2)}`)).then((snapshot) => {
//     if (snapshot.exists()) {
//       return snapshot.val();
//     }
//     return null;
//   });
// }
// window.getTable = getTable;

// function checklog() {
//   if (nolog == false) {
//     return true;
//   } else {
//     return false;
//   }
// }
// window.checklog = checklog;
