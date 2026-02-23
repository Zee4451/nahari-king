import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { generateDataExport, downloadJsonFile } from './exportUtils';

export const performFactoryReset = async (
    onProgress = (msg) => { },
    onComplete = () => { },
    onError = (err) => { }
) => {
    try {
        onProgress('Initializing Factory Reset...');

        // Forced export before deletion
        onProgress('Forcing mandatory data backup before deletion...');
        const backupData = await generateDataExport();
        const dateStr = new Date().toISOString().split('T')[0];
        downloadJsonFile(backupData, `nalli_nihari_emergency_backup_${dateStr}.json`);

        // Collections to wipe
        const collectionsToWipe = [
            'tables',
            'history',
            'inventory',
            'menu_items',
            'POSConfig'
        ];

        for (const collectionName of collectionsToWipe) {
            onProgress(`Wiping collection: ${collectionName}...`);
            const querySnapshot = await getDocs(collection(db, collectionName));

            // Delete sequentially to avoid overwhelming the network or hitting rate limits
            for (const document of querySnapshot.docs) {
                await deleteDoc(doc(db, collectionName, document.id));
            }
        }

        onProgress('Factory reset completed successfully.');
        setTimeout(() => onComplete(), 1500);

        // Force refresh to reconstruct empty state
        window.location.reload();
    } catch (error) {
        console.error('Factory Reset Error:', error);
        onError(error.message);
        throw error;
    }
};
