import OneSignal from 'react-onesignal';

let initialized = false;

export const initOneSignal = async (userId: string): Promise<void> => {
  if (initialized) return;

  try {
    if (!import.meta.env.VITE_ONESIGNAL_APP_ID) {
      console.warn('⚠️ OneSignal App ID not configured');
      return;
    }

    await OneSignal.init({
      appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: { enable: false } as any,
      serviceWorkerParam: { scope: '/' },
    });

    initialized = true;

    // Link this browser to the logged-in user
    await OneSignal.login(userId);

    // Ask browser for notification permission
    await OneSignal.Notifications.requestPermission();

    console.log('✅ OneSignal initialized for user:', userId);
  } catch (err) {
    console.error('❌ OneSignal initialization error:', err);
  }
};

export const logoutOneSignal = async (): Promise<void> => {
  try {
    initialized = false;
    await OneSignal.logout();
    console.log('✅ OneSignal logged out');
  } catch (err) {
    console.error('❌ OneSignal logout error:', err);
  }
};