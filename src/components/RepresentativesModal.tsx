"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Representative, VoteRecord } from "@/data/representatives";
import type { CampaignFinanceSummary } from "@/data/campaign-finance";
import RepresentativeCard from "./RepresentativeCard";

interface RepresentativesModalProps {
  isOpen: boolean;
  onClose: () => void;
  representatives: Representative[];
  votes: VoteRecord[];
  financeData?: Record<string, CampaignFinanceSummary | null>;
}

export default function RepresentativesModal({
  isOpen,
  onClose,
  representatives,
  votes,
  financeData,
}: RepresentativesModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Lock body scroll when modal is open to prevent backdrop gap on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  // Focus trap and restore focus on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the modal container after animation starts
      requestAnimationFrame(() => modalRef.current?.focus());
      return () => {
        previousFocusRef.current?.focus();
      };
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  const getRepVotes = (repId: string) =>
    votes.filter((v) => v.representativeId === repId);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reps-modal-title"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-x-4 top-[10%] bottom-[10%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-50 flex flex-col outline-none"
          >
            <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden flex flex-col max-h-full">
              {/* Header */}
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <h2 id="reps-modal-title" className="text-lg font-semibold text-white">
                  Your Representatives
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="text-slate-400 hover:text-white transition-colors text-xl leading-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                >
                  &times;
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3 overflow-y-auto flex-1">
                <p className="text-xs text-slate-400">
                  Based on your ZIP code. Contact your representatives about any
                  spending issue that matters to you.
                </p>

                {representatives.map((rep) => (
                  <RepresentativeCard
                    key={rep.id}
                    rep={rep}
                    votes={getRepVotes(rep.id)}
                    finance={financeData?.[rep.id]}
                  />
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-white/10 shrink-0">
                <p className="text-[10px] text-slate-400 text-center">
                  Representative data provided by Geocodio and Congress.gov. Campaign finance data from FEC.gov. Contact info may occasionally be outdated.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
