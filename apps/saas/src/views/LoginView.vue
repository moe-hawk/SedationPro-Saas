<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import ThemeModeButton from '../components/ThemeModeButton.vue';
import { isFirebaseLoginConfigured, signInWithGoogleAndGetIdToken } from '../auth/firebase';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const email = ref('demo@sedationpro.local');
const displayName = ref('Demo Provider');
const organizationName = ref('Apex Dental Demo');
const error = ref('');
const firebaseReady = isFirebaseLoginConfigured();
const isDev = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true';
const showDevLogin = computed(() => !firebaseReady || isDev);

async function submitGoogle(): Promise<void> {
  error.value = '';
  try {
    const idToken = await signInWithGoogleAndGetIdToken();
    await auth.firebaseLogin({ idToken, organizationName: organizationName.value });
    await router.push({ name: 'dashboard' });
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Google login failed';
  }
}

async function submit(): Promise<void> {
  error.value = '';
  try {
    await auth.devLogin({
      email: email.value,
      displayName: displayName.value,
      organizationName: organizationName.value,
    });
    await router.push({ name: 'dashboard' });
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Login failed';
  }
}
</script>

<template>
  <main class="login-page">
    <div class="login-theme-control">
      <ThemeModeButton />
    </div>
    <section class="card login-card">
      <div class="brand-block" style="border: 0; padding-bottom: 16px">
        <div class="brand-mark">SP</div>
        <div>
          <strong>Sedation Pro Cloud</strong>
          <span>{{ firebaseReady ? 'Secure practice login' : 'Development login' }}</span>
        </div>
      </div>

      <p class="muted">
        Use Google login for production/staging once Firebase is configured. The development login remains available only when the API explicitly enables it.
      </p>

      <button v-if="firebaseReady" class="primary-button" type="button" :disabled="auth.loading" @click="submitGoogle">
        {{ auth.loading ? 'Signing in…' : 'Continue with Google' }}
      </button>

      <div v-if="firebaseReady && showDevLogin" class="divider">Development fallback</div>

      <form v-if="showDevLogin" class="form-grid" style="grid-template-columns: 1fr" @submit.prevent="submit">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" autocomplete="email" required />
        </div>
        <div class="field">
          <label for="display-name">Display name</label>
          <input id="display-name" v-model="displayName" type="text" />
        </div>
        <div class="field">
          <label for="organization-name">Clinic / organization</label>
          <input id="organization-name" v-model="organizationName" type="text" />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="primary-button" type="submit" :disabled="auth.loading">
          {{ auth.loading ? 'Signing in…' : 'Enter dashboard' }}
        </button>
      </form>
      <p v-else-if="firebaseReady" class="muted">Production sign-in is handled through Google. Development fallback login is hidden unless explicitly enabled for a local build.</p>
    </section>
  </main>
</template>
