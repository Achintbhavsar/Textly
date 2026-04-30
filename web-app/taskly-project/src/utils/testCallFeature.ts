// Test utility to verify call feature fixes
// Open browser console and run: testCallFeature.runAllTests()

export const testCallFeature = {
  checkCurrentUser: () => {
    const userStr = localStorage.getItem('taskly_user');
    if (!userStr) {
      console.error('❌ No user in localStorage');
      return null;
    }
    
    const user = JSON.parse(userStr);
    console.log('✅ Current User:', user);
    
    const checks = {
      hasId: !!user.id,
      hasName: !!user.name && user.name !== 'Unknown',
      hasEmail: !!user.email,
      hasProfileUrl: !!user.profileUrl || !!user.photoURL,
    };
    
    console.log('User Data Checks:', checks);
    
    if (!checks.hasName) {
      console.error('❌ User name is missing or "Unknown"');
      console.log('💡 Solution: Re-login or check Firestore users/{uid} document');
    }
    
    return user;
  },

  checkVideoPermissions: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      console.log('✅ Camera and microphone access granted');
      console.log('Video tracks:', stream.getVideoTracks().length);
      console.log('Audio tracks:', stream.getAudioTracks().length);
      
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error: any) {
      console.error('❌ Media access error:', error.message);
      
      if (error.name === 'NotAllowedError') {
        console.log('💡 Solution: Allow camera/microphone in browser settings');
      } else if (error.name === 'NotFoundError') {
        console.log('💡 Solution: Connect a camera/microphone device');
      }
      
      return false;
    }
  },

  runAllTests: async () => {
    console.log('🧪 Running Call Feature Tests...\n');
    
    console.log('Test 1: Current User');
    testCallFeature.checkCurrentUser();
    console.log('\n');
    
    console.log('Test 2: Video Permissions');
    await testCallFeature.checkVideoPermissions();
    console.log('\n');
    
    console.log('✅ All tests complete!');
  }
};

if (typeof window !== 'undefined') {
  (window as any).testCallFeature = testCallFeature;
  console.log('📞 Call Test Utility: Run testCallFeature.runAllTests()');
}
