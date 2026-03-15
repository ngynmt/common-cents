/**
 * Utilities for the Follow the Money feature.
 *
 * Provides:
 * - Contractor name normalization for FEC matching
 * - Types for influence chain data
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContractorDonation {
  recipientName: string;
  recipientParty: "D" | "R" | "I";
  recipientState: string;
  recipientOffice: "house" | "senate";
  candidateId: string;
  total: number;
  count: number;
}

export interface ContractorInfluence {
  contractorName: string;
  normalizedName: string;
  totalDonations: number;
  donationCount: number;
  topRecipients: ContractorDonation[];
  cycle: number;
}

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

/**
 * Common suffixes and legal designators to strip for FEC matching.
 */
const STRIP_PATTERNS = [
  /\b(INC|LLC|LLP|CORP|CO|LTD|PLC|SA|AG|GMBH|GROUP|HOLDINGS?)\.?\s*$/i,
  /\b(COMPANY|CORPORATION|INCORPORATED|LIMITED)\s*$/i,
  /\bTHE\s+/i,
  /[.,]+\s*$/,
];

/**
 * Normalize a contractor name for FEC employer matching.
 * USASpending uses official names like "LOCKHEED MARTIN CORPORATION"
 * while FEC has "LOCKHEED MARTIN" or "Lockheed Martin Corp".
 */
export function normalizeContractorName(name: string): string {
  let normalized = name.trim().toUpperCase();
  for (const pattern of STRIP_PATTERNS) {
    normalized = normalized.replace(pattern, "").trim();
  }
  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, " ");
  return normalized;
}
