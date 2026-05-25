import { z } from 'zod';

import { useEventLogStore, type LogEvent } from '@/stores/event-log';
import { useIVStore, type IVDoseRecord } from '@/stores/iv';
import { useLocalAnestheticStore, type LocalDoseRecord } from '@/stores/local';
import { usePatientStore } from '@/stores/patient';
import { useRecoveryStore } from '@/stores/recovery';
import { useSessionStore } from '@/stores/session';

import type { AssessmentPayload, SedationAppCloudState } from '../api/client';

const CLOUD_SYNC_CONTAINS_PHI = true;

const nullableNumberSchema = z.number().finite().nullable();
const optionalFiniteNumberSchema = z.number().finite().optional();
const stringRecordSchema = z.record(z.string());
const bpValueSchema = z.object({ sbp: nullableNumberSchema, dbp: nullableNumberSchema });

const osaStatusSchema = z.enum(['', 'none', 'osa-diagnosed', 'cpap-prescribed']).catch('');
const smokingStatusSchema = z.enum(['', 'never', 'former', 'current']).catch('');
const mallampatiSchema = z.enum(['', 'I', 'II', 'III', 'IV']).catch('');
const asaClassSchema = z.enum(['', 'I', 'II', 'III', 'IV']).catch('');
const returnVisitPlanSchema = z.enum(['', 'prn', 'scheduled']).catch('');
const phaseSchema = z.enum(['quickref', 'phase1', 'phase2', 'phase3', 'phase4']).catch('phase1');
const ivDrugSchema = z.enum(['versed', 'fentanyl', 'zofran', 'flumazenil', 'naloxone']);

const patientCloudStateSchema = z
  .object({
    name: z.string().default(''),
    mrn: z.string().default(''),
    provider: z.string().default(''),
    assistants: z.string().default(''),
    procedure: z.string().default(''),
    careName: z.string().default(''),
    carePhone: z.string().default(''),
    careRelation: z.string().default(''),
    weightLb: nullableNumberSchema.default(null),
    heightIn: nullableNumberSchema.default(null),
    age: nullableNumberSchema.default(null),
    lastExamDate: z.string().default(''),
    baselineBp: bpValueSchema.default({ sbp: null, dbp: null }),
    baselineSpo2: nullableNumberSchema.default(null),
    medsVerified: z.boolean().default(false),
    osaStatus: osaStatusSchema.default(''),
    smokingStatus: smokingStatusSchema.default(''),
    mallampati: mallampatiSchema.default(''),
    asaClass: asaClassSchema.default(''),
    npoConfirmed: z.boolean().default(false),
    consentObtained: z.boolean().default(false),
    medicalProblems: z.array(z.string()).default([]),
    diabetic: z.boolean().default(false),
    baselineGlucose: nullableNumberSchema.default(null),
    medicationsList: z.string().default(''),
    allergiesList: z.string().default(''),
    hospitalisations: z.string().default(''),
    surgeries: z.string().default(''),
    familyHistory: z.string().default(''),
    anesthesiaHistory: z.string().default(''),
    alcoholPerWeek: nullableNumberSchema.default(null),
    recreationalDrugs: z.string().default(''),
    cigarettesPerDay: nullableNumberSchema.default(null),
    ekgPlaced: z.boolean().default(false),
    emergencyDrugsAvailable: z.boolean().default(false),
    monitoringEquipmentChecked: z.boolean().default(false),
  })
  .default({});

const localDoseSchema = z.object({
  id: z.string(),
  drugId: z.string(),
  carpules: z.number().finite().nonnegative(),
  givenAt: z.number().finite(),
});

const ivDoseSchema = z.object({
  id: z.string(),
  drug: ivDrugSchema,
  mg: optionalFiniteNumberSchema,
  mcg: optionalFiniteNumberSchema,
  at: z.number().finite(),
});

const vitalsStampSchema = z.object({
  hr: nullableNumberSchema,
  bp: bpValueSchema,
  spo2: nullableNumberSchema,
  etco2: nullableNumberSchema,
  glucose: nullableNumberSchema,
  response: z.string(),
  at: z.number().finite(),
});

const logEventSchema = z.object({
  id: z.string(),
  timestamp: z.number().finite(),
  event: z.string(),
  details: stringRecordSchema,
});

