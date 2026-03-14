/**
 * Fetches COFOG (Classification of Functions of Government) spending data
 * from the OECD SDMX v2 API for a given country and year.
 *
 * Uses the NAAG Chapter 6A dataflow (government expenditure by function)
 * which provides spending as % of GDP per COFOG division.
 *
 * We convert to % of total expenditure by dividing each COFOG value
 * by the total expenditure value.
 */

import type { CofogDataRow } from "./cofog-mapper";

// OECD SDMX v2 REST API
const OECD_BASE_URL = "https://sdmx.oecd.org/public/rest/v2/data/dataflow";
const DATAFLOW = "OECD.SDD.NAD/DSD_NAAG_VI@DF_NAAG_OTEF/1.0";

// Delay between API requests to be polite
const REQUEST_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * COFOG code mapping: OECD uses GF01–GF10, we normalize to 01–10.
 */
function normalizeCofogCode(oecdCode: string): string {
  // GF01 → 01, GF10 → 10, _T → _T (total)
  if (oecdCode.startsWith("GF")) {
    return oecdCode.slice(2);
  }
  return oecdCode;
}

/**
 * Fetch COFOG spending data for a country.
 *
 * Returns rows for all 10 COFOG top-level divisions as % of total
 * expenditure (computed from the % of GDP values).
 */
export async function fetchCofogData(
  countryCode: string,
  year: number
): Promise<CofogDataRow[]> {
  if (!countryCode) {
    throw new Error("Country code is required");
  }

  // SDMX v2 uses c[] query parameters for filtering
  const params = new URLSearchParams();
  params.set("c[REF_AREA]", countryCode);
  params.set("c[MEASURE]", "OTES13F"); // Expenditure by function of general government
  params.set("c[TIME_PERIOD]", String(year));

  const url = `${OECD_BASE_URL}/${DATAFLOW}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`No data found for country: ${countryCode}`);
    }
    throw new Error(
      `OECD API error: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();
  return parseSdmxJsonResponse(json, countryCode, year);
}

/**
 * Fetch COFOG data for multiple countries sequentially with delays.
 */
export async function fetchMultipleCountries(
  countryCodes: string[],
  year: number
): Promise<Map<string, CofogDataRow[]>> {
  const results = new Map<string, CofogDataRow[]>();

  for (const code of countryCodes) {
    const rows = await fetchCofogData(code, year);
    results.set(code, rows);

    // Be polite to the OECD API
    if (code !== countryCodes[countryCodes.length - 1]) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return results;
}

/**
 * Parse SDMX-JSON 1.0 response (series-based) into CofogDataRow[].
 *
 * The OECD v2 API returns data as % of GDP. We compute % of total
 * expenditure by dividing each COFOG division's value by the total (_T).
 *
 * Response structure:
 * - dataSets[0].series: { "0:0:0:...": { observations: { "0": [value] } } }
 * - structure.dimensions.series: defines the key positions
 * - structure.dimensions.observation: defines the time period
 */
function parseSdmxJsonResponse(
  json: SdmxJsonResponse,
  countryCode: string,
  year: number
): CofogDataRow[] {
  const dataSet = json.dataSets?.[0];
  if (!dataSet?.series) {
    throw new Error(`No series data in OECD response for ${countryCode}`);
  }

  const seriesDims = json.structure?.dimensions?.series;
  const obsDims = json.structure?.dimensions?.observation;
  if (!seriesDims || !obsDims) {
    throw new Error("No dimension metadata in OECD response");
  }

  // Find the EXPENDITURE dimension (holds COFOG codes)
  const expenditureDimIdx = seriesDims.findIndex(
    (d) => d.id === "EXPENDITURE"
  );
  if (expenditureDimIdx === -1) {
    throw new Error("Could not find EXPENDITURE dimension in OECD response");
  }
  const expenditureDim = seriesDims[expenditureDimIdx];

  // Find the REF_AREA dimension to filter to our country
  const refAreaDimIdx = seriesDims.findIndex((d) => d.id === "REF_AREA");

  // Find the TIME_PERIOD dimension in observations
  const timeDimIdx = obsDims.findIndex((d) => d.id === "TIME_PERIOD");

  // Find the observation index for our target year
  let targetTimeIdx = -1;
  if (timeDimIdx >= 0) {
    targetTimeIdx = obsDims[timeDimIdx].values.findIndex(
      (v) => v.id === String(year)
    );
  }

  // Collect all values: COFOG code → % of GDP
  const pctOfGdp = new Map<string, { code: string; label: string; value: number }>();

  for (const [seriesKey, seriesVal] of Object.entries(dataSet.series)) {
    const keyParts = seriesKey.split(":");

    // Filter to our country if multiple countries in response
    if (refAreaDimIdx >= 0) {
      const areaIdx = parseInt(keyParts[refAreaDimIdx], 10);
      const areaCode = seriesDims[refAreaDimIdx].values[areaIdx]?.id;
      if (areaCode !== countryCode) continue;
    }

    // Get the COFOG code
    const expenditureIdx = parseInt(keyParts[expenditureDimIdx], 10);
    const expenditureEntry = expenditureDim.values[expenditureIdx];
    if (!expenditureEntry) continue;

    // Get the observation value for our target year
    const obs = seriesVal.observations;
    let value: number | null = null;

    if (targetTimeIdx >= 0 && obs[String(targetTimeIdx)]) {
      value = obs[String(targetTimeIdx)][0];
    } else {
      // Try the last available observation
      const obsKeys = Object.keys(obs).map(Number).sort((a, b) => b - a);
      if (obsKeys.length > 0) {
        value = obs[String(obsKeys[0])][0];
      }
    }

    if (value == null) continue;

    pctOfGdp.set(expenditureEntry.id, {
      code: expenditureEntry.id,
      label: expenditureEntry.name,
      value,
    });
  }

  if (pctOfGdp.size === 0) {
    throw new Error(
      `No data found for country: ${countryCode} (year ${year})`
    );
  }

  // Get total expenditure to convert from % of GDP → % of total expenditure
  const total = pctOfGdp.get("_T");
  if (!total || total.value === 0) {
    throw new Error(
      `No total expenditure value found for ${countryCode} — cannot compute ratios`
    );
  }

  const rows: CofogDataRow[] = [];

  for (const [oecdCode, entry] of pctOfGdp) {
    // Skip total row — we only want the 10 COFOG divisions
    if (oecdCode === "_T") continue;

    const normalizedCode = normalizeCofogCode(oecdCode);

    rows.push({
      cofogCode: normalizedCode,
      cofogLabel: entry.label,
      // Convert: (COFOG % of GDP) / (Total % of GDP) = COFOG % of total expenditure
      pctOfTotalExpenditure: (entry.value / total.value) * 100,
    });
  }

  if (rows.length === 0) {
    throw new Error(
      `No COFOG division data found for ${countryCode} (only total was present)`
    );
  }

  return rows;
}

// ---------------------------------------------------------------------------
// SDMX-JSON 1.0 types (minimal, covering what we use)
// ---------------------------------------------------------------------------

interface SdmxDimensionValue {
  id: string;
  name: string;
}

interface SdmxDimension {
  id: string;
  name: string;
  values: SdmxDimensionValue[];
}

interface SdmxSeriesEntry {
  observations: Record<string, number[]>;
}

interface SdmxJsonResponse {
  dataSets?: Array<{
    series: Record<string, SdmxSeriesEntry>;
  }>;
  structure?: {
    dimensions?: {
      series?: SdmxDimension[];
      observation?: SdmxDimension[];
    };
  };
}
