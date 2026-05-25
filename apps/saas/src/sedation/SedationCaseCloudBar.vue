<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { CLINICAL_LIB_VERSION } from '@sedation-pro/clinical';

import { api, type SedationCase } from '../api/client';
import { useAuthStore } from '../stores/auth';

import {
  clearSedationAppState,
  collectSedationAppState,
  hasClinicalContent,
  hydrateSedationAppState,
  patientAssessmentPayload,
} from './cloudState';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const cases = ref<SedationCase[]>([]);
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const error = ref('');
const message = ref('');
const selectedCaseId = ref('');
const hydratedFromCloud = ref(false);
let autosaveTimer: number | undefined;
let lastSavedPayload = '';

const activeOrganization = computed(() => auth.activeOrganization);
const currentCase = computed(() => cases.value.find((item) => item.id === selectedCaseId.value) ?? null);
const handleNewCloudCaseRequested = () => {
  void startNewCloudCase();
};
const statusText = computed(() => {
  if (saving.value) return 'saving to SQL…';
  if (!selectedCaseId.value) return 'select or create a cloud case';
  return 'cloud SQL auto-save on';
});

function serializedCurrentState(): string {
  return JSON.stringify(patientAssessmentPayload(collectSedationAppState()));
}

async function syncRouteCaseId(caseId: string): Promise<void> {
  const query = { ...route.query };
  if (caseId) query.caseId = caseId;
  else delete query.caseId;
  await router.replace({ path: route.path, query });
}

async function refreshCases(): Promise<void> {
  const org = activeOrganization.value;
  if (!org) return;
  loading.value = true;
  error.value = '';
  try {
    cases.value = (await api.cases(org.id)).cases;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to load practice cases';
  } finally {
    loading.value = false;
  }
}

async function saveCloudCase(options: { silent?: boolean; forceCreate?: boolean } = {}): Promise<void> {
  const org = activeOrganization.value;
  if (!org) return;

  const state = collectSedationAppState();
  const payload = patientAssessmentPayload(state);
  const serialized = JSON.stringify(payload);

  // No local-only case writes. If there is no current cloud case, do not create
  // one from an autosave. A cloud case is created only through New cloud case.
  if (!options.forceCreate && !selectedCaseId.value) {
    if (hasClinicalContent(state) && !options.silent) {
      error.value = 'Create or select a cloud case before documenting sedation data.';
    }
    return;
  }
  if (!options.forceCreate && serialized === lastSavedPayload) return;

  saving.value = true;
  error.value = '';
  if (!options.silent) message.value = '';
  try {
    const saved = selectedCaseId.value
      ? (await api.updateCase(org.id, selectedCaseId.value, payload)).case
      : (await api.createCase(org.id, payload)).case;
    selectedCaseId.value = saved.id;
    lastSavedPayload = serialized;
    await syncRouteCaseId(saved.id);
    if (!options.silent) message.value = `Saved cloud case ${saved.id.slice(0, 8)}`;
    await refreshCases();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to save cloud case';
  } finally {
    saving.value = false;
  }
}

function scheduleAutosave(): void {
  if (hydratedFromCloud.value) return;
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    void saveCloudCase({ silent: true });
  }, 900);
}

async function openCloudCase(caseId = selectedCaseId.value): Promise<void> {
  const org = activeOrganization.value;
  if (!org || !caseId) return;
  error.value = '';
  message.value = '';
  try {
    const record = (await api.caseDetail(org.id, caseId)).case;
    hydratedFromCloud.value = true;
    hydrateSedationAppState(record.sedationAppJson ?? { patient: record.assessmentJson ?? {} });
    selectedCaseId.value = record.id;
    lastSavedPayload = serializedCurrentState();
    await syncRouteCaseId(record.id);
    message.value = `Loaded ${record.patientDisplayName || record.patientExternalId || 'cloud case'}`;
    await router.push({ path: '/phase/1', query: { caseId: record.id } });
    window.setTimeout(() => {
      hydratedFromCloud.value = false;
    }, 0);
  } catch (caught) {
    hydratedFromCloud.value = false;
    error.value = caught instanceof Error ? caught.message : 'Unable to open cloud case';
  }
}

async function reviewCloudCase(): Promise<void> {
  if (!selectedCaseId.value) return;
  await saveCloudCase({ silent: true });
  await router.push(`/cases/${selectedCaseId.value}`);
}

