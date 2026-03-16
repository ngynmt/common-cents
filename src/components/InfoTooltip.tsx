"use client";

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface InfoTooltipProps {
  children: React.ReactNode;
  /** Tailwind width class (default: "w-56") */
  width?: string;
  position?: "above" | "below" | "auto";
}

// Map Tailwind width classes to pixel values for fixed positioning
const WIDTH_MAP: Record<string, number> = {
  "w-56": 224,
  "w-60": 240,
  "w-64": 256,
};

interface TooltipStyle {
  top: number;
  left: number;
}

export default function InfoTooltip({ children, width = "w-56", position = "auto" }: InfoTooltipProps) {
  const maxWidth = WIDTH_MAP[width] ?? 224;
  const [isVisible, setIsVisible] = useState(false);
  const [style, setStyle] = useState<TooltipStyle>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const padding = 8;
    const gap = 6; // space between trigger and tooltip

    // Vertical: decide above or below
    let vertical: "above" | "below";
    if (position === "auto") {
      const spaceAbove = triggerRect.top;
      vertical = spaceAbove >= tooltipRect.height + gap ? "above" : "below";
    } else {
      const spacePreferred =
        position === "above" ? triggerRect.top : window.innerHeight - triggerRect.bottom;
      vertical = spacePreferred >= tooltipRect.height + gap ? position : (position === "above" ? "below" : "above");
    }
    setResolvedPosition(vertical);

    // Calculate top
    const top =
      vertical === "above"
        ? triggerRect.top - tooltipRect.height - gap
        : triggerRect.bottom + gap;

    // Calculate left — center on trigger, then clamp to viewport
    const tooltipWidth = Math.min(tooltipRect.width, window.innerWidth - padding * 2);
    let left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

    setStyle({ top, left });
  }, [position]);

  const show = useCallback(() => {
    setIsVisible(true);
    requestAnimationFrame(calculatePosition);
  }, [calculatePosition]);

  const hide = useCallback(() => {
    setIsVisible(false);
  }, []);

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
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/10 text-[9px] text-slate-400 cursor-help italic font-bold leading-none lowercase"
        tabIndex={0}
        role="note"
        aria-label="More info"
      >
        i
      </span>
      {typeof document !== "undefined" && createPortal(
        <span
          ref={tooltipRef}
          className={`fixed p-2.5 rounded-lg bg-slate-900 border border-white/10 shadow-xl text-[10px] text-slate-300 leading-relaxed text-left font-normal normal-case tracking-normal z-[100] transition-opacity duration-150 ${
            isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          style={{
            top: style.top,
            left: style.left,
            maxWidth: Math.min(maxWidth, typeof window !== "undefined" ? window.innerWidth - 16 : maxWidth),
          }}
        >
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}
