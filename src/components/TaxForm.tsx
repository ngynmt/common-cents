"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { FilingStatus } from "@/lib/tax";

interface TaxFormProps {
  onSubmit: (data: { income: number; filingStatus: FilingStatus; zipCode: string }) => void;
}

export default function TaxForm({ onSubmit }: TaxFormProps) {
  const [income, setIncome] = useState("");
  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");
  const [zipCode, setZipCode] = useState("");
  const [incomeError, setIncomeError] = useState("");
  const [zipError, setZipError] = useState("");

  const handleIncomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setIncome(raw);
    if (incomeError) setIncomeError("");
  };

  const handleIncomeBlur = () => {
    if (!income || Number(income) <= 0) {
      setIncomeError("Enter your annual income");
    }
  };

  const handleZipBlur = () => {
    if (zipCode.length > 0 && zipCode.length < 5) {
      setZipError("Enter a valid 5-digit ZIP code");
    }
  };

  const formattedIncome = income
    ? new Intl.NumberFormat("en-US").format(Number(income))
    : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const incomeNum = Number(income);
    if (incomeNum > 0) {
      onSubmit({ income: incomeNum, filingStatus, zipCode });
    }
  };

  const isValid = Number(income) > 0;

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto space-y-6"
    >
      {/* Income */}
      <div className="space-y-2">
        <label htmlFor="income" className="block text-xs font-medium text-slate-500 uppercase tracking-[1.5px]">
          Annual Gross Income
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
            $
          </span>
          <input
            id="income"
            type="text"
            inputMode="numeric"
            value={formattedIncome}
            onChange={handleIncomeChange}
            onBlur={handleIncomeBlur}
            placeholder="75,000"
            aria-invalid={!!incomeError}
            aria-describedby={incomeError ? "income-error" : undefined}
            className={`w-full pl-8 pr-4 py-3 bg-white/5 border rounded-xl text-white text-lg font-amount placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
              incomeError ? "border-red-400/50" : "border-white/10"
            }`}
          />
        </div>
        {incomeError && (
          <p id="income-error" className="text-xs text-red-400 mt-1">{incomeError}</p>
        )}
      </div>

      {/* Filing Status */}
      <div className="space-y-2">
        <label id="filing-status-label" className="block text-xs font-medium text-slate-500 uppercase tracking-[1.5px]">
          Filing Status
        </label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="filing-status-label">
          {[
            { value: "single" as FilingStatus, label: "Single" },
            { value: "married" as FilingStatus, label: "Married" },
            { value: "head_of_household" as FilingStatus, label: "Head of Household" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={filingStatus === option.value}
              onClick={() => setFilingStatus(option.value)}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                filingStatus === option.value
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* ZIP Code */}
      <div className="space-y-2">
        <label htmlFor="zipCode" className="block text-xs font-medium text-slate-500 uppercase tracking-[1.5px]">
          ZIP Code <span className="text-slate-500 normal-case tracking-normal italic">(optional — for representative lookup)</span>
        </label>
        <input
          id="zipCode"
          type="text"
          inputMode="numeric"
          value={zipCode}
          onChange={(e) => {
            setZipCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 5));
            if (zipError) setZipError("");
          }}
          onBlur={handleZipBlur}
          placeholder="5 digits"
          maxLength={5}
          aria-invalid={!!zipError}
          aria-describedby={zipError ? "zip-error" : undefined}
          className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white text-lg font-amount placeholder:text-slate-600 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
            zipError ? "border-red-400/50" : "border-white/10"
          }`}
        />
        {zipError && (
          <p id="zip-error" className="text-xs text-red-400 mt-1">{zipError}</p>
        )}
      </div>

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={!isValid}
        whileHover={isValid ? { scale: 1.02 } : {}}
        whileTap={isValid ? { scale: 0.98 } : {}}
        className={`w-full py-4 rounded-xl text-lg font-semibold transition-all ${
          isValid
            ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 cursor-pointer"
            : "bg-white/5 text-gray-500 cursor-not-allowed"
        }`}
      >
        See Where Your Money Goes
      </motion.button>
    </motion.form>
  );
}
