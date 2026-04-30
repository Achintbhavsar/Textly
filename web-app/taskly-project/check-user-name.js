async function checkUserName() {
  console.log('🔍 Checking user name...\n');
  
  try {
    // Check localStorage
    const userStr = localStorage.getItem('taskly_user');
    if (!userStr) {
      console.error('❌ No user in localStorage. Please login first.');
      return;
    }
    
    const localUser = JSON.parse(userStr);
    console.log('📦 LocalStorage user:', localUser);
    
    if (!localUser.name || localUser.name === 'Unknown' || localUser.name.trim() === '') {
      console.error('❌ LocalStorage has empty/unknown name!');
    } else {
      console.log('✅ LocalStorage name:', localUser.name);
    }
    
    // Check Firestore
    const { db } = await import('./Firebase/config.js');
    const { doc, getDoc, updateDoc } = await import('firebase/firestore');
    
    const userDoc = await getDoc(doc(db, 'users', localUser.uid));
    
    if (!userDoc.exists()) {
      console.error('❌ User document does not exist in Firestore!');
      return;
    }
    
    const firestoreData = userDoc.data();
    console.log('🔥 Firestore user:', firestoreData);
    
    if (!firestoreData.name || firestoreData.name === 'Unknown' || firestoreData.name.trim() === '') {
      console.error('❌ Firestore has empty/unknown name!');
      console.log('💡 Attempting to fix...');
      
      // Try to fix
      const newName = localUser.email?.split('@')[0] || 'User';
      await updateDoc(doc(db, 'users', localUser.uid), {
        name: newName
      });
      
      console.log(`✅ Fixed! Updated name to: ${newName}`);
      console.log('🔄 Please refresh the page');
      
      // Update localStorage
      localUser.name = newName;
      localStorage.setItem('taskly_user', JSON.stringify(localUser));
      
    } else {
      console.log('✅ Firestore name:', firestoreData.name);
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log('  LocalStorage name:', localUser.name);
    console.log('  Firestore name:', firestoreData.name);
    
    if (localUser.name === firestoreData.name && localUser.name !== 'Unknown') {
      console.log('\n✅ Everything looks good!');
    } else {
      console.log('\n⚠️  Names do not match or are invalid');
      console.log('💡 Try logging out and logging in again');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Auto-run
console.log('📞 User Name Checker Loaded');
console.log('Run: await checkUserName()');