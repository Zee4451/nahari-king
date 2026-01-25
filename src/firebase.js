import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDMSllnuX2FjEgbq5UtwsE5nm9uJ619OEE",
  authDomain: "nahari-king.firebaseapp.com",
  projectId: "nahari-king",
  storageBucket: "nahari-king.firebasestorage.app",
  messagingSenderId: "107082786786",
  appId: "1:107082786786:web:f31e6b3ce5311a84ec7bbb",
  measurementId: "G-26176P5857"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with cache settings for offline persistence
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED
});

// Initialize Firebase Authentication
const auth = getAuth(app);

export { db, auth };