<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterView, useRoute } from 'vue-router';

import AppFooter from '@/components/AppFooter.vue';
import NavDrawer from '@/components/NavDrawer.vue';
import SedationDock from '@/components/SedationDock.vue';
import StickyBar from '@/components/StickyBar.vue';
import UndoToast from '@/components/UndoToast.vue';
import { useAlarms, unlockAudio } from '@/composables/useAlarms';
import { useCaseReset } from '@/composables/useCaseReset';
import { useDockVisibility } from '@/composables/useDockVisibility';
import { useWakeLock } from '@/composables/useWakeLock';
import { useEventLogStore } from '@/stores/event-log';
import { isStaleSession, readPersistedSavedAt } from '@/stores/persistence';
import { usePatientStore } from '@/stores/patient';
import { UiModal } from '@sedation-pro/ui';

import SedationCaseCloudBar from './SedationCaseCloudBar.vue';

const route = useRoute();
const showSedationDock = computed(() => route.path === '/phase/3');

const patient = usePatientStore();
const eventLog = useEventLogStore();
const { reset: resetCase } = useCaseReset();

const resumeGateOpen = ref(false);
const resumeSavedDate = ref('');

function sessionHasContent(): boolean {
  return patient.name.trim() !== '' || patient.mrn.trim() !== '' || eventLog.count > 0;
}

const resumePatientLine = computed(() => {
  const name = patient.name.trim() || '—';
  const mrn = patient.mrn.trim() || '—';
  return `${name}  ·  MRN ${mrn}`;
});
const resumeProcedure = computed(() => patient.procedure.trim() || '—');
const resumeProvider = computed(() => patient.provider.trim() || '—');

function resumeSession(): void {
  resumeGateOpen.value = false;
}
function discardSession(): void {
  resumeGateOpen.value = false;
  resetCase();
}

onMounted(() => {
  const savedAt = readPersistedSavedAt();
  if (savedAt === null || !sessionHasContent()) return;
  if (!isStaleSession(savedAt, Date.now())) return;
  resumeSavedDate.value = new Date(savedAt).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  resumeGateOpen.value = true;
});

const { dockOnScreen } = useDockVisibility();
const dockReservesSpace = computed(() => showSedationDock.value && dockOnScreen.value);

const wakeLock = useWakeLock();
void wakeLock.request();

useAlarms();
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => unlockAudio(), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlockAudio();
  });
}
</script>

<template>
  <SedationCaseCloudBar />
  <StickyBar class="no-print" />
  <NavDrawer />
  <UndoToast />
  <div class="app-shell sedation-app-shell" :class="{ 'has-dock': dockReservesSpace }">
    <RouterView v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </RouterView>
    <AppFooter class="no-print" />
  </div>
  <SedationDock v-if="showSedationDock" class="no-print" />

  <UiModal
    :open="resumeGateOpen"
    title="Previous session found"
    tone="primary"
    confirm-label="Resume patient"
    cancel-label="Start new case"
    :dismiss-on-backdrop="false"
    @confirm="resumeSession"
    @cancel="discardSession"
  >
    A chart from <strong>{{ resumeSavedDate }}</strong> is still loaded. Is this the
    <strong>same patient</strong>?
    <ul class="resume-gate-list">
      <li>
        <strong>{{ resumePatientLine }}</strong>
      </li>
      <li>{{ resumeProcedure }}</li>
      <li>{{ resumeProvider }}</li>
    </ul>
    Choosing <strong>Start new case</strong> permanently clears the loaded chart.
  </UiModal>
</template>

<style scoped>
.resume-gate-list {
  margin: var(--sp-3) 0;
  padding-left: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: 4px;
  list-style: none;
}
.resume-gate-list li {
  font-size: var(--type-footnote);
  color: var(--color-text-secondary);
}

.page-enter-active,
.page-leave-active {
  transition:
    opacity var(--dur-250) var(--ease-decel),
    transform var(--dur-250) var(--ease-decel);
  will-change: opacity, transform;
}
.page-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.page-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: opacity var(--dur-150) linear;
  }
  .page-enter-from,
  .page-leave-to {
    transform: none;
  }
}

.sedation-app-shell {
  transition: padding-bottom var(--dur-250) var(--ease-standard);
}
.sedation-app-shell.has-dock {
  padding-bottom: calc(250px + env(safe-area-inset-bottom));
}
</style>
