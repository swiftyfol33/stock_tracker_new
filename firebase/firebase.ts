// firebase/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCxctCCUpJux-68DXH0Zw8DP16VA3Gfhl4",
  authDomain: "stocktrackernew.firebaseapp.com",
  projectId: "stocktrackernew",
  storageBucket: "stocktrackernew.firebasestorage.app",
  messagingSenderId: "571064009811",
  appId: "1:571064009811:web:7a76c1f9552b067edbb2a6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;