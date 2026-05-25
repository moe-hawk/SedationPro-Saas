import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router';

import { usePatientStore } from '@/stores/patient';
import { useSessionStore, type Phase } from '@/stores/session';
import { useToastStore } from '@/stores/toast';

import { useAuthStore } from '../stores/auth';
import AuditLogsView from '../views/AuditLogsView.vue';
import BillingView from '../views/BillingView.vue';
import CaseDetailView from '../views/CaseDetailView.vue';
import DashboardView from '../views/DashboardView.vue';
import LoginView from '../views/LoginView.vue';
import NewCaseView from '../views/NewCaseView.vue';

const PHASE_ROUTES: Record<string, Phase> = {
  '/phase/1': 'phase1',
  '/phase/2': 'phase2',
  '/phase/3': 'phase3',
  '/phase/4': 'phase4',
  '/quick-reference': 'quickref',
};

const GATED_PHASES: ReadonlySet<Phase> = new Set(['phase2', 'phase3', 'phase4']);

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/cases/new', name: 'new-case', component: NewCaseView },
    { path: '/cases/:caseId', name: 'case-detail', component: CaseDetailView },
    { path: '/audit-logs', name: 'audit-logs', component: AuditLogsView },
    { path: '/billing', name: 'billing', component: BillingView },

    // Real Sedation Pro physician interface, embedded into the SaaS app.
    // These route paths intentionally match the original mobile app so its
    // existing navigation, phase gates, sticky bar, dock, and persistence keep
    // working without a fork.
    { path: '/sedation', redirect: '/phase/1' },
    {
      path: '/phase/1',
      name: 'phase1',
      component: () => import('@/views/Phase1View.vue'),
      meta: { sedation: true },
    },
    {
      path: '/phase/2',
      name: 'phase2',
      component: () => import('@/views/Phase2View.vue'),
      meta: { sedation: true },
    },
    {
      path: '/phase/3',
      name: 'phase3',
      component: () => import('@/views/Phase3View.vue'),
      meta: { sedation: true },
    },
    {
      path: '/phase/4',
      name: 'phase4',
      component: () => import('@/views/Phase4View.vue'),
      meta: { sedation: true },
    },
    {
      path: '/quick-reference',
      name: 'quickref',
      component: () => import('@/views/QuickReferenceView.vue'),
      meta: { sedation: true },
    },
    {
      path: '/quick-reference/:id',
      name: 'quickref-detail',
      component: () => import('@/views/QuickReferenceDetailView.vue'),
      props: true,
      meta: { sedation: true },
    },
    {
      path: '/clinical-note',
      name: 'clinical-note',
      component: () => import('@/views/ClinicalNoteView.vue'),
      meta: { sedation: true },
    },
    {
      path: '/ui-demo',
      name: 'ui-demo',
      component: () => import('@/views/UiDemoView.vue'),
      meta: { sedation: true },
    },

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

let initialRefreshDone = false;

router.beforeEach(async (to: RouteLocationNormalized) => {
  const auth = useAuthStore();
  if (!initialRefreshDone) {
    initialRefreshDone = true;
    await auth.refresh();
  }
  if (!to.meta.public && !auth.isAuthenticated) return { name: 'login' };
  if (to.name === 'login' && auth.isAuthenticated) return { name: 'dashboard' };

  if (to.meta.sedation) {
    const patient = usePatientStore();
    const targetPhase = PHASE_ROUTES[to.path];
    if (targetPhase && GATED_PHASES.has(targetPhase) && !patient.isPhase1Complete) {
      patient.markValidationAttempted();
      const toast = useToastStore();
      const missing = patient.completeness.missing;
      const missingLabels =
        missing.length === 0
          ? ''
          : missing
              .slice(0, 3)
              .map((m) => m.label)
              .join(', ') + (missing.length > 3 ? `, +${missing.length - 3} more` : '');
      toast.show(
        {
          id: `gate-${Date.now()}`,
          label: 'Complete Phase 1 first',
          sub: missingLabels || 'Fill required fields to unlock',
          tone: 'caution',
        },
        6000,
      );
      return { path: '/phase/1' };
    }
  }

  return true;
});

function resolvePhase(path: string): Phase | undefined {
  if (PHASE_ROUTES[path]) return PHASE_ROUTES[path];
  if (path.startsWith('/quick-reference')) return 'quickref';
  return undefined;
}

router.afterEach((to: RouteLocationNormalized) => {
  if (!to.meta.sedation) return;
  const session = useSessionStore();
  const phase = resolvePhase(to.path);
  if (phase) {
    session.setPhase(phase);
  }
});