async function startNewCloudCase(): Promise<void> {
  clearSedationAppState();
  selectedCaseId.value = '';
  lastSavedPayload = '';
  message.value = '';
  await router.push('/phase/1');
  await saveCloudCase({ forceCreate: true });
  message.value = 'New cloud case created. All changes save to SQL.';
}

async function deleteSelectedCase(): Promise<void> {
  const org = activeOrganization.value;
  const caseId = selectedCaseId.value;
  if (!org || !caseId) return;
  const label = currentCase.value?.patientDisplayName || currentCase.value?.patientExternalId || `Case ${caseId.slice(0, 8)}`;
  if (!window.confirm(`Delete ${label}? This removes the cloud case from SQL.`)) return;
  deleting.value = true;
  error.value = '';
  message.value = '';
  try {
    await api.deleteCase(org.id, caseId);
    clearSedationAppState();
    selectedCaseId.value = '';
    lastSavedPayload = '';
    await syncRouteCaseId('');
    await refreshCases();
    message.value = 'Cloud case deleted.';
    await router.push('/phase/1');
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to delete cloud case';
  } finally {
    deleting.value = false;
  }
}

watch(
  () => serializedCurrentState(),
  () => scheduleAutosave(),
);

onMounted(async () => {
  await refreshCases();
  const routeCaseId = typeof route.query.caseId === 'string' ? route.query.caseId : '';
  if (routeCaseId) {
    selectedCaseId.value = routeCaseId;
    await openCloudCase(routeCaseId);
  }
  window.addEventListener('sedation-pro:new-cloud-case-requested', handleNewCloudCaseRequested);
});

onBeforeUnmount(() => {
  window.clearTimeout(autosaveTimer);
  window.removeEventListener('sedation-pro:new-cloud-case-requested', handleNewCloudCaseRequested);
  void saveCloudCase({ silent: true });
});
</script>

<template>
  <section class="sedation-cloud-bar no-print">
    <div class="sedation-cloud-bar__main">
      <div class="sedation-cloud-bar__identity">
        <RouterLink class="cloud-button cloud-button--back" to="/">← Back to dashboard</RouterLink>
        <div>
          <strong>{{ activeOrganization?.name ?? 'Practice' }} · Sedation Pro</strong>
          <span>
            Clinical engine {{ CLINICAL_LIB_VERSION }} · {{ statusText }}
          </span>
        </div>
      </div>
      <span class="sedation-cloud-bar__phi">Patient identifiers and full sedation case JSON saved to SQL</span>
    </div>

    <div class="sedation-cloud-bar__controls">
      <select v-model="selectedCaseId" :disabled="loading || cases.length === 0">
        <option value="">Select saved cloud case…</option>
        <option v-for="item in cases" :key="item.id" :value="item.id">
          {{ item.patientDisplayName || item.patientExternalId || `Case ${item.id.slice(0, 8)}` }} ·
          {{ item.procedureDescription || 'No procedure' }} ·
          {{ new Date(item.updatedAt).toLocaleDateString() }}
        </option>
      </select>
      <button class="cloud-button" type="button" :disabled="loading" @click="refreshCases">
        {{ loading ? 'Loading…' : 'Refresh' }}
      </button>
      <button class="cloud-button" type="button" :disabled="!selectedCaseId" @click="openCloudCase()">
        Open/edit case
      </button>
      <button class="cloud-button" type="button" :disabled="!selectedCaseId" @click="reviewCloudCase">
        Review JSON
      </button>
      <button class="cloud-button" type="button" @click="startNewCloudCase">New cloud case</button>
      <button class="cloud-button cloud-button--danger" type="button" :disabled="!selectedCaseId || deleting" @click="deleteSelectedCase">
        {{ deleting ? 'Deleting…' : 'Delete case' }}
      </button>
      <button class="cloud-button cloud-button--primary" type="button" :disabled="saving || !selectedCaseId" @click="saveCloudCase()">
        {{ saving ? 'Saving…' : 'Save now' }}
      </button>
    </div>

    <p v-if="error" class="sedation-cloud-bar__error">{{ error }}</p>
    <p v-else-if="message" class="sedation-cloud-bar__message">{{ message }}</p>
    <p v-else-if="!selectedCaseId" class="sedation-cloud-bar__message">
      Select an existing case or create a new cloud case. Local-only saves are disabled in SaaS mode.
    </p>
  </section>
</template>
