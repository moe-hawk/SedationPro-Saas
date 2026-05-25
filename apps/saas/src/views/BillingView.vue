<script setup lang="ts">
import { computed, ref } from 'vue';

import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const message = ref('');
const error = ref('');
const loadingPlan = ref<'solo' | 'clinic' | ''>('');

const subscription = computed(() => auth.activeOrganization?.subscriptions?.[0] ?? null);

async function checkout(plan: 'solo' | 'clinic'): Promise<void> {
  const org = auth.activeOrganization;
  if (!org) return;
  loadingPlan.value = plan;
  message.value = '';
  error.value = '';
  try {
    const response = await api.checkout(org.id, plan);
    if (response.url) {
      window.location.href = response.url;
      return;
    }
    message.value = response.message ?? 'Demo billing mode is active.';
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to start checkout';
  } finally {
    loadingPlan.value = '';
  }
}
</script>

<template>
  <section class="page-header">
    <div>
      <h1>Billing</h1>
      <p>Stripe subscription scaffolding. Leave Stripe variables blank for demo mode.</p>
    </div>
  </section>

  <section class="grid">
    <article class="card">
      <h2>Current plan</h2>
      <p><strong>{{ subscription?.plan ?? 'demo' }}</strong></p>
      <p><span class="badge">{{ subscription?.status ?? 'DEMO' }}</span></p>
    </article>

    <article class="card">
      <h2>Solo</h2>
      <p class="muted">Single provider workspace, case history, PDF/export-ready data model.</p>
      <button class="primary-button" type="button" :disabled="loadingPlan !== ''" @click="checkout('solo')">
        {{ loadingPlan === 'solo' ? 'Starting…' : 'Start Solo checkout' }}
      </button>
    </article>

    <article class="card">
      <h2>Clinic</h2>
      <p class="muted">Team workspace, roles, audit logs, subscription-ready organization model.</p>
      <button class="primary-button" type="button" :disabled="loadingPlan !== ''" @click="checkout('clinic')">
        {{ loadingPlan === 'clinic' ? 'Starting…' : 'Start Clinic checkout' }}
      </button>
    </article>
  </section>

  <p v-if="message" class="card" style="margin-top: 18px">{{ message }}</p>
  <p v-if="error" class="error" style="margin-top: 18px">{{ error }}</p>
</template>
