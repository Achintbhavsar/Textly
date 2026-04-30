import { adminDb, adminAuth } from './config/firebase-admin.js';

/**
 * Migration script to fix users with missing or empty names
 * Run this once: node fix-user-names.js
 */

async function fixUserNames() {
  console.log('🔧 Starting user name fix migration...\n');
  
  try {
    // Get all users from Firestore
    const usersSnapshot = await adminDb.collection('users').get();
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data();
      
      // Check if name is missing or empty
      if (!userData.name || userData.name.trim() === '' || userData.name === 'Unknown') {
        try {
          // Try to get name from Firebase Auth
          const authUser = await adminAuth.getUser(uid);
          
          // Determine best name
          let newName = authUser.displayName || 
                       authUser.email?.split('@')[0] || 
                       `User_${uid.substring(0, 6)}`;
          
          // Update Firestore
          await adminDb.collection('users').doc(uid).update({
            name: newName
          });
          
          console.log(`✅ Fixed user ${uid}: "${userData.name || '(empty)'}" → "${newName}"`);
          fixedCount++;
        } catch (error) {
          console.error(`❌ Error fixing user ${uid}:`, error.message);
        }
      } else {
        skippedCount++;
      }
    }
    
    console.log(`\n✅ Migration complete!`);
    console.log(`   Fixed: ${fixedCount} users`);
    console.log(`   Skipped: ${skippedCount} users (already have names)`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
  
  process.exit(0);
}

// Run the migration
fixUserNames();
