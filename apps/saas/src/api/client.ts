const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:4000' : '/api');

export interface ApiOrganization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly subscriptions?: ReadonlyArray<{ readonly plan: string; readonly status: string }>;
}

export interface ApiMembership {
  readonly role: string;
  readonly organization: ApiOrganization;
}

export interface ApiUser {
  readonly id: string;
  readonly email: string;
  readonly displayName?: string | null | undefined;
  readonly memberships?: ReadonlyArray<ApiMembership>;
}

export interface ClinicalSnapshot {
  readonly clinicalEngineVersion?: string;
  readonly phase1Completeness?: {
    readonly done: number;
    readonly total: number;
    readonly percent: number;
    readonly complete: boolean;
    readonly missing: ReadonlyArray<{ readonly id: string; readonly label: string; readonly step: number }>;
  };
  readonly vitals?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

export interface CloudBpValue {
  readonly sbp: number | null;
  readonly dbp: number | null;
}

export interface SedationPatientCloudState {
  readonly name: string;
  readonly mrn: string;
  readonly provider: string;
  readonly assistants: string;
  readonly procedure: string;
  readonly careName: string;
  readonly carePhone: string;
  readonly careRelation: string;
  readonly weightLb: number | null;
  readonly heightIn: number | null;
  readonly age: number | null;
  readonly lastExamDate: string;
  readonly baselineBp: CloudBpValue;
  readonly baselineSpo2: number | null;
  readonly medsVerified: boolean;
  readonly osaStatus: string;
  readonly smokingStatus: string;
  readonly mallampati: string;
  readonly asaClass: string;
  readonly npoConfirmed: boolean;
  readonly consentObtained: boolean;
  readonly medicalProblems: string[];
  readonly diabetic: boolean;
  readonly baselineGlucose: number | null;
  readonly medicationsList: string;
  readonly allergiesList: string;
  readonly hospitalisations: string;
  readonly surgeries: string;
  readonly familyHistory: string;
  readonly anesthesiaHistory: string;
  readonly alcoholPerWeek: number | null;
  readonly recreationalDrugs: string;
  readonly cigarettesPerDay: number | null;
  readonly ekgPlaced: boolean;
  readonly emergencyDrugsAvailable: boolean;
  readonly monitoringEquipmentChecked: boolean;
}

export interface SedationAppCloudState {
  readonly schemaVersion: number;
  readonly savedAt: string;
  readonly patient: SedationPatientCloudState;
  readonly local: Record<string, unknown>;
  readonly iv: Record<string, unknown>;
  readonly recovery: Record<string, unknown>;
  readonly eventLog: Record<string, unknown>;
  readonly session: Record<string, unknown>;
  readonly [key: string]: unknown;
}

export interface SedationCase {
  readonly id: string;
  readonly status: string;
  readonly containsPhi: boolean;
  readonly patientDisplayName?: string | null | undefined;
  readonly patientExternalId?: string | null | undefined;
  readonly procedureDescription?: string | null | undefined;
  readonly providerName?: string | null | undefined;
  readonly caregiverName?: string | null | undefined;
  readonly caregiverPhone?: string | null | undefined;
  readonly assessmentJson?: Record<string, unknown> | undefined;
  readonly sedationAppJson?: SedationAppCloudState | Record<string, unknown> | undefined;
  readonly clinicalSnapshotJson: ClinicalSnapshot;
  readonly clinicalEngineVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuditLog {
  readonly id: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string | null | undefined;
  readonly createdAt: string;
  readonly actor?: { readonly email: string; readonly displayName?: string | null | undefined } | null | undefined;
  readonly metadataJson?: Record<string, unknown> | null | undefined;
}

export interface AssessmentPayload {
  readonly containsPhi: boolean;
  readonly patientName?: string | undefined;
  readonly patientId?: string | undefined;
  readonly procedureDescription?: string | undefined;
  readonly provider?: string | undefined;
  readonly careName?: string | undefined;
  readonly carePhone?: string | undefined;
  readonly weightLb?: number | undefined;
  readonly heightIn?: number | undefined;
  readonly age?: number | undefined;
  readonly lastExamDate?: string | undefined;
  readonly sbp?: number | undefined;
  readonly dbp?: number | undefined;
  readonly spo2?: number | undefined;
  readonly medsVerified?: boolean | undefined;
  readonly osaStatus?: string | undefined;
  readonly smokingStatus?: string | undefined;
  readonly mallampati?: string | undefined;
  readonly asaClass?: string | undefined;
  readonly npoConfirmed?: boolean | undefined;
  readonly consentObtained?: boolean | undefined;
  readonly ekgPlaced?: boolean | undefined;
  readonly emergencyDrugsAvailable?: boolean | undefined;
  readonly monitoringEquipmentChecked?: boolean | undefined;
  readonly diabetic?: boolean | undefined;
  readonly baselineGlucose?: number | undefined;
  readonly sedationAppJson?: SedationAppCloudState | undefined;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  // Do not send application/json on body-less requests. Fastify's JSON parser rejects
  // empty POST/DELETE requests when the content-type says a JSON body should exist.
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.error === 'string' ? body.error : `HTTP ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  devLogin(input: { email: string; displayName?: string; organizationName?: string }) {
    return requestJson<{ user: ApiUser; organization: ApiOrganization }>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  firebaseLogin(input: { idToken: string; organizationName?: string }) {
    return requestJson<{ user: ApiUser; organization: ApiOrganization }>('/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  logout() {
    return requestJson<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  },
  me() {
    return requestJson<{ user: ApiUser | null }>('/me');
  },
  cases(organizationId: string, options: { limit?: number; cursor?: string } = {}) {
    const query = new URLSearchParams();
    if (options.limit) query.set('limit', String(options.limit));
    if (options.cursor) query.set('cursor', options.cursor);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return requestJson<{ cases: SedationCase[]; nextCursor?: string | null }>(
      `/organizations/${organizationId}/cases${suffix}`,
    );
  },
  createCase(organizationId: string, payload: AssessmentPayload) {
    return requestJson<{ case: SedationCase }>(`/organizations/${organizationId}/cases`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, containsPhi: true }),
    });
  },
  updateCase(organizationId: string, caseId: string, payload: Partial<AssessmentPayload>) {
    return requestJson<{ case: SedationCase }>(`/organizations/${organizationId}/cases/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...payload, containsPhi: true }),
    });
  },
  caseDetail(organizationId: string, caseId: string) {
    return requestJson<{ case: SedationCase }>(`/organizations/${organizationId}/cases/${caseId}`);
  },
  deleteCase(organizationId: string, caseId: string) {
    return requestJson<{ ok: boolean }>(`/organizations/${organizationId}/cases/${caseId}`, { method: 'DELETE' });
  },
  auditLogs(organizationId: string, options: { limit?: number; cursor?: string } = {}) {
    const query = new URLSearchParams();
    if (options.limit) query.set('limit', String(options.limit));
    if (options.cursor) query.set('cursor', options.cursor);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return requestJson<{ logs: AuditLog[]; nextCursor?: string | null }>(
      `/organizations/${organizationId}/audit-logs${suffix}`,
    );
  },
  checkout(organizationId: string, plan: 'solo' | 'clinic') {
    return requestJson<{ mode: 'demo' | 'stripe'; url?: string; message?: string }>(
      `/organizations/${organizationId}/billing/checkout`,
      {
        method: 'POST',
        body: JSON.stringify({ plan }),
      },
    );
  },
};
