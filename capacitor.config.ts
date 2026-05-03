import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.avisor.app',
    appName: 'PilotAvisor',
    webDir: 'dist',
    // Uncomment during Capacitor dev so the native shell hot-reloads from Vite.
    // server: {
    //   url: 'http://192.168.x.x:5173',  // replace with your LAN IP
    //   cleartext: true,                  // Android only
    // },
};

export default config;
