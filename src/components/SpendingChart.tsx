"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { PersonalSpendingCategory } from "@/lib/spending";
import { formatCurrency, formatPercent } from "@/lib/tax";

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

  const chartData = spending.map((item) => ({
    name: item.category.name,
    value: item.amount,
    color: item.category.color,
    id: item.category.id,
    percentage: item.percentage,
  }));

  const activeId = activeCategoryId ?? hoveredId;
  const activeItem = activeId ? chartData.find((d) => d.id === activeId) : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="w-full h-[400px] relative"
    >
      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="text-center">
          {activeItem ? (
            <>
              <div className="text-sm font-semibold text-white">{activeItem.name}</div>
              <div className="text-lg font-bold text-white">{formatCurrency(activeItem.value)}</div>
              <div className="text-xs text-gray-400">{formatPercent(activeItem.percentage / 100)}</div>
            </>
          ) : (
            <div className="text-xs text-gray-500">Hover or click<br />to explore</div>
          )}
        </div>
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
                onMouseEnter={() => {
                  if (!activeCategoryId) setHoveredId(entry.id);
                }}
                onClick={() => onCategoryClick(entry.id)}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
