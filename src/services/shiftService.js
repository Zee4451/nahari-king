import { db } from '../firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    limit,
    runTransaction,
    arrayUnion
} from 'firebase/firestore';
import { monitorFirebaseOperation } from '../utils/performanceMonitor';

const shiftsCollection = collection(db, 'shifts');

// Get the currently open shift (there should only be one)
export const getCurrentShift = async () => {
    return await monitorFirebaseOperation('getCurrentShift', async () => {
        try {
            const q = query(shiftsCollection, where('status', '==', 'open'), limit(1));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;

            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error('Error fetching current shift:', error);
            throw error;
        }
    });
};

// Start a new shift with the given opening cash
export const startShift = async (openingCash) => {
    return await monitorFirebaseOperation('startShift', async () => {
        try {
            // First check if a shift is already open
            const currentShift = await getCurrentShift();
            if (currentShift) {
                throw new Error('A shift is already open. Please close it before starting a new one.');
            }

            const shiftId = `shift_${Date.now()}`;
            const newShift = {
                status: 'open',
                openingTime: serverTimestamp(),
                closingTime: null,
                openingCash: Number(openingCash) || 0,
                actualClosingCash: null,
                payouts: [],
                calculatedTotals: {
                    expectedCash: Number(openingCash) || 0, // Starts equal to opening cash
                    cashSales: 0,
                    upiSales: 0,
                    paymentMethodBreakdown: {},
                    totalRevenue: 0
                }
            };

            await setDoc(doc(shiftsCollection, shiftId), newShift);
            return { id: shiftId, ...newShift };
        } catch (error) {
            console.error('Error starting shift:', error);
            throw error;
        }
    });
};

// Add a payout/expense to the currently active shift
export const addPayout = async (shiftId, amount, reason, type = 'other') => {
    return await monitorFirebaseOperation('addPayout', async () => {
        try {
            const shiftRef = doc(db, 'shifts', shiftId);

            await runTransaction(db, async (transaction) => {
                const shiftDoc = await transaction.get(shiftRef);
                if (!shiftDoc.exists()) throw new Error('Shift does not exist');
                if (shiftDoc.data().status !== 'open') throw new Error('Cannot add payout to a closed shift');

                const payoutObj = {
                    amount: Number(amount),
                    reason: reason,
                    type: type,
                    timestamp: Timestamp.now()
                };

                // Deduct from expected cash
                const currentExpected = shiftDoc.data().calculatedTotals?.expectedCash || 0;

                // 1. Update the shift's expected cash
                transaction.update(shiftRef, {
                    'calculatedTotals.expectedCash': currentExpected - Number(amount)
                });

                // 2. Add the payout to the subcollection
                const payoutRef = doc(collection(db, 'shifts', shiftId, 'payouts'));
                transaction.set(payoutRef, {
                    amount: Number(amount),
                    reason: reason,
                    type: type,
                    timestamp: serverTimestamp() // Safe because it's a dedicated doc
                });
            });

            return true;
        } catch (error) {
            console.error('Error adding payout:', error);
            throw error;
        }
    });
};

// Close the active shift, comparing expected vs actual cash
export const closeShift = async (shiftId, actualClosingCash) => {
    return await monitorFirebaseOperation('closeShift', async () => {
        try {
            const shiftRef = doc(db, 'shifts', shiftId);
            await updateDoc(shiftRef, {
                status: 'closed',
                closingTime: serverTimestamp(),
                actualClosingCash: Number(actualClosingCash)
            });
            return true;
        } catch (error) {
            console.error('Error closing shift:', error);
            throw error;
        }
    });
};

// Fetch historical shifts based on a date range logic (similar to getAnalyticsData)
export const getShiftHistory = async (startDate, endDate) => {
    return await monitorFirebaseOperation('getShiftHistory', async () => {
        try {
            let q = query(shiftsCollection, orderBy('openingTime', 'desc'));

            if (startDate) {
                // Approximate time boundaries for simplicity
                const startTs = typeof startDate === 'string' ? Timestamp.fromDate(new Date(startDate)) : startDate;
                q = query(shiftsCollection, where('openingTime', '>=', startTs), orderBy('openingTime', 'desc'));
            }

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching shift history:', error);
            return [];
        }
    });
};

// --- POS Configuration (Payment Methods) --- //
// Usually, we'd put this in settingsService or firebaseService, but adding here for modularity.
// We'll store it in a singleton document `settings/posConfig`
const settingsDoc = doc(db, 'settings', 'posConfig');

export const getPaymentMethods = async () => {
    return await monitorFirebaseOperation('getPaymentMethods', async () => {
        try {
            const snap = await getDoc(settingsDoc);
            if (snap.exists() && snap.data().paymentMethods) {
                return snap.data().paymentMethods;
            }
            // Defaults if never set
            return ['Cash', 'UPI'];
        } catch (error) {
            console.error('Error fetching payment methods:', error);
            return ['Cash', 'UPI']; // fail safe
        }
    });
};

export const updatePaymentMethods = async (methods) => {
    return await monitorFirebaseOperation('updatePaymentMethods', async () => {
        try {
            await setDoc(settingsDoc, { paymentMethods: methods }, { merge: true });
            return true;
        } catch (error) {
            console.error('Error updating payment methods:', error);
            throw error;
        }
    });
};
