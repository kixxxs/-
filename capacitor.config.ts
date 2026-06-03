import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.artist.manager',
  appName: '艺人管理系统',
  webDir: 'www',
  server: {
    androidScheme: 'http',
    iosScheme: 'http',
  },
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
  ios: {
    allowsLinkPreview: false,
    contentInset: 'automatic',
    infoPlist: {
      NSAppTransportSecurity: {
        NSExceptionDomains: {
          '106.53.6.92': {
            NSExceptionAllowsInsecureHTTPLoads: true,
            NSIncludesSubdomains: false,
          }
        }
      }
    }
  },
};

export default config;
