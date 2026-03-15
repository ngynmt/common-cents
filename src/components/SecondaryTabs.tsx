"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BillsPanel from "./BillsPanel";
import InternationalComparison from "./InternationalComparison";
import RecentExpenditures from "./RecentExpenditures";
import type { Representative } from "@/data/representatives";
import type { PersonalSpendingCategory } from "@/lib/spending";
import type { FilingStatus } from "@/lib/tax";

type TabId = "bills" | "spending" | "compare";

const TABS: { id: TabId; label: string }[] = [
  { id: "bills", label: "Pending Bills" },
  { id: "spending", label: "Recent Spending" },
  { id: "compare", label: "Global Comparison" },
];

interface SecondaryTabsProps {
  activeCategoryId: string | null;
  activeCategoryName: string | null;
  totalFederalTax: number;
  representatives: Representative[] | null;
  spending: PersonalSpendingCategory[];
  grossIncome: number;
  filingStatus: FilingStatus;
  compareCountry: string | null;
  onCompareCountryChange: (code: string | null) => void;
  initialTab?: TabId;
}

export default function SecondaryTabs({
  activeCategoryId,
  activeCategoryName,
  totalFederalTax,
  representatives,
  spending,
  grossIncome,
  filingStatus,
  compareCountry,
  onCompareCountryChange,
  initialTab = "bills",
}: SecondaryTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "bills" && (
          <motion.div
            key="bills"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <BillsPanel
              activeCategoryId={activeCategoryId}
              activeCategoryName={activeCategoryName}
              totalFederalTax={totalFederalTax}
              representatives={representatives}
            />
          </motion.div>
        )}

        {activeTab === "spending" && (
          <motion.div
            key="spending"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <RecentExpenditures totalFederalTax={totalFederalTax} />
          </motion.div>
        )}

        {activeTab === "compare" && (
          <motion.div
            key="compare"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <InternationalComparison
              spending={spending}
              totalFederalTax={totalFederalTax}
              grossIncome={grossIncome}
              filingStatus={filingStatus}
              initialCountry={compareCountry}
              onCountryChange={onCompareCountryChange}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