export const sedationCloudStateSchema = z
  .object({
    schemaVersion: z.number().int().positive().default(1),
    savedAt: z.string().default(''),
    patient: patientCloudStateSchema,
    local: z
      .object({
        doses: z.array(localDoseSchema).default([]),
      })
      .default({}),
    iv: z
      .object({
        doses: z.array(ivDoseSchema).default([]),
        n2oOn: z.boolean().default(false),
        o2OnlyOn: z.boolean().default(false),
        ivStarted: z.boolean().default(false),
        ivStartedAt: nullableNumberSchema.default(null),
        ivCatheterGauge: z.string().default('22'),
        ivCatheterAttempts: z.number().int().positive().default(1),
        ivSite: z.string().default('Right dorsal hand'),
        ivFluid: z.string().default('D5W 100 mL'),
        preOpVitals: vitalsStampSchema.nullable().default(null),
        sedationVitals: vitalsStampSchema.nullable().default(null),
        preOpHr: nullableNumberSchema.default(null),
        preOpBpSys: nullableNumberSchema.default(null),
        preOpBpDia: nullableNumberSchema.default(null),
        preOpSpo2: nullableNumberSchema.default(null),
        preOpEtco2: nullableNumberSchema.default(null),
        preOpGlucose: nullableNumberSchema.default(null),
        preOpResponse: z.string().default('Alert'),
        preOpStampedAt: nullableNumberSchema.default(null),
        sedHr: nullableNumberSchema.default(null),
        sedBpSys: nullableNumberSchema.default(null),
        sedBpDia: nullableNumberSchema.default(null),
        sedSpo2: nullableNumberSchema.default(null),
        sedEtco2: nullableNumberSchema.default(null),
        sedGlucose: nullableNumberSchema.default(null),
        sedResponse: z.string().default('Relaxed'),
        sedStampedAt: nullableNumberSchema.default(null),
        procedureStartedAt: nullableNumberSchema.default(null),
      })
      .default({}),
    recovery: z
      .object({
        endHr: nullableNumberSchema.default(null),
        endBpSys: nullableNumberSchema.default(null),
        endBpDia: nullableNumberSchema.default(null),
        endSpo2: nullableNumberSchema.default(null),
        endEtco2: nullableNumberSchema.default(null),
        endGlucose: nullableNumberSchema.default(null),
        endResponse: z.string().default('Alert'),
        endStampedAt: nullableNumberSchema.default(null),
        ambulatory: z.boolean().default(false),
        orientedX3: z.boolean().default(false),
        nauseaOrVomiting: z.boolean().default(false),
        excessiveBleeding: z.boolean().default(false),
        companionName: z.string().default(''),
        companionRelation: z.string().default(''),
        providerSignatureDataUrl: z.string().nullable().default(null),
        discharge: z
          .object({
            escortedToVehicle: z.boolean().default(false),
            verbalInstructionsGiven: z.boolean().default(false),
            writtenInstructionsGiven: z.boolean().default(false),
            propertyReturned: z.boolean().default(false),
            pulseOxPrinted: z.boolean().default(false),
          })
          .default({}),
        prescriptions: z.string().default(''),
        sedationRating: z.string().default(''),
        sedationComplications: z.string().default(''),
        venipunctureComplications: z.string().default(''),
        procedureNotes: z.string().default(''),
        bathroomBreaks: z.number().int().nonnegative().default(0),
        returnVisitPlan: returnVisitPlanSchema.default(''),
        returnVisitDate: z.string().default(''),
        ivOutAt: nullableNumberSchema.default(null),
        releasedAt: nullableNumberSchema.default(null),
        releaseAttempted: z.boolean().default(false),
      })
      .default({}),
    eventLog: z
      .object({
        events: z.array(logEventSchema).default([]),
      })
      .default({}),
    session: z
      .object({
        currentPhase: phaseSchema.default('phase1'),
      })
      .default({}),
  })
  .default({});

