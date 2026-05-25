import { describe, expect, it } from 'vitest';

import { sedationCloudStateSchema, validatedCloudState } from './cloudState';

describe('sedation cloud state schema', () => {
  it('round-trips representative full chart state without dropping core phase data', () => {
    const representative = {
      schemaVersion: 1,
      savedAt: '2026-05-24T00:00:00.000Z',
      patient: {
        name: 'Jane Patient',
        mrn: 'MRN-123',
        provider: 'Dr. Demo',
        assistants: 'Assistant One',
        procedure: 'Extraction',
        careName: 'Care Person',
        carePhone: '555-0100',
        careRelation: 'Spouse',
        weightLb: 160,
        heightIn: 66,
        age: 44,
        lastExamDate: '2026-05-01',
        baselineBp: { sbp: 122, dbp: 78 },
        baselineSpo2: 98,
        medsVerified: true,
        osaStatus: 'none',
        smokingStatus: 'never',
        mallampati: 'II',
        asaClass: 'II',
        npoConfirmed: true,
        consentObtained: true,
        medicalProblems: ['hypertension'],
        diabetic: true,
        baselineGlucose: 110,
        medicationsList: 'amlodipine',
        allergiesList: 'NKDA',
        hospitalisations: 'none',
        surgeries: 'appendectomy',
        familyHistory: 'noncontributory',
        anesthesiaHistory: 'no complications',
        alcoholPerWeek: 0,
        recreationalDrugs: 'none',
        cigarettesPerDay: 0,
        ekgPlaced: true,
        emergencyDrugsAvailable: true,
        monitoringEquipmentChecked: true,
      },
      local: { doses: [{ id: 'local-1', drugId: 'lidocaine-2-epi-100k', carpules: 1.5, givenAt: 1000 }] },
      iv: {
        doses: [{ id: 'iv-1', drug: 'versed', mg: 1, at: 2000 }],
        n2oOn: false,
        o2OnlyOn: true,
        ivStarted: true,
        ivStartedAt: 1500,
        ivCatheterGauge: '22',
        ivCatheterAttempts: 1,
        ivSite: 'Right dorsal hand',
        ivFluid: 'D5W 100 mL',
        preOpVitals: {
          hr: 72,
          bp: { sbp: 122, dbp: 78 },
          spo2: 98,
          etco2: 35,
          glucose: 110,
          response: 'Alert',
          at: 1500,
        },
        sedationVitals: {
          hr: 74,
          bp: { sbp: 118, dbp: 76 },
          spo2: 97,
          etco2: 36,
          glucose: 108,
          response: 'Relaxed',
          at: 2500,
        },
        preOpHr: 72,
        preOpBpSys: 122,
        preOpBpDia: 78,
        preOpSpo2: 98,
        preOpEtco2: 35,
        preOpGlucose: 110,
        preOpResponse: 'Alert',
        preOpStampedAt: 1500,
        sedHr: 74,
        sedBpSys: 118,
        sedBpDia: 76,
        sedSpo2: 97,
        sedEtco2: 36,
        sedGlucose: 108,
        sedResponse: 'Relaxed',
        sedStampedAt: 2500,
        procedureStartedAt: 3000,
      },
      recovery: {
        endHr: 72,
        endBpSys: 120,
        endBpDia: 80,
        endSpo2: 98,
        endEtco2: 34,
        endGlucose: 106,
        endResponse: 'Alert',
        endStampedAt: 5000,
        ambulatory: true,
        orientedX3: true,
        nauseaOrVomiting: false,
        excessiveBleeding: false,
        companionName: 'Care Person',
        companionRelation: 'Spouse',
        providerSignatureDataUrl: null,
        discharge: {
          escortedToVehicle: true,
          verbalInstructionsGiven: true,
          writtenInstructionsGiven: true,
          propertyReturned: true,
          pulseOxPrinted: false,
        },
        prescriptions: 'none',
        sedationRating: 'good',
        sedationComplications: 'none',
        venipunctureComplications: 'none',
        procedureNotes: 'tolerated well',
        bathroomBreaks: 0,
        returnVisitPlan: 'prn',
        returnVisitDate: '',
        ivOutAt: 5200,
        releasedAt: 5400,
        releaseAttempted: true,
      },
      eventLog: { events: [{ id: 'event-1', timestamp: 3000, event: 'Procedure started', details: { note: 'ok' } }] },
      session: { currentPhase: 'phase4' },
    };

    const parsed = sedationCloudStateSchema.parse(representative);
    expect(parsed.patient.name).toBe('Jane Patient');
    expect(parsed.local.doses).toHaveLength(1);
    expect(parsed.iv.doses).toHaveLength(1);
    expect(parsed.recovery.releasedAt).toBe(5400);
    expect(parsed.eventLog.events).toHaveLength(1);
    expect(parsed.session.currentPhase).toBe('phase4');
  });

  it('falls back unknown enum values to safe empty/default values', () => {
    const parsed = sedationCloudStateSchema.parse({
      patient: {
        osaStatus: 'severe',
        smokingStatus: 'sometimes',
        mallampati: 'V',
        asaClass: 'VI',
      },
      session: { currentPhase: 'not-a-phase' },
    });

    expect(parsed.patient.osaStatus).toBe('');
    expect(parsed.patient.smokingStatus).toBe('');
    expect(parsed.patient.mallampati).toBe('');
    expect(parsed.patient.asaClass).toBe('');
    expect(parsed.session.currentPhase).toBe('phase1');
  });

  it('defaults absent iv and recovery sections without throwing', () => {
    const parsed = sedationCloudStateSchema.parse({ patient: { name: 'Jane Patient' } });

    expect(parsed.iv.doses).toEqual([]);
    expect(parsed.iv.ivStarted).toBe(false);
    expect(parsed.recovery.ambulatory).toBe(false);
    expect(parsed.eventLog.events).toEqual([]);
  });

  it('returns a blank chart for completely garbled cloud state', () => {
    const originalError = console.error;
    const calls: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      calls.push(args);
    };

    try {
      const parsed = validatedCloudState('not-json-object');
      expect(parsed.patient.name).toBe('');
      expect(parsed.patient.provider).toBe('');
      expect(parsed.local.doses).toEqual([]);
      expect(calls.some((entry) => entry[0] === '[cloudState] hydration parse failed')).toBe(true);
    } finally {
      console.error = originalError;
    }
  });
});
