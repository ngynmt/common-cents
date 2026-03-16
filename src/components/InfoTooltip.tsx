"use client";

import { useState, useRef, useCallback } from "react";

interface InfoTooltipProps {
  children: React.ReactNode;
  width?: string;
  position?: "above" | "below" | "auto";
}

export default function InfoTooltip({ children, width = "w-56", position = "auto" }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [resolvedPosition, setResolvedPosition] = useState<"above" | "below">(
    position === "auto" ? "above" : position,
  );
  const [horizontalShift, setHorizontalShift] = useState(0);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    // Vertical: decide above or below
    if (position === "auto" || position === "above") {
      const spaceAbove = triggerRect.top;

      if (position === "auto") {
        setResolvedPosition(spaceAbove >= tooltipRect.height + 8 ? "above" : "below");
      } else if (spaceAbove < tooltipRect.height + 8) {
        setResolvedPosition("below"); // flip if preferred direction clips
      }
    } else {
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      if (spaceBelow < tooltipRect.height + 8) {
        setResolvedPosition("above");
      }
    }

    // Horizontal: shift if clipping edges
    const tooltipLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const tooltipRight = tooltipLeft + tooltipRect.width;
    const padding = 8;

    if (tooltipLeft < padding) {
      setHorizontalShift(padding - tooltipLeft);
    } else if (tooltipRight > window.innerWidth - padding) {
      setHorizontalShift(window.innerWidth - padding - tooltipRight);
    } else {
      setHorizontalShift(0);
    }
  }, [position]);

  const show = useCallback(() => {
    setIsVisible(true);
    // Use rAF so the tooltip is rendered (opacity-0 but not display:none) before measuring
    requestAnimationFrame(calculatePosition);
  }, [calculatePosition]);

  const hide = useCallback(() => {
    setIsVisible(false);
  }, []);

  const positionClasses =
    resolvedPosition === "above"
      ? "bottom-full mb-1.5"
      : "top-full mt-1.5";

  return (
    <span
      className="relative group inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span
        ref={triggerRef}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/10 text-[9px] text-slate-400 cursor-help font-serif italic font-bold leading-none lowercase"
        tabIndex={0}
        role="note"
        aria-label="More info"
      >
        i
      </span>
      <span
        ref={tooltipRef}
        className={`absolute ${positionClasses} ${width} p-2.5 rounded-lg bg-slate-900 border border-white/10 shadow-xl text-[10px] text-slate-300 leading-relaxed text-left font-normal normal-case tracking-normal z-[100] transition-opacity duration-150 ${
          isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{
          left: "50%",
          transform: `translateX(calc(-50% + ${horizontalShift}px))`,
        }}
      >
        {children}
      </span>
    </span>
  );
}
