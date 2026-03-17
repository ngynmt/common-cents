"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { TRANSITION_DEFAULT } from "@/lib/constants";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { PersonalSpendingCategory } from "@/lib/spending";
import { formatCurrency, formatPercent } from "@/lib/tax";
import { useTheme } from "next-themes";
import { resolveThemeColor } from "@/lib/themeColor";

interface SpendingChartProps {
  spending: PersonalSpendingCategory[];
  onCategoryClick: (categoryId: string) => void;
  activeCategoryId: string | null;
}

export default function SpendingChart({
  spending,
  onCategoryClick,
  activeCategoryId,
}: SpendingChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [, setKeyboardIndex] = useState<number | null>(null);
  const { resolvedTheme } = useTheme();

  // Keyboard handler — declared before any early returns to satisfy Rules of Hooks.
  // Uses functional state updaters to avoid stale closure over chartData/keyboardIndex,
  // keeping only stable deps (spending, onCategoryClick).
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const len = spending.length;
      if (!len) return;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown": {
          e.preventDefault();
          setKeyboardIndex((prev) => {
            const next = prev === null ? 0 : (prev + 1) % len;
            setHoveredId(spending[next].category.id);
            return next;
          });
          break;
        }
        case "ArrowLeft":
        case "ArrowUp": {
          e.preventDefault();
          setKeyboardIndex((prev) => {
            const idx = prev === null ? len - 1 : (prev - 1 + len) % len;
            setHoveredId(spending[idx].category.id);
            return idx;
          });
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          setKeyboardIndex((prev) => {
            if (prev !== null) {
              onCategoryClick(spending[prev].category.id);
            }
            return prev;
          });
          break;
        }
        case "Escape": {
          e.preventDefault();
          setKeyboardIndex(null);
          setHoveredId(null);
          break;
        }
      }
    },
    [spending, onCategoryClick],
  );

  const chartData = spending.map((item) => ({
    name: item.category.name,
    value: item.amount,
    color: resolveThemeColor(item.category.color, resolvedTheme ?? "dark"),
    id: item.category.id,
    percentage: item.percentage,
  }));

  const activeId = activeCategoryId ?? hoveredId;
  const activeItem = activeId ? chartData.find((d) => d.id === activeId) : null;

  // Loading skeleton — early return when no data
  if (spending.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center">
        <div className="w-[280px] h-[280px] rounded-full border-[20px] border-white/5 animate-pulse flex items-center justify-center">
          <span className="text-sm text-slate-500">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...TRANSITION_DEFAULT, duration: 0.6, delay: 0.2 }}
      className="w-full h-[400px] relative outline-none"
      role="application"
      aria-roledescription="interactive chart"
      aria-label={`Spending breakdown chart with ${chartData.length} categories. Use arrow keys to navigate segments, Enter to expand, Escape to deselect.`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onBlur={() => setKeyboardIndex(null)}
    >
      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="text-center">
          {activeItem ? (
            <>
              <div className="text-sm font-semibold text-white">{activeItem.name}</div>
              <div className="text-lg font-bold text-white font-amount">{formatCurrency(activeItem.value)}</div>
              <div className="text-xs text-slate-400">{formatPercent(activeItem.percentage / 100)}</div>
            </>
          ) : (
            <div className="text-xs text-slate-400">Hover, click, or<br />use arrow keys</div>
          )}
        </div>
      </div>

      {/* aria-live announcement region for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {activeItem
          ? `${activeItem.name}: ${formatCurrency(activeItem.value)}, ${formatPercent(activeItem.percentage / 100)} of your taxes`
          : ""}
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={activeItem ? 145 : 140}
            dataKey="value"
            onMouseLeave={() => setHoveredId(null)}
            className="outline-none"
            stroke="transparent"
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.id}
                fill={entry.color}
                stroke={activeId === entry.id ? entry.color : "transparent"}
                strokeWidth={activeId === entry.id ? 2 : 0}
                opacity={activeId && entry.id !== activeId ? 0.3 : 1}
                className="cursor-pointer transition-opacity duration-200"
                onMouseEnter={() => setHoveredId(entry.id)}
                onClick={() => {
                  setHoveredId(entry.id);
                  onCategoryClick(entry.id);
                }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
