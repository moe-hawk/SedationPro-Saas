// Embedded SaaS mode must not use the original app's localStorage persistence.
// All case persistence is handled by the cloud API/SQL database.
(globalThis as typeof globalThis & { __SEDATION_PRO_CLOUD_ONLY__?: boolean }).__SEDATION_PRO_CLOUD_ONLY__ = true;

import '@sedation-pro/ui/styles';
import '@/styles/utilities.css';
import './styles.css';
// Side-effect: resolves and applies the original Sedation Pro theme before first paint.
import '@/composables/useTheme';

import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import { router } from './router';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
