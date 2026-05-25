<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { api, type SedationCase } from '../api/client';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const record = ref<SedationCase | null>(null);
const loading = ref(false);
const deleting = ref(false);
const error = ref('');

async function loadCase(): Promise<void> {
  const org = auth.activeOrganization;
  const caseId = String(route.params.caseId ?? '');
  if (!org || !caseId) return;
  loading.value = true;
  error.value = '';
  try {
    record.value = (await api.caseDetail(org.id, caseId)).case;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to load case';
  } finally {
    loading.value = false;
  }
}

async function deleteCase(): Promise<void> {
  const org = auth.activeOrganization;
  const caseId = String(route.params.caseId ?? '');
  if (!org || !caseId || !record.value) return;
  const label = record.value.patientDisplayName || record.value.patientExternalId || `Case ${caseId.slice(0, 8)}`;
  if (!window.confirm(`Delete ${label}? This removes the cloud case from SQL.`)) return;
  deleting.value = true;
  error.value = '';
  try {
    await api.deleteCase(org.id, caseId);
    await router.push('/');
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to delete case';
  } finally {
    deleting.value = false;
  }
}

onMounted(loadCase);
</script>

<template>
  <section class="page-header">
    <div>
      <h1>Case detail</h1>
      <p>Full SQL-backed Sedation Pro record with patient identifiers, all phase JSON, clinical snapshot, and audit-log read tracking.</p>
    </div>
    <div class="button-row" v-if="record">
      <RouterLink class="secondary-button" :to="`/phase/1?caseId=${record.id}`">Open/edit in Sedation Pro</RouterLink>
      <button class="danger-button" type="button" :disabled="deleting" @click="deleteCase">
        {{ deleting ? 'Deleting…' : 'Delete case' }}
      </button>
    </div>
  </section>

  <p v-if="error" class="error">{{ error }}</p>
  <p v-else-if="loading" class="muted">Loading case…</p>

  <section v-else-if="record" class="two-column">
    <article class="card">
      <h2>{{ record.patientDisplayName || record.patientExternalId || `Case ${record.id.slice(0, 8)}` }}</h2>
      <p><strong>Procedure:</strong> {{ record.procedureDescription || '—' }}</p>
      <p><strong>Provider:</strong> {{ record.providerName || '—' }}</p>
      <p><strong>Status:</strong> <span class="badge">{{ record.status }}</span></p>
      <p>
        <strong>PHI storage:</strong>
        <span class="badge warn">Identifiers stored</span>
      </p>
      <p><strong>Clinical engine:</strong> {{ record.clinicalEngineVersion }}</p>
      <p><strong>Created:</strong> {{ new Date(record.createdAt).toLocaleString() }}</p>
      <p><strong>Updated:</strong> {{ new Date(record.updatedAt).toLocaleString() }}</p>
    </article>

    <aside class="card">
      <h2>Phase 1 readiness</h2>
      <div class="kpi">
        <span>Readiness</span>
        <strong>{{ record.clinicalSnapshotJson.phase1Completeness?.percent ?? 0 }}%</strong>
        <div class="progress-track">
          <div
            class="progress-bar"
            :style="{ width: `${record.clinicalSnapshotJson.phase1Completeness?.percent ?? 0}%` }"
          ></div>
        </div>
      </div>
      <p>
        <span class="badge" :class="{ warn: !record.clinicalSnapshotJson.phase1Completeness?.complete }">
          {{ record.clinicalSnapshotJson.phase1Completeness?.complete ? 'Complete' : 'Incomplete' }}
        </span>
      </p>
      <ul v-if="record.clinicalSnapshotJson.phase1Completeness?.missing.length">
        <li v-for="field in record.clinicalSnapshotJson.phase1Completeness.missing" :key="field.id">
          Step {{ field.step }} — {{ field.label }}
        </li>
      </ul>
    </aside>

    <article class="card" style="grid-column: 1 / -1">
      <h2>Full Sedation Pro case JSON</h2>
      <p class="muted">This is the cloud source of truth for all phases: assessment, local anesthetic, IV sedation, recovery/discharge, event log, and current phase.</p>
      <pre>{{ JSON.stringify(record.sedationAppJson, null, 2) }}</pre>
    </article>

    <article class="card" style="grid-column: 1 / -1">
      <h2>Clinical snapshot JSON</h2>
      <pre>{{ JSON.stringify(record.clinicalSnapshotJson, null, 2) }}</pre>
    </article>
  </section>
</template>
