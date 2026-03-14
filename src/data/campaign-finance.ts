/**
 * Campaign finance types.
 * Data comes from the FEC API (api.open.fec.gov) via /api/campaign-finance.
 */

export interface DonorEmployer {
  employer: string;
  total: number;       // dollars from employees of this employer
  count: number;       // number of individual contributions
}

export interface OutsideSpender {
  name: string;        // PAC / Super PAC name
  total: number;       // dollars spent
  support: boolean;    // true = supporting, false = opposing
}

export interface CampaignFinanceSummary {
  bioguideId: string;
  name: string;
  party: "D" | "R" | "I";
  chamber: "house" | "senate";
  state: string;
  candidateId: string;
  committeeId: string;
  cycle: number;                    // election cycle (2024, 2026)
  totalRaised: number;
  topEmployers: DonorEmployer[];    // top 10 donor employers
  outsideSpending: OutsideSpender[] | null; // null = fetch failed, [] = confirmed none
  outsideSpendingCycle: number | null;      // cycle the outside spending data is from
}
