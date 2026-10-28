import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Mazaj native shell (Android APK) — direct download, no Play Store.
 * Loads the live production platform; the same service-worker offline
 * stack and two-way sync run inside the app as in any browser.
 */
const config: CapacitorConfig = {
  appId: 'com.mazaj.hookah',
  appName: 'Mazaj',
  webDir: 'web',
  server: { url: 'https://wmazaj.vercel.app' },
  android: { backgroundColor: '#16110e', allowMixedContent: false },
};

export default config;
