import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import rawBody from 'fastify-raw-body';
import Stripe from 'stripe';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';

import { CLINICAL_LIB_VERSION, DEFAULT_FORMULARY } from '@sedation-pro/clinical';

import { Prisma } from '@sedation-pro/db';

import { writeAudit } from './audit.js';
import { buildClinicalSnapshot, type AssessmentInput } from './clinical-snapshot.js';
import { db } from './db.js';
import { env, isProduction } from './env.js';

interface JwtUser {
  readonly userId: string;
  readonly email: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

type MembershipRole = 'OWNER' | 'ADMIN' | 'PROVIDER' | 'STAFF' | 'READ_ONLY';
type AssessmentPrimitive = string | number | boolean | null;
type AssessmentDbPayload = Record<string, AssessmentPrimitive | AssessmentPrimitive[]>;
type JsonRecord = Record<string, unknown>;

const app = Fastify({ logger: true });
const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

function firebaseAuth(): ReturnType<typeof getAuth> | null {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) return null;
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getAuth();
}

const firebase = firebaseAuth();

await app.register(cors, {
  origin: env.SAAS_WEB_ORIGIN,
  credentials: true,
});
await app.register(cookie);
await app.register(rateLimit, {
  max: 300,
  timeWindow: '1 minute',
});
await app.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: false,
  runFirst: true,
  routes: ['/webhooks/stripe'],
});
await app.register(jwt, {
  secret: env.JWT_SECRET,
  cookie: {
    cookieName: 'sedation_pro_session',
    signed: false,
  },
  sign: {
    expiresIn: env.JWT_EXPIRES_IN,
  },
});

const PHI_ASSESSMENT_KEYS = new Set(['patientName', 'patientId', 'careName', 'carePhone']);
const PHI_SEDATION_PATIENT_KEYS = new Set(['name', 'mrn', 'careName', 'carePhone']);

function slugify(value: string, fallbackSeed = 'clinic'): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const fallback = fallbackSeed
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback || 'clinic';
}

function makeSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie('sedation_pro_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 8 * 60 * 60,
  });
}

function sanitizeAssessmentPayload(
  input: Partial<AssessmentInput> & { containsPhi?: boolean },
  containsPhi: boolean,
): AssessmentDbPayload {
  const payload: AssessmentDbPayload = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (!containsPhi && PHI_ASSESSMENT_KEYS.has(key)) continue;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      payload[key] = value;
    }
  }
  payload.containsPhi = containsPhi;
  return payload;
}


function objectRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function toInputJsonObject(payload: AssessmentDbPayload): Prisma.InputJsonObject {
  return payload;
}

function toPrismaJsonObject(value: unknown): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonObject;
}

function scrubPhiFromSedationAppJson(value: unknown, containsPhi: boolean): JsonRecord {
  const cloned = JSON.parse(JSON.stringify(value ?? {})) as JsonRecord;
  if (containsPhi) return cloned;
  const patient = cloned.patient;
  if (patient && typeof patient === 'object' && !Array.isArray(patient)) {
    for (const key of PHI_SEDATION_PATIENT_KEYS) {
      delete (patient as JsonRecord)[key];
    }
  }
  return cloned;
}

function putAssessmentField(
  target: Partial<AssessmentInput>,
  key: keyof AssessmentInput,
  value: unknown,
  expected: 'string' | 'number' | 'boolean',
): void {
  if (value === undefined || value === null) return;
  if (expected === 'string' && typeof value === 'string') target[key] = value as never;
  if (expected === 'number' && typeof value === 'number') target[key] = value as never;
  if (expected === 'boolean' && typeof value === 'boolean') target[key] = value as never;
}

