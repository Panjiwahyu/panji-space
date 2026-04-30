import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDOnCTRuJ7zx3QjxE4Z815jMeziDLf6SeA",
  authDomain: "panji-app-9defd.firebaseapp.com",
  projectId: "panji-app-9defd",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);