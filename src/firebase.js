import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Remplace ces valeurs par celles de ta console Firebase
// (Paramètres du projet > Général > Vos applications > Config SDK)
const firebaseConfig = {
  apiKey: "AIzaSyBhYoA5O404pOIoWQOpL8RYaQS9OZ2zGhg",
  authDomain: "au-feminin.firebaseapp.com",
  projectId: "au-feminin",
  storageBucket: "au-feminin.firebasestorage.app",
  messagingSenderId: "508437584162",
  appId: "1:508437584162:web:74328d6912eadd8f066d7b",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
