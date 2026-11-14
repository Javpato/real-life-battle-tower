import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
 appId: 'app.everstride.rpg',
 appName: 'Battle Tower',
 webDir: 'dist',
 android: { backgroundColor: '#15253e', allowMixedContent: false },
 // Native inset handling avoids an early CSS injection before the document exists.
 plugins: { SystemBars: { insetsHandling: 'native' } },
};
export default config;
