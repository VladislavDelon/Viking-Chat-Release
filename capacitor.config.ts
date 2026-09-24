import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.frozenchat.app',
  appName: 'Frozen Chat',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
}

export default config
