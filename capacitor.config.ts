import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.vikingchat.app',
  appName: 'Viking Chat',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
}

export default config
