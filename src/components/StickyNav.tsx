"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TabId } from "./SecondaryTabs";

interface StickyNavProps {
  activeSecondaryTab: TabId;
  onTabChange: (tab: TabId) => void;
  hidden?: boolean;
}

interface NavItem {
  label: string;
  targetId: string;
  tabSwitch?: TabId;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Receipt", targetId: "section-receipt" },
  { label: "Trends", targetId: "section-trends" },
  { label: "Legislation", targetId: "secondary-tabs", tabSwitch: "bills" },
  { label: "Spending", targetId: "secondary-tabs", tabSwitch: "spending" },
  { label: "Compare", targetId: "secondary-tabs", tabSwitch: "compare" },
];

const SCROLL_THRESHOLD = 5;
const SUPPRESSION_MS = 600;

export default function StickyNav({ activeSecondaryTab, onTabChange, hidden }: StickyNavProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("receipt");
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const suppressUntil = useRef(0);

  // Scroll direction detection
  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;

        if (Date.now() < suppressUntil.current) {
          lastScrollY.current = currentY;
          ticking.current = false;
          return;
        }

        // Hide near top of page (before receipt card)
        const receiptEl = document.getElementById("section-receipt");
        const receiptBottom = receiptEl
          ? receiptEl.getBoundingClientRect().bottom + currentY
          : 400;

        if (currentY < receiptBottom - 200) {
          setIsVisible(false);
        } else if (Math.abs(delta) > SCROLL_THRESHOLD) {
          setIsVisible(delta < 0); // scroll-up = show, scroll-down = hide
        }

        lastScrollY.current = currentY;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // IntersectionObserver for active section
  useEffect(() => {
    const ids = ["section-receipt", "section-trends", "secondary-tabs"];
    const elements = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        let topSection: string | null = null;
        let topY = Infinity;

        for (const entry of entries) {
          if (entry.isIntersecting && entry.boundingClientRect.top < topY) {
            topY = entry.boundingClientRect.top;
            topSection = entry.target.id;
          }
        }

        if (topSection) {
          if (topSection === "secondary-tabs") {
            // Defer to the active tab prop
            setActiveSection(activeSecondaryTab);
          } else if (topSection === "section-receipt") {
            setActiveSection("receipt");
          } else if (topSection === "section-trends") {
            setActiveSection("trends");
          }
        }
      },
      { threshold: [0, 0.25, 0.5] },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [activeSecondaryTab]);

  const handleTap = useCallback(
    (item: NavItem) => {
      // Suppress scroll-direction detection during programmatic scroll
      suppressUntil.current = Date.now() + SUPPRESSION_MS;

      if (item.tabSwitch) {
        onTabChange(item.tabSwitch);
      }

      const el = document.getElementById(item.targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        // Move focus after scroll
        el.setAttribute("tabindex", "-1");
        setTimeout(() => el.focus({ preventScroll: true }), SUPPRESSION_MS);
      }
    },
    [onTabChange],
  );

  // Determine which nav item is active
  const getActiveKey = (item: NavItem): boolean => {
    if (item.tabSwitch) return activeSection === item.tabSwitch;
    if (item.targetId === "section-receipt") return activeSection === "receipt";
    if (item.targetId === "section-trends") return activeSection === "trends";
    return false;
  };

  // Respect prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (hidden) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          role="navigation"
          aria-label="Jump to section"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 lg:hidden"
        >
          <div
            className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-slate-800/90 backdrop-blur-md border border-white/10 shadow-lg overflow-x-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            {NAV_ITEMS.map((item) => {
              const isActive = getActiveKey(item);
              return (
                <button
                  key={item.label}
                  onClick={() => handleTap(item)}
                  aria-current={isActive ? "true" : undefined}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isActive
                      ? "bg-indigo-500/30 text-indigo-400"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
