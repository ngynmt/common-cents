/**
 * Fetches development indicators from the World Bank Open Data API.
 * Batches all countries into a single request per indicator.
 * Picks the most recent non-null value per country.
 */

import type { OutcomeIndicator } from "../../src/data/international-outcomes";

// ---------------------------------------------------------------------------
// Indicator registry
// ---------------------------------------------------------------------------

export interface IndicatorDef {
  /** World Bank indicator code */
  code: string;
  /** Key used in our output JSON (e.g., "life_expectancy") */
  key: string;
  /** Human-readable unit */
  unit: string;
  /** Budget category this maps to */
  category: string;
  /** Date range for query — distributional indicators need wider windows */
  dateRange: string;
}

export const INDICATORS: IndicatorDef[] = [
  // Healthcare
  { code: "SP.DYN.LE00.IN", key: "life_expectancy", unit: "years", category: "healthcare", dateRange: "2019:2023" },
  { code: "SP.DYN.IMRT.IN", key: "infant_mortality", unit: "per 1,000 live births", category: "healthcare", dateRange: "2019:2023" },
  { code: "SH.XPD.OOPC.CH.ZS", key: "out_of_pocket_health", unit: "% of health spending", category: "healthcare", dateRange: "2019:2023" },
  // Education
  { code: "SE.XPD.TOTL.GD.ZS", key: "education_spending_gdp", unit: "% of GDP", category: "education", dateRange: "2019:2023" },
  { code: "SE.TER.ENRR", key: "tertiary_enrollment", unit: "%", category: "education", dateRange: "2019:2023" },
  // Income Security
  { code: "SI.POV.GINI", key: "gini_index", unit: "index (0=equal, 100=unequal)", category: "income-security", dateRange: "2016:2023" },
  { code: "SI.POV.NAHC", key: "poverty_rate", unit: "%", category: "income-security", dateRange: "2016:2023" },
  { code: "SI.DST.FRST.20", key: "income_share_bottom_20", unit: "%", category: "income-security", dateRange: "2016:2023" },
  // Social Security
  { code: "per_si_allsi.cov_pop_tot", key: "social_insurance_coverage", unit: "% of population", category: "social-security", dateRange: "2016:2023" },
  // Infrastructure
  { code: "IT.NET.BBND.P2", key: "broadband_per_100", unit: "per 100 people", category: "infrastructure", dateRange: "2019:2023" },
  // Defense
  { code: "MS.MIL.XPND.GD.ZS", key: "military_spending_gdp", unit: "% of GDP", category: "defense", dateRange: "2019:2023" },
  // Science
  { code: "GB.XPD.RSDV.GD.ZS", key: "rd_spending_gdp", unit: "% of GDP", category: "science", dateRange: "2019:2023" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorldBankIndicatorResult {
  value: number;
  year: number;
}

const WB_BASE_URL = "https://api.worldbank.org/v2";
const REQUEST_DELAY_MS = 300;

/** World Bank API returns ISO-2 codes; the rest of the codebase uses ISO-3. */
const ISO2_TO_ISO3: Record<string, string> = {
  US: "USA", GB: "GBR", DE: "DEU", AU: "AUS", JP: "JPN", KR: "KOR", FR: "FRA",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Fetch a single indicator for all countries
// ---------------------------------------------------------------------------

export async function fetchIndicator(
  indicatorCode: string,
  countryCodes: string[],
  dateRange: string = "2019:2023"
): Promise<Map<string, WorldBankIndicatorResult>> {
  const codes = countryCodes.join(";");
  const url = `${WB_BASE_URL}/country/${codes}/indicator/${indicatorCode}?format=json&date=${dateRange}&per_page=500`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `World Bank API error: ${response.status} ${response.statusText} for indicator ${indicatorCode}`
    );
  }

  const json = await response.json();
  const data = json[1]; // [metadata, data[]]

  if (!data || !Array.isArray(data)) {
    return new Map();
  }

  // Group by country, pick most recent non-null value
  const byCountry = new Map<string, WorldBankIndicatorResult>();

  // Sort by year descending so first non-null hit per country is the latest
  const sorted = [...data].sort(
    (a: { date: string }, b: { date: string }) =>
      parseInt(b.date, 10) - parseInt(a.date, 10)
  );

  for (const entry of sorted) {
    const rawCode = entry.country.id;
    const countryCode = ISO2_TO_ISO3[rawCode] ?? rawCode;
    if (entry.value == null) continue;
    if (byCountry.has(countryCode)) continue; // already have a more recent value

    byCountry.set(countryCode, {
      value: entry.value,
      year: parseInt(entry.date, 10),
    });
  }

  return byCountry;
}

// ---------------------------------------------------------------------------
// Fetch all indicators for all countries
// ---------------------------------------------------------------------------

export async function fetchAllIndicators(
  countryCodes: string[]
): Promise<Map<string, Record<string, OutcomeIndicator>>> {
  const countryData = new Map<string, Record<string, OutcomeIndicator>>();

  for (let i = 0; i < INDICATORS.length; i++) {
    const ind = INDICATORS[i];
    const results = await fetchIndicator(ind.code, countryCodes, ind.dateRange);

    for (const [code, result] of results) {
      if (!countryData.has(code)) {
        countryData.set(code, {});
      }
      countryData.get(code)![ind.key] = {
        value: result.value,
        year: result.year,
        unit: ind.unit,
      };
    }

    // Polite delay between requests
    if (i < INDICATORS.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return countryData;
}
