import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Fetches all necessary collections from Firestore and packages them into a single JSON object.
 */
export const generateDataExport = async () => {
    try {
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            data: {}
        };

        const collectionsToExport = [
            'tables',          // Active tables
            'history',         // Sales history
            'menu_items',      // Menu
            'inventory',      // Inventory
            'POSConfig'       // Store settings
        ];

        for (const collectionName of collectionsToExport) {
            console.log(`Exporting collection: ${collectionName}...`);
            const querySnapshot = await getDocs(collection(db, collectionName));

            const collectionData = [];
            querySnapshot.forEach((doc) => {
                // Get doc data verbatim
                const docData = doc.data();

                // Convert Firestore Timestamps to ISO Strings so they can be JSON serialized
                for (let key in docData) {
                    if (docData[key] && typeof docData[key] === 'object' && docData[key].toDate) {
                        docData[key] = docData[key].toDate().toISOString();
                    }
                }

                collectionData.push({
                    id: doc.id,
                    ...docData
                });
            });

            exportData.data[collectionName] = collectionData;
        }

        return exportData;
    } catch (error) {
        console.error('Error generating data export:', error);
        throw error;
    }
};

/**
 * Triggers a browser download of the given object as a JSON file.
 * @param {Object} data - The data to serialize and download
 * @param {string} filename - The desired file name
 */
export const downloadJsonFile = (data, filename) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
