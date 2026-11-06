/* ============================================================
   FIREBASE CONFIG — Ragnar Solutions
   Paste your Firebase project config below.
   Get it from: Firebase Console → Project Settings → Your apps → Web
   ============================================================ */
 const firebaseConfig = {
    apiKey: "AIzaSyBgq4OJ9_dLrzMASDqrDUbr2OpxGHcVVSo",
    authDomain: "ragnar-solutions.firebaseapp.com",
    projectId: "ragnar-solutions",
    storageBucket: "ragnar-solutions.firebasestorage.app",
    messagingSenderId: "979478683091",
    appId: "1:979478683091:web:716f9ee7d572c9b65aa326",
    measurementId: "G-94KZZLV342"
  };

/* ---- Initialize Firebase ---- */
firebase.initializeApp(firebaseConfig);

const db      = firebase.firestore();
const auth    = firebase.auth();
const storage = firebase.storage();
