<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { api, type SedationCase } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const cases = ref<SedationCase[]>([]);
const loading = ref(false);
const error = ref('');

const completeCount = computed(
  () => cases.value.filter((item) => item.clinicalSnapshotJson.phase1Completeness?.complete).length,
);
const phiCount = computed(() => cases.value.filter((item) => item.containsPhi).length);

async function loadCases(): Promise<void> {
  const org = auth.activeOrganization;
  if (!org) return;
  loading.value = true;
  error.value = '';
  try {
    cases.value = (await api.cases(org.id)).cases;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to load cases';
  } finally {
    loading.value = false;
  }
}

onMounted(loadCases);
</script>

<template>
  <section class="page-header">
    <div>
      <h1>Clinic dashboard</h1>
      <p>
        Multi-tenant case workspace using the original Sedation Pro clinical engine for vitals and
        full SQL-backed case JSON, clinical snapshots, and audit trail.
      </p>
    </div>
    <RouterLink class="primary-button" to="/sedation">Open Sedation Pro</RouterLink>
  </section>

  <section class="grid" style="margin-bottom: 18px">
    <article class="card kpi">
      <span>Total cases</span>
      <strong>{{ cases.length }}</strong>
    </article>
    <article class="card kpi">
      <span>Phase 1 complete</span>
      <strong>{{ completeCount }}</strong>
    </article>
    <article class="card kpi">
      <span>Cases marked PHI</span>
      <strong>{{ phiCount }}</strong>
    </article>
  </section>

  <section class="card">
    <div class="page-header" style="margin-bottom: 12px">
      <div>
        <h2>Recent cases</h2>
        <p class="muted">Saved through the SaaS API and scoped to {{ auth.activeOrganization?.name }}.</p>
      </div>
      <button class="secondary-button" type="button" @click="loadCases">Refresh</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="loading" class="muted">Loading cases…</p>
    <p v-else-if="cases.length === 0" class="muted">No cases yet. Create the first case.</p>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>Procedure</th>
            <th>Readiness</th>
            <th>Status</th>
            <th>JSON</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in cases" :key="item.id">
            <td>
              <RouterLink :to="`/phase/1?caseId=${item.id}`">
                {{ item.patientDisplayName || item.patientExternalId || `Case ${item.id.slice(0, 8)}` }}
              </RouterLink>
              <div class="muted">Engine {{ item.clinicalEngineVersion }}</div>
            </td>
            <td>{{ item.procedureDescription || '—' }}</td>
            <td>
              <span
                class="badge"
                :class="{ warn: !item.clinicalSnapshotJson.phase1Completeness?.complete }"
              >
                {{ item.clinicalSnapshotJson.phase1Completeness?.percent ?? 0 }}%
              </span>
            </td>
            <td><span class="badge">{{ item.status }}</span></td>
            <td>
              <RouterLink class="plain-link" :to="`/cases/${item.id}`">View JSON</RouterLink>
            </td>
            <td>{{ new Date(item.updatedAt).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
