import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAD83vOdMtqJxUbPUaG9EibKf8VVTktp9c",
  authDomain: "project-65e76674-5f87-4022-b14.firebaseapp.com",
  projectId: "project-65e76674-5f87-4022-b14",
  storageBucket: "project-65e76674-5f87-4022-b14.firebasestorage.app",
  messagingSenderId: "666784549676",
  appId: "1:666784549676:web:43b8468f76a893674e7a89"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Use initializeFirestore to specify our custom Firestore database ID
export const db = initializeFirestore(app, {}, "ai-studio-3ef48e00-59d6-46d6-b905-c2b8843145f7");

export const storage = getStorage(app);
