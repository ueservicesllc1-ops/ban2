// src/lib/firebase.ts
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  projectId: "studio-5319012233-f76c3",
  appId: "1:62546233940:web:57e18101ab0468220e7bc1",
  apiKey: "AIzaSyCL5lNo56vdh5e19JvrkteN4z3Mr8Rf928",
  authDomain: "studio-5319012233-f76c3.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "62546233940",
  storageBucket: "studio-5319012233-f76c3.appspot.com",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
