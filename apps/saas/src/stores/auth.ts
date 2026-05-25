import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { api, type ApiOrganization, type ApiUser } from '../api/client';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<ApiUser | null>(null);
  const activeOrganization = ref<ApiOrganization | null>(null);
  const loading = ref(false);

  const isAuthenticated = computed(() => user.value !== null && activeOrganization.value !== null);

  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      const response = await api.me();
      user.value = response.user;
      activeOrganization.value = response.user?.memberships?.[0]?.organization ?? null;
    } catch {
      user.value = null;
      activeOrganization.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function devLogin(input: {
    email: string;
    displayName?: string;
    organizationName?: string;
  }): Promise<void> {
    loading.value = true;
    try {
      const response = await api.devLogin(input);
      user.value = response.user;
      activeOrganization.value = response.organization;
      await refresh();
    } finally {
      loading.value = false;
    }
  }

  async function firebaseLogin(input: { idToken: string; organizationName?: string }): Promise<void> {
    loading.value = true;
    try {
      const response = await api.firebaseLogin(input);
      user.value = response.user;
      activeOrganization.value = response.organization;
      await refresh();
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    await api.logout();
    user.value = null;
    activeOrganization.value = null;
  }

  return { user, activeOrganization, loading, isAuthenticated, refresh, devLogin, firebaseLogin, logout };
});
