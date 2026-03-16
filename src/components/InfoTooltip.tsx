"use client";

interface InfoTooltipProps {
  /** The tooltip content — can include JSX */
  children: React.ReactNode;
  /** Optional width class override (default: w-56) */
  width?: string;
  /** Position relative to the icon (default: above) */
  position?: "above" | "below";
}

/**
 * Small "i" icon that reveals an explanatory tooltip on hover/focus.
 * Works on desktop (hover) and mobile (tap to focus).
 */
export default function InfoTooltip({ children, width = "w-56", position = "above" }: InfoTooltipProps) {
  const positionClasses =
    position === "above"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-1.5"
      : "top-full left-1/2 -translate-x-1/2 mt-1.5";

  return (
    <span className="relative group inline-flex">
      <span
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/10 text-[9px] text-slate-400 cursor-help font-serif italic font-bold leading-none lowercase"
        tabIndex={0}
        role="note"
        aria-label="More info"
      >
        i
      </span>
      <span
        className={`absolute ${positionClasses} ${width} p-2.5 rounded-lg bg-slate-900 border border-white/10 shadow-xl text-[10px] text-slate-300 leading-relaxed text-left font-normal normal-case tracking-normal hidden group-hover:block group-focus-within:block z-[100]`}
      >
        {children}
      </span>
    </span>
  );
}
