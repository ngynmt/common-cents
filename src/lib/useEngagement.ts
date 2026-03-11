"use client";

import { useState, useEffect, useCallback } from "react";

interface BillEngagement {
  support: number;
  oppose: number;
  contacted: number;
}

type EngagementData = Record<string, BillEngagement>;

/**
 * Hook to fetch and update engagement counters for bills.
 */
export function useEngagement(billIds: string[]) {
  const [data, setData] = useState<EngagementData>({});
  const [loading, setLoading] = useState(true);

  // Fetch initial counts
  useEffect(() => {
    if (billIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchCounts = async () => {
      try {
        const res = await fetch(`/api/engagement?bills=${billIds.join(",")}`);
        const json = await res.json();
        setData(json.counts || {});
      } catch {
        // Silently fail — engagement counts are non-critical
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, [billIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Record an engagement action
  const recordAction = useCallback(
    async (billId: string, action: "support" | "oppose" | "contacted") => {
      try {
        const res = await fetch("/api/engagement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ billId, action }),
        });
        const json = await res.json();

        // Optimistically update local state
        setData((prev) => ({
          ...prev,
          [billId]: {
            ...prev[billId],
            [action]: json.count ?? (prev[billId]?.[action] || 0) + 1,
          },
        }));
      } catch {
        // Optimistic update even on failure
        setData((prev) => ({
          ...prev,
          [billId]: {
            ...prev[billId],
            [action]: (prev[billId]?.[action] || 0) + 1,
          },
        }));
      }
    },
    []
  );

  return { data, loading, recordAction };
}