function assessmentFromSedationAppJson(value: unknown): Partial<AssessmentInput> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const patient = (value as JsonRecord).patient;
  if (!patient || typeof patient !== 'object' || Array.isArray(patient)) return {};
  const p = patient as JsonRecord;
  const baselineBp = p.baselineBp && typeof p.baselineBp === 'object' ? (p.baselineBp as JsonRecord) : {};
  const output: Partial<AssessmentInput> = {};

  putAssessmentField(output, 'patientName', p.name, 'string');
  putAssessmentField(output, 'patientId', p.mrn, 'string');
  putAssessmentField(output, 'provider', p.provider, 'string');
  putAssessmentField(output, 'careName', p.careName, 'string');
  putAssessmentField(output, 'carePhone', p.carePhone, 'string');
  putAssessmentField(output, 'procedureDescription', p.procedure, 'string');
  putAssessmentField(output, 'weightLb', p.weightLb, 'number');
  putAssessmentField(output, 'heightIn', p.heightIn, 'number');
  putAssessmentField(output, 'age', p.age, 'number');
  putAssessmentField(output, 'lastExamDate', p.lastExamDate, 'string');
  putAssessmentField(output, 'sbp', baselineBp.sbp, 'number');
  putAssessmentField(output, 'dbp', baselineBp.dbp, 'number');
  putAssessmentField(output, 'spo2', p.baselineSpo2, 'number');
  putAssessmentField(output, 'medsVerified', p.medsVerified, 'boolean');
  putAssessmentField(output, 'osaStatus', p.osaStatus, 'string');
  putAssessmentField(output, 'smokingStatus', p.smokingStatus, 'string');
  putAssessmentField(output, 'mallampati', p.mallampati, 'string');
  putAssessmentField(output, 'asaClass', p.asaClass, 'string');
  putAssessmentField(output, 'npoConfirmed', p.npoConfirmed, 'boolean');
  putAssessmentField(output, 'consentObtained', p.consentObtained, 'boolean');
  putAssessmentField(output, 'ekgPlaced', p.ekgPlaced, 'boolean');
  putAssessmentField(output, 'emergencyDrugsAvailable', p.emergencyDrugsAvailable, 'boolean');
  putAssessmentField(output, 'monitoringEquipmentChecked', p.monitoringEquipmentChecked, 'boolean');
  putAssessmentField(output, 'diabetic', p.diabetic, 'boolean');
  putAssessmentField(output, 'baselineGlucose', p.baselineGlucose, 'number');

  return output;
}

function setIfPresent(target: Record<string, unknown>, record: JsonRecord, key: string): void {
  if (Object.prototype.hasOwnProperty.call(record, key)) target[key] = record[key];
}

function assessmentFieldsFromFlatJson(value: unknown): Partial<AssessmentInput> {
  const record = objectRecord(value);
  const fields: Record<string, unknown> = {};
  for (const key of [
    'patientName',
    'patientId',
    'provider',
    'careName',
    'carePhone',
    'procedureDescription',
    'weightLb',
    'heightIn',
    'age',
    'lastExamDate',
    'sbp',
    'dbp',
    'spo2',
    'medsVerified',
    'osaStatus',
    'smokingStatus',
    'mallampati',
    'asaClass',
    'npoConfirmed',
    'consentObtained',
    'ekgPlaced',
    'emergencyDrugsAvailable',
    'monitoringEquipmentChecked',
    'diabetic',
    'baselineGlucose',
  ]) {
    setIfPresent(fields, record, key);
  }

  const output: Partial<AssessmentInput> = {};
  putAssessmentField(output, 'patientName', fields.patientName, 'string');
  putAssessmentField(output, 'patientId', fields.patientId, 'string');
  putAssessmentField(output, 'provider', fields.provider, 'string');
  putAssessmentField(output, 'careName', fields.careName, 'string');
  putAssessmentField(output, 'carePhone', fields.carePhone, 'string');
  putAssessmentField(output, 'procedureDescription', fields.procedureDescription, 'string');
  putAssessmentField(output, 'weightLb', fields.weightLb, 'number');
  putAssessmentField(output, 'heightIn', fields.heightIn, 'number');
  putAssessmentField(output, 'age', fields.age, 'number');
  putAssessmentField(output, 'lastExamDate', fields.lastExamDate, 'string');
  putAssessmentField(output, 'sbp', fields.sbp, 'number');
  putAssessmentField(output, 'dbp', fields.dbp, 'number');
  putAssessmentField(output, 'spo2', fields.spo2, 'number');
  putAssessmentField(output, 'medsVerified', fields.medsVerified, 'boolean');
  putAssessmentField(output, 'osaStatus', fields.osaStatus, 'string');
  putAssessmentField(output, 'smokingStatus', fields.smokingStatus, 'string');
  putAssessmentField(output, 'mallampati', fields.mallampati, 'string');
  putAssessmentField(output, 'asaClass', fields.asaClass, 'string');
  putAssessmentField(output, 'npoConfirmed', fields.npoConfirmed, 'boolean');
  putAssessmentField(output, 'consentObtained', fields.consentObtained, 'boolean');
  putAssessmentField(output, 'ekgPlaced', fields.ekgPlaced, 'boolean');
  putAssessmentField(output, 'emergencyDrugsAvailable', fields.emergencyDrugsAvailable, 'boolean');
  putAssessmentField(output, 'monitoringEquipmentChecked', fields.monitoringEquipmentChecked, 'boolean');
  putAssessmentField(output, 'diabetic', fields.diabetic, 'boolean');
  putAssessmentField(output, 'baselineGlucose', fields.baselineGlucose, 'number');
  return output;
}

