import {
  CLINICAL_LIB_VERSION,
  bmiFromImperial,
  classifyBp,
  classifySpo2,
  phase1Completeness,
} from '@sedation-pro/clinical';

export interface AssessmentInput {
  patientName?: string;
  patientId?: string;
  provider?: string;
  procedureDescription?: string;
  careName?: string;
  carePhone?: string;
  weightLb?: number;
  heightIn?: number;
  age?: number;
  lastExamDate?: string;
  sbp?: number;
  dbp?: number;
  spo2?: number;
  medsVerified?: boolean;
  osaStatus?: string;
  smokingStatus?: string;
  mallampati?: string;
  asaClass?: string;
  npoConfirmed?: boolean;
  consentObtained?: boolean;
  ekgPlaced?: boolean;
  emergencyDrugsAvailable?: boolean;
  monitoringEquipmentChecked?: boolean;
  diabetic?: boolean;
  baselineGlucose?: number;
}

export function buildClinicalSnapshot(input: Partial<AssessmentInput>): Record<string, unknown> {
  const values = {
    pt: input.patientName ?? '',
    mrn: input.patientId ?? '',
    prov: input.provider ?? '',
    care_name: input.careName ?? '',
    care_phone: input.carePhone ?? '',
    weight: input.weightLb ?? null,
    height: input.heightIn ?? null,
    patient_age: input.age ?? null,
    last_exam: input.lastExamDate ?? '',
    meds_verified: input.medsVerified ?? false,
    osa_history: input.osaStatus ?? '',
    smoking_status: input.smokingStatus ?? '',
    mallampati: input.mallampati ?? '',
    asa_class: input.asaClass ?? '',
    npo_confirmed: input.npoConfirmed ?? false,
    consent_obtained: input.consentObtained ?? false,
    ekg_placed: input.ekgPlaced ?? false,
    emergency_drugs_available: input.emergencyDrugsAvailable ?? false,
    monitoring_equipment_checked: input.monitoringEquipmentChecked ?? false,
    baseline_glucose: input.baselineGlucose ?? null,
  };

  return {
    clinicalEngineVersion: CLINICAL_LIB_VERSION,
    generatedAt: new Date().toISOString(),
    phase1Completeness: phase1Completeness({
      values,
      diabetic: input.diabetic ? 'yes' : 'no',
    }),
    vitals: {
      bmi:
        input.weightLb !== undefined && input.heightIn !== undefined
          ? bmiFromImperial(input.weightLb, input.heightIn)
          : null,
      bp:
        input.sbp !== undefined && input.dbp !== undefined ? classifyBp(input.sbp, input.dbp) : null,
      spo2: input.spo2 !== undefined ? classifySpo2(input.spo2) : null,
    },
  };
}