type ValidatedSedationCloudState = z.infer<typeof sedationCloudStateSchema>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function optionalNumber(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringFromRecord(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

export function validatedCloudState(raw: unknown): ValidatedSedationCloudState {
  const parsed = sedationCloudStateSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Malformed cloud records should not partially hydrate arbitrary state. The
  // caller gets a safe blank chart and can inspect the source JSON from the
  // case detail view if repair is needed.
  console.error('[cloudState] hydration parse failed', parsed.error);
  return sedationCloudStateSchema.parse({});
}

/**
 * SaaS-mode Sedation Pro is deliberately PHI-on. Patient identifiers and the
 * complete sedation chart are treated as part of the practice's cloud chart,
 * saved to PostgreSQL, and protected by the SaaS API authorization/audit layer.
 *
 * If the product later supports an anonymized research/demo workflow, it should
 * use a separate explicit mode and route; do not silently change this default.
 */
export function collectSedationAppState(): SedationAppCloudState {
  const patient = usePatientStore();
  const iv = useIVStore();
  const local = useLocalAnestheticStore();
  const recovery = useRecoveryStore();
  const eventLog = useEventLogStore();
  const session = useSessionStore();

  return clone({
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    patient: {
      name: patient.name,
      mrn: patient.mrn,
      provider: patient.provider,
      assistants: patient.assistants,
      procedure: patient.procedure,
      careName: patient.careName,
      carePhone: patient.carePhone,
      careRelation: patient.careRelation,
      weightLb: patient.weightLb,
      heightIn: patient.heightIn,
      age: patient.age,
      lastExamDate: patient.lastExamDate,
      baselineBp: patient.baselineBp,
      baselineSpo2: patient.baselineSpo2,
      medsVerified: patient.medsVerified,
      osaStatus: patient.osaStatus,
      smokingStatus: patient.smokingStatus,
      mallampati: patient.mallampati,
      asaClass: patient.asaClass,
      npoConfirmed: patient.npoConfirmed,
      consentObtained: patient.consentObtained,
      medicalProblems: patient.medicalProblems,
      diabetic: patient.diabetic,
      baselineGlucose: patient.baselineGlucose,
      medicationsList: patient.medicationsList,
      allergiesList: patient.allergiesList,
      hospitalisations: patient.hospitalisations,
      surgeries: patient.surgeries,
      familyHistory: patient.familyHistory,
      anesthesiaHistory: patient.anesthesiaHistory,
      alcoholPerWeek: patient.alcoholPerWeek,
      recreationalDrugs: patient.recreationalDrugs,
      cigarettesPerDay: patient.cigarettesPerDay,
      ekgPlaced: patient.ekgPlaced,
      emergencyDrugsAvailable: patient.emergencyDrugsAvailable,
      monitoringEquipmentChecked: patient.monitoringEquipmentChecked,
    },
    local: {
      doses: local.doses,
    },
    iv: {
      doses: iv.doses,
      n2oOn: iv.n2oOn,
      o2OnlyOn: iv.o2OnlyOn,
      ivStarted: iv.ivStarted,
      ivStartedAt: iv.ivStartedAt,
      ivCatheterGauge: iv.ivCatheterGauge,
      ivCatheterAttempts: iv.ivCatheterAttempts,
      ivSite: iv.ivSite,
      ivFluid: iv.ivFluid,
      preOpVitals: iv.preOpVitals,
      sedationVitals: iv.sedationVitals,
      preOpHr: iv.preOpHr,
      preOpBpSys: iv.preOpBpSys,
      preOpBpDia: iv.preOpBpDia,
      preOpSpo2: iv.preOpSpo2,
      preOpEtco2: iv.preOpEtco2,
      preOpGlucose: iv.preOpGlucose,
      preOpResponse: iv.preOpResponse,
      preOpStampedAt: iv.preOpStampedAt,
      sedHr: iv.sedHr,
      sedBpSys: iv.sedBpSys,
      sedBpDia: iv.sedBpDia,
      sedSpo2: iv.sedSpo2,
      sedEtco2: iv.sedEtco2,
      sedGlucose: iv.sedGlucose,
      sedResponse: iv.sedResponse,
      sedStampedAt: iv.sedStampedAt,
      procedureStartedAt: iv.procedureStartedAt,
    },
    recovery: {
      endHr: recovery.endHr,
      endBpSys: recovery.endBpSys,
      endBpDia: recovery.endBpDia,
      endSpo2: recovery.endSpo2,
      endEtco2: recovery.endEtco2,
      endGlucose: recovery.endGlucose,
      endResponse: recovery.endResponse,
      endStampedAt: recovery.endStampedAt,
      ambulatory: recovery.ambulatory,
      orientedX3: recovery.orientedX3,
      nauseaOrVomiting: recovery.nauseaOrVomiting,
      excessiveBleeding: recovery.excessiveBleeding,
      companionName: recovery.companionName,
      companionRelation: recovery.companionRelation,
      providerSignatureDataUrl: recovery.providerSignatureDataUrl,
      discharge: recovery.discharge,
      prescriptions: recovery.prescriptions,
      sedationRating: recovery.sedationRating,
      sedationComplications: recovery.sedationComplications,
      venipunctureComplications: recovery.venipunctureComplications,
      procedureNotes: recovery.procedureNotes,
      bathroomBreaks: recovery.bathroomBreaks,
      returnVisitPlan: recovery.returnVisitPlan,
      returnVisitDate: recovery.returnVisitDate,
      ivOutAt: recovery.ivOutAt,
      releasedAt: recovery.releasedAt,
      releaseAttempted: recovery.releaseAttempted,
    },
    eventLog: {
      events: eventLog.events,
    },
    session: {
      currentPhase: session.currentPhase,
    },
  });
}

export function patientAssessmentPayload(state = collectSedationAppState()): AssessmentPayload {
  const p = state.patient;
  return {
    containsPhi: CLOUD_SYNC_CONTAINS_PHI,
    patientName: p.name,
    patientId: p.mrn,
    procedureDescription: p.procedure,
    provider: p.provider,
    careName: p.careName,
    carePhone: p.carePhone,
    weightLb: optionalNumber(p.weightLb),
    heightIn: optionalNumber(p.heightIn),
    age: optionalNumber(p.age),
    lastExamDate: p.lastExamDate,
    sbp: optionalNumber(p.baselineBp?.sbp),
    dbp: optionalNumber(p.baselineBp?.dbp),
    spo2: optionalNumber(p.baselineSpo2),
    medsVerified: p.medsVerified,
    osaStatus: p.osaStatus || undefined,
    smokingStatus: p.smokingStatus || undefined,
    mallampati: p.mallampati || undefined,
    asaClass: p.asaClass || undefined,
    npoConfirmed: p.npoConfirmed,
    consentObtained: p.consentObtained,
    ekgPlaced: p.ekgPlaced,
    emergencyDrugsAvailable: p.emergencyDrugsAvailable,
    monitoringEquipmentChecked: p.monitoringEquipmentChecked,
    diabetic: p.diabetic,
    baselineGlucose: p.diabetic ? optionalNumber(p.baselineGlucose) : undefined,
    sedationAppJson: state,
  };
}

export function hasClinicalContent(state = collectSedationAppState()): boolean {
  const p = state.patient;
  return Boolean(
    p.name ||
      p.mrn ||
      p.procedure ||
      p.careName ||
      p.carePhone ||
      p.weightLb ||
      p.heightIn ||
      p.age ||
      p.lastExamDate ||
      p.baselineBp?.sbp ||
      p.baselineBp?.dbp ||
      p.baselineSpo2 ||
      p.medsVerified ||
      p.npoConfirmed ||
      p.consentObtained ||
      p.ekgPlaced ||
      p.emergencyDrugsAvailable ||
      p.monitoringEquipmentChecked ||
      (state.local.doses as LocalDoseRecord[]).length > 0 ||
      (state.iv.doses as IVDoseRecord[]).length > 0 ||
      (state.eventLog.events as LogEvent[]).length > 0 ||
      state.recovery.releasedAt,
  );
}

export function clearSedationAppState(): void {
  usePatientStore().reset();
  useLocalAnestheticStore().clear();
  useIVStore().clear();
  useRecoveryStore().reset();
  useEventLogStore().clear();
  useSessionStore().setPhase('phase1');
}

export function hydrateSedationAppState(raw: unknown): void {
  const state = validatedCloudState(raw);
  const rawPatient = objectRecord(objectRecord(raw).patient);

  clearSedationAppState();

  const patient = usePatientStore();
  patient.name = state.patient.name || stringFromRecord(rawPatient, 'patientName');
  patient.mrn = state.patient.mrn || stringFromRecord(rawPatient, 'patientId');
  patient.provider = state.patient.provider;
  patient.assistants = state.patient.assistants;
  patient.procedure = state.patient.procedure || stringFromRecord(rawPatient, 'procedureDescription');
  patient.careName = state.patient.careName;
  patient.carePhone = state.patient.carePhone;
  patient.careRelation = state.patient.careRelation;
  patient.weightLb = state.patient.weightLb;
  patient.heightIn = state.patient.heightIn;
  patient.age = state.patient.age;
  patient.lastExamDate = state.patient.lastExamDate;
  patient.baselineBp = state.patient.baselineBp;
  patient.baselineSpo2 = state.patient.baselineSpo2;
  patient.medsVerified = state.patient.medsVerified;
  patient.osaStatus = state.patient.osaStatus;
  patient.smokingStatus = state.patient.smokingStatus;
  patient.mallampati = state.patient.mallampati;
  patient.asaClass = state.patient.asaClass;
  patient.npoConfirmed = state.patient.npoConfirmed;
  patient.consentObtained = state.patient.consentObtained;
  patient.medicalProblems = state.patient.medicalProblems;
  patient.diabetic = state.patient.diabetic;
  patient.baselineGlucose = state.patient.baselineGlucose;
  patient.medicationsList = state.patient.medicationsList;
  patient.allergiesList = state.patient.allergiesList;
  patient.hospitalisations = state.patient.hospitalisations;
  patient.surgeries = state.patient.surgeries;
  patient.familyHistory = state.patient.familyHistory;
  patient.anesthesiaHistory = state.patient.anesthesiaHistory;
  patient.alcoholPerWeek = state.patient.alcoholPerWeek;
  patient.recreationalDrugs = state.patient.recreationalDrugs;
  patient.cigarettesPerDay = state.patient.cigarettesPerDay;
  patient.ekgPlaced = state.patient.ekgPlaced;
  patient.emergencyDrugsAvailable = state.patient.emergencyDrugsAvailable;
  patient.monitoringEquipmentChecked = state.patient.monitoringEquipmentChecked;

  const local = useLocalAnestheticStore();
  local.doses = state.local.doses as LocalDoseRecord[];

  const iv = useIVStore();
  iv.doses = state.iv.doses as IVDoseRecord[];
  iv.n2oOn = state.iv.n2oOn;
  iv.o2OnlyOn = state.iv.o2OnlyOn;
  iv.ivStarted = state.iv.ivStarted;
  iv.ivStartedAt = state.iv.ivStartedAt;
  iv.ivCatheterGauge = state.iv.ivCatheterGauge;
  iv.ivCatheterAttempts = state.iv.ivCatheterAttempts;
  iv.ivSite = state.iv.ivSite;
  iv.ivFluid = state.iv.ivFluid;
  iv.preOpVitals = state.iv.preOpVitals;
  iv.sedationVitals = state.iv.sedationVitals;
  iv.preOpHr = state.iv.preOpHr;
  iv.preOpBpSys = state.iv.preOpBpSys;
  iv.preOpBpDia = state.iv.preOpBpDia;
  iv.preOpSpo2 = state.iv.preOpSpo2;
  iv.preOpEtco2 = state.iv.preOpEtco2;
  iv.preOpGlucose = state.iv.preOpGlucose;
  iv.preOpResponse = state.iv.preOpResponse;
  iv.preOpStampedAt = state.iv.preOpStampedAt;
  iv.sedHr = state.iv.sedHr;
  iv.sedBpSys = state.iv.sedBpSys;
  iv.sedBpDia = state.iv.sedBpDia;
  iv.sedSpo2 = state.iv.sedSpo2;
  iv.sedEtco2 = state.iv.sedEtco2;
  iv.sedGlucose = state.iv.sedGlucose;
  iv.sedResponse = state.iv.sedResponse;
  iv.sedStampedAt = state.iv.sedStampedAt;
  iv.procedureStartedAt = state.iv.procedureStartedAt;

  const recovery = useRecoveryStore();
  recovery.endHr = state.recovery.endHr;
  recovery.endBpSys = state.recovery.endBpSys;
  recovery.endBpDia = state.recovery.endBpDia;
  recovery.endSpo2 = state.recovery.endSpo2;
  recovery.endEtco2 = state.recovery.endEtco2;
  recovery.endGlucose = state.recovery.endGlucose;
  recovery.endResponse = state.recovery.endResponse;
  recovery.endStampedAt = state.recovery.endStampedAt;
  recovery.ambulatory = state.recovery.ambulatory;
  recovery.orientedX3 = state.recovery.orientedX3;
  recovery.nauseaOrVomiting = state.recovery.nauseaOrVomiting;
  recovery.excessiveBleeding = state.recovery.excessiveBleeding;
  recovery.companionName = state.recovery.companionName;
  recovery.companionRelation = state.recovery.companionRelation;
  recovery.providerSignatureDataUrl = state.recovery.providerSignatureDataUrl;
  recovery.discharge = state.recovery.discharge;
  recovery.prescriptions = state.recovery.prescriptions;
  recovery.sedationRating = state.recovery.sedationRating;
  recovery.sedationComplications = state.recovery.sedationComplications;
  recovery.venipunctureComplications = state.recovery.venipunctureComplications;
  recovery.procedureNotes = state.recovery.procedureNotes;
  recovery.bathroomBreaks = state.recovery.bathroomBreaks;
  recovery.returnVisitPlan = state.recovery.returnVisitPlan;
  recovery.returnVisitDate = state.recovery.returnVisitDate;
  recovery.ivOutAt = state.recovery.ivOutAt;
  recovery.releasedAt = state.recovery.releasedAt;
  recovery.releaseAttempted = state.recovery.releaseAttempted;

  const eventLog = useEventLogStore();
  eventLog.events = state.eventLog.events as LogEvent[];

  const session = useSessionStore();
  session.setPhase(state.session.currentPhase);
}