function hasObjectKeys(value: unknown): boolean {
  return Object.keys(objectRecord(value)).length > 0;
}

function buildClinicalInputForWrite(args: {
  existingAssessmentJson?: unknown;
  effectiveSedationAppJson: unknown;
  input: unknown;
}): Partial<AssessmentInput> {
  // Precedence is intentional and single-directional:
  // 1. Existing assessment keeps old flat fields when a PATCH omits them.
  // 2. Sedation Pro JSON is the authoritative chart state when present.
  // 3. Explicit request fields override both for API/back-office edits.
  return {
    ...assessmentFieldsFromFlatJson(args.existingAssessmentJson),
    ...assessmentFromSedationAppJson(args.effectiveSedationAppJson),
    ...assessmentFieldsFromFlatJson(args.input),
  };
}

function requireAnyRole(role: MembershipRole, allowedRoles: readonly MembershipRole[]): boolean {
  return allowedRoles.includes(role);
}

async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<JwtUser | null> {
  try {
    await request.jwtVerify();
    return request.user;
  } catch {
    await reply.code(401).send({ error: 'unauthorized' });
    return null;
  }
}

async function requireMembership(
  request: FastifyRequest,
  reply: FastifyReply,
  organizationId: string,
  allowedRoles?: readonly MembershipRole[],
): Promise<{ user: JwtUser; role: MembershipRole } | null> {
  const user = await requireUser(request, reply);
  if (!user) return null;
  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.userId,
        organizationId,
      },
    },
  });
  if (!membership) {
    await reply.code(403).send({ error: 'forbidden' });
    return null;
  }
  const role = membership.role as MembershipRole;
  if (allowedRoles && !requireAnyRole(role, allowedRoles)) {
    await reply.code(403).send({ error: 'forbidden_role', role, allowedRoles });
    return null;
  }
  return { user, role };
}

async function defaultFormularyProfileId(organizationId: string): Promise<string | null> {
  const profile = await db.formularyProfile.findFirst({
    where: { organizationId, isDefault: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return profile?.id ?? null;
}

const devLoginSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).optional(),
  organizationName: z.string().min(1).optional(),
});

const firebaseLoginSchema = z.object({
  idToken: z.string().min(10),
  organizationName: z.string().min(1).optional(),
});


async function upsertFirebaseUser(input: {
  readonly firebaseUid: string;
  readonly email: string;
  readonly displayName: string;
}) {
  const userByFirebaseUid = await db.user.findUnique({ where: { firebaseUid: input.firebaseUid } });
  if (userByFirebaseUid) {
    return db.user.update({
      where: { id: userByFirebaseUid.id },
      data: {
        email: input.email,
        displayName: input.displayName,
      },
    });
  }

  const userByEmail = await db.user.findUnique({ where: { email: input.email } });
  if (userByEmail) {
    return db.user.update({
      where: { id: userByEmail.id },
      data: {
        firebaseUid: input.firebaseUid,
        displayName: input.displayName,
      },
    });
  }

  return db.user.create({
    data: {
      email: input.email,
      firebaseUid: input.firebaseUid,
      displayName: input.displayName,
    },
  });
}

