import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.artist.manager',
  appName: '艺人管理系统',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#121214',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#121214',
      overlaysWebView: false,
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
