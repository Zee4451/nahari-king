import { writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Helper function to check if a string is a valid ISO date string
const isIsoDateString = (str) => {
    if (typeof str !== 'string') return false;
    // Simple regex for ISO 8601 YYYY-MM-DDTHH:mm:ss.sssZ
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/;
    return isoRegex.test(str);
};

export const importDataToFirestore = async (jsonData, onProgress) => {
    try {
        const parsedData = JSON.parse(jsonData);

        if (!parsedData || !parsedData.version || !parsedData.data) {
            throw new Error("Invalid or corrupted backup file format.");
        }

        onProgress('File parsed successfully. Preparing to write data...');

        for (const [collectionName, documents] of Object.entries(parsedData.data)) {
            if (!Array.isArray(documents)) {
                console.warn(`Skipping invalid collection data for: ${collectionName}`);
                continue;
            }

            if (documents.length === 0) {
                onProgress(`Skipping empty collection: ${collectionName}`);
                continue;
            }

            onProgress(`Importing ${documents.length} items to ${collectionName}...`);

            const BATCH_LIMIT = 400;

            for (let i = 0; i < documents.length; i += BATCH_LIMIT) {
                const batchChunk = documents.slice(i, i + BATCH_LIMIT);
                const batch = writeBatch(db);

                for (const docData of batchChunk) {
                    const { id, ...dataToSave } = docData;
                    if (!id) continue;

                    // Convert ISO strings back to Firestore Timestamps 
                    // This is essential because analytics queries use Timestamp comparisons
                    for (const key in dataToSave) {
                        if (isIsoDateString(dataToSave[key])) {
                            dataToSave[key] = Timestamp.fromDate(new Date(dataToSave[key]));
                        } else if (typeof dataToSave[key] === 'object' && dataToSave[key] !== null) {
                            // Handle nested objects (like recipe created/updated timestamps if nested)
                            for (const nestedKey in dataToSave[key]) {
                                if (isIsoDateString(dataToSave[key][nestedKey])) {
                                    dataToSave[key][nestedKey] = Timestamp.fromDate(new Date(dataToSave[key][nestedKey]));
                                }
                            }
                        }
                    }

                    const collectionPath = String(collectionName);
                    const documentId = String(id);

                    // If this is a shift and contains a payouts subcollection, recreate it
                    if (collectionPath === 'shifts' && dataToSave._payouts_subcollection) {
                        const payoutsArray = dataToSave._payouts_subcollection;
                        // Delete the temporary array so it isn't saved on the parent document
                        delete dataToSave._payouts_subcollection;

                        for (const p of payoutsArray) {
                            const pId = String(p.id);
                            const pData = { ...p };
                            delete pData.id;

                            // Recursively convert strings back to timestamps for the subcollection
                            for (const pk in pData) {
                                if (isIsoDateString(pData[pk])) {
                                    pData[pk] = Timestamp.fromDate(new Date(pData[pk]));
                                } else if (typeof pData[pk] === 'object' && pData[pk] !== null) {
                                    for (const pnk in pData[pk]) {
                                        if (isIsoDateString(pData[pk][pnk])) {
                                            pData[pk][pnk] = Timestamp.fromDate(new Date(pData[pk][pnk]));
                                        }
                                    }
                                }
                            }

                            const payoutDocRef = doc(db, 'shifts', documentId, 'payouts', pId);
                            batch.set(payoutDocRef, pData);
                        }
                    }

                    const docRef = doc(db, collectionPath, documentId);
                    batch.set(docRef, dataToSave);
                }

                await batch.commit();

                if (documents.length > BATCH_LIMIT) {
                    onProgress(`Imported ${Math.min(i + BATCH_LIMIT, documents.length)} / ${documents.length} items to ${collectionName}...`);
                }
            }
        }

        onProgress('Import completed successfully!');
        return true;
    } catch (error) {
        console.error("Import Data Error:", error);
        throw new Error(error.message || "An error occurred during import.");
    }
};