const caseSchema = z.object({
  containsPhi: z.boolean().default(false),
  patientName: z.string().optional().default(''),
  patientId: z.string().optional().default(''),
  procedureDescription: z.string().optional().default(''),
  provider: z.string().optional().default(''),
  careName: z.string().optional().default(''),
  carePhone: z.string().optional().default(''),
  weightLb: z.coerce.number().positive().optional(),
  heightIn: z.coerce.number().positive().optional(),
  age: z.coerce.number().int().nonnegative().optional(),
  lastExamDate: z.string().optional().default(''),
  sbp: z.coerce.number().positive().optional(),
  dbp: z.coerce.number().positive().optional(),
  spo2: z.coerce.number().min(1).max(100).optional(),
  medsVerified: z.boolean().default(false),
  osaStatus: z.string().optional().default(''),
  smokingStatus: z.string().optional().default(''),
  mallampati: z.string().optional().default(''),
  asaClass: z.string().optional().default(''),
  npoConfirmed: z.boolean().default(false),
  consentObtained: z.boolean().default(false),
  ekgPlaced: z.boolean().default(false),
  emergencyDrugsAvailable: z.boolean().default(false),
  monitoringEquipmentChecked: z.boolean().default(false),
  diabetic: z.boolean().default(false),
  baselineGlucose: z.coerce.number().positive().optional(),
  sedationAppJson: z.record(z.string(), z.unknown()).optional().default({}),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

app.get('/health', async () => ({
  ok: true,
  service: '@sedation-pro/api',
  clinicalEngineVersion: CLINICAL_LIB_VERSION,
}));

app.post(
  '/auth/dev-login',
  {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
  },
  async (request, reply) => {
    if (!env.ENABLE_DEV_LOGIN || isProduction) {
      return reply.code(403).send({ error: 'dev login is disabled' });
    }

    const input = devLoginSchema.parse(request.body);
    const organizationName = input.organizationName ?? `${input.displayName ?? input.email} Clinic`;
    const emailPrefix = input.email.split('@')[0] || 'clinic';
    const baseSlug = slugify(organizationName, emailPrefix);

    const user = await db.user.upsert({
      where: { email: input.email.toLowerCase() },
      create: {
        email: input.email.toLowerCase(),
        displayName: input.displayName ?? input.email,
      },
      update: {
        ...(input.displayName ? { displayName: input.displayName } : {}),
      },
    });

    const existingMembership = await db.membership.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });

    const organization = existingMembership?.organization
      ? existingMembership.organization
      : await db.organization.create({
          data: {
            name: organizationName,
            slug: `${baseSlug}-${Date.now().toString(36)}`,
            memberships: {
              create: {
                userId: user.id,
                role: 'OWNER',
              },
            },
            subscriptions: {
              create: {
                status: 'DEMO',
                plan: 'demo',
              },
            },
            formularyProfiles: {
              create: {
                name: 'Default Sedation Pro formulary',
                clinicalEngineVersion: CLINICAL_LIB_VERSION,
                formularyJson: toPrismaJsonObject(DEFAULT_FORMULARY),
                isDefault: true,
              },
            },
          },
        });

    const token = app.jwt.sign({ userId: user.id, email: user.email });
    makeSessionCookie(reply, token);

    await writeAudit({
      organizationId: organization.id,
      actorUserId: user.id,
      action: 'auth.dev_login',
      resourceType: 'user',
      resourceId: user.id,
      request,
    });

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      organization,
    };
  },
);


app.post(
  '/auth/firebase-login',
  {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
      },
    },
  },
  async (request, reply) => {
    if (!firebase) return reply.code(503).send({ error: 'firebase auth is not configured' });

    const input = firebaseLoginSchema.parse(request.body);
    const decoded = await firebase.verifyIdToken(input.idToken, true);
    const firebaseUid = decoded.uid;
    const email = decoded.email?.toLowerCase();
    if (!email) return reply.code(400).send({ error: 'firebase token is missing an email' });

    const displayName = typeof decoded.name === 'string' && decoded.name.trim() ? decoded.name.trim() : email;
    const organizationName = input.organizationName ?? `${displayName} Clinic`;
    const baseSlug = slugify(organizationName, email.split('@')[0] ?? firebaseUid);

    const user = await upsertFirebaseUser({ firebaseUid, email, displayName });

    const existingMembership = await db.membership.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });

    const organization = existingMembership?.organization
      ? existingMembership.organization
      : await db.organization.create({
          data: {
            name: organizationName,
            slug: `${baseSlug}-${Date.now().toString(36)}`,
            memberships: { create: { userId: user.id, role: 'OWNER' } },
            subscriptions: { create: { status: 'DEMO', plan: 'demo' } },
            formularyProfiles: {
              create: {
                name: 'Default Sedation Pro formulary',
                clinicalEngineVersion: CLINICAL_LIB_VERSION,
                formularyJson: toPrismaJsonObject(DEFAULT_FORMULARY),
                isDefault: true,
              },
            },
          },
        });

    const token = app.jwt.sign({ userId: user.id, email: user.email });
    makeSessionCookie(reply, token);

    await writeAudit({
      organizationId: organization.id,
      actorUserId: user.id,
      action: 'auth.firebase_login',
      resourceType: 'user',
      resourceId: user.id,
      request,
    });

    return { user: { id: user.id, email: user.email, displayName: user.displayName }, organization };
  },
);

