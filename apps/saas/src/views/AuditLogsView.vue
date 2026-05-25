<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { api, type AuditLog } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const logs = ref<AuditLog[]>([]);
const loading = ref(false);
const error = ref('');

async function loadLogs(): Promise<void> {
  const org = auth.activeOrganization;
  if (!org) return;
  loading.value = true;
  error.value = '';
  try {
    logs.value = (await api.auditLogs(org.id)).logs;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to load audit logs';
  } finally {
    loading.value = false;
  }
}

onMounted(loadLogs);
</script>

<template>
  <section class="page-header">
    <div>
      <h1>Audit logs</h1>
      <p>HIPAA-oriented activity trail for case access, creation, edits, locks, and billing events.</p>
    </div>
    <button class="secondary-button" type="button" @click="loadLogs">Refresh</button>
  </section>

  <section class="card">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="loading" class="muted">Loading audit logs…</p>
    <p v-else-if="logs.length === 0" class="muted">No audit entries yet.</p>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Resource</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td>{{ new Date(log.createdAt).toLocaleString() }}</td>
            <td>{{ log.actor?.displayName || log.actor?.email || 'System' }}</td>
            <td><span class="badge">{{ log.action }}</span></td>
            <td>{{ log.resourceType }} <span class="muted">{{ log.resourceId || '' }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
