/**
 * TypeScript types for international outcome indicators and editorial callouts.
 * Generated data lives in international-outcomes.json — these types are for
 * compile-time safety when consuming that data.
 */

export interface OutcomeIndicator {
  value: number;
  year: number;
  unit: string;
}

export interface HealthcareSystem {
  type: string;
  covered: string;
}

export interface CountryOutcomes {
  name: string;
  indicators: Record<string, OutcomeIndicator>;
  healthcareSystem?: HealthcareSystem;
}

export interface OutcomeCallout {
  text: string;
  indicatorValuesAtEnrichment: Record<string, number>;
  enrichedAt: string;
}

export interface InternationalOutcomes {
  lastUpdated: string;
  source: string;
  /** Target year for indicators — individual indicators may differ due to data lag */
  primaryYear: number;
  countries: Record<string, CountryOutcomes>;
  callouts: Record<string, Record<string, OutcomeCallout>>;
}
