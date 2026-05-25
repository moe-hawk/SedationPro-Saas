<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';

import { CLINICAL_LIB_VERSION } from '@sedation-pro/clinical';

import ThemeModeButton from './components/ThemeModeButton.vue';
import SedationProShell from './sedation/SedationProShell.vue';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();
const route = useRoute();
const isLogin = computed(() => route.name === 'login');
const isSedationRoute = computed(() => route.meta.sedation === true);
const showShell = computed(() => !isLogin.value && !isSedationRoute.value);

async function logout(): Promise<void> {
  await auth.logout();
  window.location.href = '/login';
}
</script>

<template>
  <SedationProShell v-if="isSedationRoute" />

  <div v-else-if="showShell" class="saas-app-shell">
    <aside class="sidebar">
      <div class="brand-block">
        <div class="brand-mark">SP</div>
        <div>
          <strong>Sedation Pro Cloud</strong>
          <span>Clinical workflow SaaS</span>
        </div>
      </div>

      <nav class="nav-list">
        <RouterLink to="/">Dashboard</RouterLink>
        <RouterLink to="/sedation">Sedation Pro</RouterLink>
        <RouterLink to="/audit-logs">Audit logs</RouterLink>
        <RouterLink to="/billing">Billing</RouterLink>
      </nav>

      <div class="sidebar-footer">
        <span>{{ auth.activeOrganization?.name ?? 'No clinic selected' }}</span>
        <small>Clinical engine {{ CLINICAL_LIB_VERSION }}</small>
        <ThemeModeButton />
        <button class="plain-button" type="button" @click="logout">Sign out</button>
      </div>
    </aside>

    <main class="main-panel">
      <RouterView />
    </main>
  </div>

  <RouterView v-else />
</template>
