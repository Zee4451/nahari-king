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
            'tables',            // Active tables
            'history',           // Sales history
            'menuItems',         // Menu
            'inventory_items',   // Inventory definitions
            'recipes',           // Recipe blueprints
            'purchase_records',  // Inventory restocks
            'waste_entries',     // Spoilage logs
            'usage_logs',        // Consumption metrics
            'settings',          // Store configuration (POSConfig, features, etc)
            'shifts',            // Shift history
            'daily_metrics'      // Analytics
        ];

        for (const collectionName of collectionsToExport) {
            console.log(`Exporting collection: ${collectionName}...`);
            const querySnapshot = await getDocs(collection(db, collectionName));

            const collectionData = [];
            for (const doc of querySnapshot.docs) {
                // Get doc data verbatim
                const docData = doc.data();

                // Convert Firestore Timestamps to ISO Strings so they can be JSON serialized
                for (let key in docData) {
                    if (docData[key] && typeof docData[key] === 'object' && docData[key].toDate) {
                        docData[key] = docData[key].toDate().toISOString();
                    }
                }

                const docObj = {
                    id: doc.id,
                    ...docData
                };

                // CRITICAL: Subcollections are NOT fetched automatically by getDocs on the parent.
                // If this is a shift, we must manually fetch its payouts subcollection.
                if (collectionName === 'shifts') {
                    const payoutsSnap = await getDocs(collection(db, 'shifts', doc.id, 'payouts'));
                    const payoutsArray = [];
                    payoutsSnap.forEach(pDoc => {
                        const pData = pDoc.data();
                        for (let k in pData) {
                            if (pData[k] && typeof pData[k] === 'object' && pData[k].toDate) {
                                pData[k] = pData[k].toDate().toISOString();
                            }
                        }
                        payoutsArray.push({ id: pDoc.id, ...pData });
                    });
                    if (payoutsArray.length > 0) {
                        docObj._payouts_subcollection = payoutsArray;
                    }
                }

                collectionData.push(docObj);
            }

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