app.post('/auth/logout', async (_request, reply) => {
  reply.clearCookie('sedation_pro_session', { path: '/' });
  return { ok: true };
});

app.post('/auth/refresh', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const token = app.jwt.sign({ userId: user.userId, email: user.email });
  makeSessionCookie(reply, token);
  return { ok: true };
});

app.get('/me', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const profile = await db.user.findUnique({
    where: { id: user.userId },
    include: {
      memberships: {
        include: {
          organization: {
            include: {
              subscriptions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  return { user: profile };
});

app.get('/organizations/:organizationId/cases', async (request, reply) => {
  const params = z.object({ organizationId: z.string() }).parse(request.params);
  const query = paginationSchema.parse(request.query);
  const auth = await requireMembership(request, reply, params.organizationId);
  if (!auth) return;

  const cases = await db.sedationCase.findMany({
    where: { organizationId: params.organizationId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      status: true,
      containsPhi: true,
      patientDisplayName: true,
      patientExternalId: true,
      procedureDescription: true,
      providerName: true,
      clinicalEngineVersion: true,
      formularyProfileId: true,
      createdAt: true,
      updatedAt: true,
      clinicalSnapshotJson: true,
      sedationAppJson: true,
    },
  });
  const hasMore = cases.length > query.limit;
  const page = hasMore ? cases.slice(0, query.limit) : cases;
  return { cases: page, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
});

app.post('/organizations/:organizationId/cases', async (request, reply) => {
  const params = z.object({ organizationId: z.string() }).parse(request.params);
  const auth = await requireMembership(request, reply, params.organizationId, [
    'OWNER',
    'ADMIN',
    'PROVIDER',
    'STAFF',
  ]);
  if (!auth) return;

  const input = caseSchema.parse(request.body);
  const containsPhi = input.containsPhi;
  const sedationAppPayload = scrubPhiFromSedationAppJson(input.sedationAppJson, containsPhi);
  const clinicalInput = buildClinicalInputForWrite({
    effectiveSedationAppJson: sedationAppPayload,
    input,
  });
  const assessmentPayload = sanitizeAssessmentPayload(clinicalInput, containsPhi);
  const clinicalSnapshot = buildClinicalSnapshot(clinicalInput);
  const formularyProfileId = await defaultFormularyProfileId(params.organizationId);

  const created = await db.sedationCase.create({
    data: {
      organizationId: params.organizationId,
      createdByUserId: auth.user.userId,
      containsPhi,
      patientDisplayName: containsPhi && clinicalInput.patientName ? clinicalInput.patientName : null,
      patientExternalId: containsPhi && clinicalInput.patientId ? clinicalInput.patientId : null,
      procedureDescription: clinicalInput.procedureDescription || null,
      providerName: clinicalInput.provider || null,
      caregiverName: containsPhi && clinicalInput.careName ? clinicalInput.careName : null,
      caregiverPhone: containsPhi && clinicalInput.carePhone ? clinicalInput.carePhone : null,
      assessmentJson: toInputJsonObject(assessmentPayload),
      sedationAppJson: toPrismaJsonObject(sedationAppPayload),
      clinicalSnapshotJson: toPrismaJsonObject(clinicalSnapshot),
      clinicalEngineVersion: CLINICAL_LIB_VERSION,
      formularyProfileId,
    },
  });

  await writeAudit({
    organizationId: params.organizationId,
    actorUserId: auth.user.userId,
    action: 'case.create',
    resourceType: 'sedation_case',
    resourceId: created.id,
    metadata: { containsPhi, clinicalEngineVersion: CLINICAL_LIB_VERSION, formularyProfileId },
    request,
  });

  return reply.code(201).send({ case: created });
});

app.get('/organizations/:organizationId/cases/:caseId', async (request, reply) => {
  const params = z.object({ organizationId: z.string(), caseId: z.string() }).parse(request.params);
  const auth = await requireMembership(request, reply, params.organizationId);
  if (!auth) return;

  const record = await db.sedationCase.findFirst({
    where: { id: params.caseId, organizationId: params.organizationId },
  });
  if (!record) return reply.code(404).send({ error: 'case not found' });

  await writeAudit({
    organizationId: params.organizationId,
    actorUserId: auth.user.userId,
    action: 'case.view',
    resourceType: 'sedation_case',
    resourceId: record.id,
    request,
  });

  return { case: record };
});

app.patch('/organizations/:organizationId/cases/:caseId', async (request, reply) => {
  const params = z.object({ organizationId: z.string(), caseId: z.string() }).parse(request.params);
  const auth = await requireMembership(request, reply, params.organizationId, [
    'OWNER',
    'ADMIN',
    'PROVIDER',
    'STAFF',
  ]);
  if (!auth) return;

  const input = caseSchema.partial().parse(request.body);
  const existing = await db.sedationCase.findFirst({
    where: { id: params.caseId, organizationId: params.organizationId },
  });
  if (!existing) return reply.code(404).send({ error: 'case not found' });
  if (existing.status === 'LOCKED') return reply.code(409).send({ error: 'locked cases cannot be edited' });

  const effectiveSedationAppJson = hasObjectKeys(input.sedationAppJson)
    ? input.sedationAppJson
    : existing.sedationAppJson;
  const containsPhi = typeof input.containsPhi === 'boolean' ? input.containsPhi : existing.containsPhi;
  const sedationAppPayload = scrubPhiFromSedationAppJson(effectiveSedationAppJson, containsPhi);
  const clinicalInput = buildClinicalInputForWrite({
    existingAssessmentJson: existing.assessmentJson,
    effectiveSedationAppJson: sedationAppPayload,
    input,
  });
  const assessmentPayload = sanitizeAssessmentPayload(clinicalInput, containsPhi);
  const clinicalSnapshot = buildClinicalSnapshot(clinicalInput);
  const formularyProfileId = existing.formularyProfileId ?? (await defaultFormularyProfileId(params.organizationId));

  const updated = await db.sedationCase.update({
    where: { id: existing.id },
    data: {
      containsPhi,
      patientDisplayName: containsPhi ? String(clinicalInput.patientName ?? '') || null : null,
      patientExternalId: containsPhi ? String(clinicalInput.patientId ?? '') || null : null,
      procedureDescription: String(clinicalInput.procedureDescription ?? '') || null,
      providerName: String(clinicalInput.provider ?? '') || null,
      caregiverName: containsPhi ? String(clinicalInput.careName ?? '') || null : null,
      caregiverPhone: containsPhi ? String(clinicalInput.carePhone ?? '') || null : null,
      assessmentJson: toInputJsonObject(assessmentPayload),
      sedationAppJson: toPrismaJsonObject(sedationAppPayload),
      clinicalSnapshotJson: toPrismaJsonObject(clinicalSnapshot),
      clinicalEngineVersion: CLINICAL_LIB_VERSION,
      formularyProfileId,
    },
  });

  await writeAudit({
    organizationId: params.organizationId,
    actorUserId: auth.user.userId,
    action: 'case.update',
    resourceType: 'sedation_case',
    resourceId: updated.id,
    metadata: { containsPhi, formularyProfileId },
    request,
  });

  return { case: updated };
});


app.delete('/organizations/:organizationId/cases/:caseId', async (request, reply) => {
  const params = z.object({ organizationId: z.string(), caseId: z.string() }).parse(request.params);
  const auth = await requireMembership(request, reply, params.organizationId, ['OWNER', 'ADMIN', 'PROVIDER']);
  if (!auth) return;

  const existing = await db.sedationCase.findFirst({
    where: { id: params.caseId, organizationId: params.organizationId },
    select: { id: true, status: true },
  });
  if (!existing) return reply.code(404).send({ error: 'case not found' });
  if (existing.status === 'LOCKED') return reply.code(409).send({ error: 'locked cases cannot be deleted' });

  await db.sedationCase.delete({ where: { id: existing.id } });
  await writeAudit({
    organizationId: params.organizationId,
    actorUserId: auth.user.userId,
    action: 'case.delete',
    resourceType: 'sedation_case',
    resourceId: params.caseId,
    request,
  });
  return { ok: true };
});

app.post('/organizations/:organizationId/cases/:caseId/lock', async (request, reply) => {
  const params = z.object({ organizationId: z.string(), caseId: z.string() }).parse(request.params);
  const auth = await requireMembership(request, reply, params.organizationId, ['OWNER', 'ADMIN', 'PROVIDER']);
  if (!auth) return;

  const updated = await db.sedationCase.updateMany({
    where: { id: params.caseId, organizationId: params.organizationId },
    data: { status: 'LOCKED', lockedAt: new Date() },
  });
  if (updated.count === 0) return reply.code(404).send({ error: 'case not found' });

  await writeAudit({
    organizationId: params.organizationId,
    actorUserId: auth.user.userId,
    action: 'case.lock',
    resourceType: 'sedation_case',
    resourceId: params.caseId,
    request,
  });
  return { ok: true };
});

app.get('/organizations/:organizationId/audit-logs', async (request, reply) => {
  const params = z.object({ organizationId: z.string() }).parse(request.params);
  const query = paginationSchema.parse(request.query);
  const auth = await requireMembership(request, reply, params.organizationId, ['OWNER', 'ADMIN']);
  if (!auth) return;

  const logs = await db.auditLog.findMany({
    where: { organizationId: params.organizationId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    include: {
      actor: {
        select: { email: true, displayName: true },
      },
    },
  });
  const hasMore = logs.length > query.limit;
  const page = hasMore ? logs.slice(0, query.limit) : logs;
  return { logs: page, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
});

app.post('/organizations/:organizationId/billing/checkout', async (request, reply) => {
  const params = z.object({ organizationId: z.string() }).parse(request.params);
  const input = z.object({ plan: z.enum(['solo', 'clinic']).default('clinic') }).parse(request.body ?? {});
  const auth = await requireMembership(request, reply, params.organizationId, ['OWNER']);
  if (!auth) return;

  const organization = await db.organization.findUnique({ where: { id: params.organizationId } });
  if (!organization) return reply.code(404).send({ error: 'organization not found' });

  if (!stripe) {
    await writeAudit({
      organizationId: params.organizationId,
      actorUserId: auth.user.userId,
      action: 'billing.demo_checkout_requested',
      resourceType: 'subscription',
      request,
    });
    return {
      mode: 'demo',
      message: 'Stripe is not configured. Add STRIPE_SECRET_KEY and price ids to enable checkout.',
    };
  }

  const price = input.plan === 'solo' ? env.STRIPE_PRICE_SOLO : env.STRIPE_PRICE_CLINIC;
  if (!price) return reply.code(400).send({ error: `missing Stripe price for ${input.plan}` });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    success_url: env.STRIPE_SUCCESS_URL,
    cancel_url: env.STRIPE_CANCEL_URL,
    client_reference_id: organization.id,
    customer_email: auth.user.email,
    metadata: {
      organizationId: organization.id,
      plan: input.plan,
    },
    line_items: [{ price, quantity: 1 }],
  });

  await writeAudit({
    organizationId: params.organizationId,
    actorUserId: auth.user.userId,
    action: 'billing.checkout_created',
    resourceType: 'subscription',
    metadata: { plan: input.plan },
    request,
  });

  return { mode: 'stripe', url: session.url };
});

app.post('/webhooks/stripe', async (request, reply) => {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return reply.code(400).send({ error: 'stripe webhooks are not configured' });
  }
  const signature = request.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    return reply.code(400).send({ error: 'missing stripe signature' });
  }

  let event: Stripe.Event;
  try {
    const rawBodyPayload = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
    if (!rawBodyPayload) throw new Error('missing raw Stripe body');
    event = stripe.webhooks.constructEvent(rawBodyPayload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    request.log.error(error);
    return reply.code(400).send({ error: 'invalid stripe signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const organizationId = session.metadata?.organizationId;
    const plan = session.metadata?.plan ?? 'clinic';
    if (organizationId) {
      await db.subscription.create({
        data: {
          organizationId,
          plan,
          status: 'ACTIVE',
          ...(typeof session.customer === 'string' ? { stripeCustomerId: session.customer } : {}),
          ...(typeof session.subscription === 'string'
            ? { stripeSubscriptionId: session.subscription }
            : {}),
        },
      });
      await writeAudit({
        organizationId,
        action: 'billing.checkout_completed',
        resourceType: 'subscription',
        metadata: { plan },
      });
    }
  }

  return { received: true };
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: 'validation_error', issues: error.issues });
  }
  return reply.code(500).send({ error: 'internal_server_error' });
});

export default app;

if (process.env.VERCEL !== '1') {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
}
