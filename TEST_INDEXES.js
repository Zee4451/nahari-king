// Test script to verify Firestore composite indexes are working
// Run this after creating the indexes in Firebase Console

import { 
  getItemUsageRecordsByDateRange,
  getItemPurchaseRecordsByDateRange,
  getItemWasteRecordsByDateRange
} from './src/services/firebaseService';

async function testIndexes() {
  console.log('Testing Firestore composite indexes...');
  
  // Use a known itemId from your database for testing
  const testItemId = 'YOUR_TEST_ITEM_ID_HERE';
  const startDate = new Date('2023-01-01');
  const endDate = new Date(); // Current date
  
  try {
    console.log('Testing getItemUsageRecordsByDateRange...');
    const usageRecords = await getItemUsageRecordsByDateRange(testItemId, startDate, endDate);
    console.log(`✓ Successfully retrieved ${usageRecords.length} usage records`);
    
    console.log('Testing getItemPurchaseRecordsByDateRange...');
    const purchaseRecords = await getItemPurchaseRecordsByDateRange(testItemId, startDate, endDate);
    console.log(`✓ Successfully retrieved ${purchaseRecords.length} purchase records`);
    
    console.log('Testing getItemWasteRecordsByDateRange...');
    const wasteRecords = await getItemWasteRecordsByDateRange(testItemId, startDate, endDate);
    console.log(`✓ Successfully retrieved ${wasteRecords.length} waste records`);
    
    console.log('\n✓ All index-dependent functions are working correctly!');
    console.log('The composite indexes have been created successfully.');
  } catch (error) {
    console.error('✗ Error testing indexes:', error.message);
    console.log('\nPossible causes:');
    console.log('- Composite indexes are still building (check Firebase Console)');
    console.log('- Invalid test itemId');
    console.log('- Security rules are blocking access');
    console.log('- Wrong field names in the index');
  }
}

// To run this test:
// 1. Replace 'YOUR_TEST_ITEM_ID_HERE' with an actual item ID from your database
// 2. Make sure the indexes are showing "Ready" status in Firebase Console
// 3. Execute: node test-indexes.js

testIndexes();