import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from 'fs';
import path from 'path';

// Need to read the .env file to initialize manually
const envPath = path.resolve(process.cwd(), '.env');
const envData = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envData.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) envVars[match[1]] = match[2];
});

const firebaseConfig = {
    apiKey: envVars.VITE_FIREBASE_API_KEY,
    authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: envVars.VITE_FIREBASE_PROJECT_ID,
    storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: envVars.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkTable1() {
    const tableRef = doc(db, 'tables', '1');
    const docSnap = await getDoc(tableRef);
    if (docSnap.exists()) {
        console.log(JSON.stringify(docSnap.data().orders, null, 2));
    } else {
        console.log("No table 1 found");
    }
}

checkTable1().catch(console.error);
