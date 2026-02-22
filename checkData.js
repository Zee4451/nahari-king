import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "dummy",
    authDomain: "nahari-king.firebaseapp.com",
    projectId: "nahari-king",
    storageBucket: "nahari-king.firebasestorage.app",
    messagingSenderId: "dummy",
    appId: "dummy"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const checkMetrics = async () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    console.log('Checking metrics for:', dateStr);
    const docRef = doc(db, 'daily_metrics', dateStr);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
        console.log('Metrics found:');
        console.log(JSON.stringify(snap.data(), null, 2));
    } else {
        console.log('No daily metrics found for today.');
    }
    process.exit(0);
};

checkMetrics();
