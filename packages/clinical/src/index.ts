export * from './types.js';
export * from './formulary/index.js';
export * from './dosing/index.js';
export * from './gates/index.js';
export * from './vitals/index.js';
export * from './protocols/index.js';

/**
 * Pinned semver for the clinical engine. Bump any time the dosing rules,
 * formulary entries, or phase/release algorithms change so consumers can
 * detect a behavior shift at runtime.
 */
export const CLINICAL_LIB_VERSION = '0.1.0';
