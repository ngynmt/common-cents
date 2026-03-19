"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  onZipSubmit?: (zip: string) => void;
}

export default function RepresentativesModal({
  isOpen,
  onClose,
  representatives,
  votes,
  financeData,
  onZipSubmit,
}: RepresentativesModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [zipInput, setZipInput] = useState("");
  const [zipSubmitted, setZipSubmitted] = useState(false);
  const hasReps = representatives.length > 0;
  const zipLoading = zipSubmitted && !hasReps;

  // Lock body scroll when modal is open to prevent backdrop gap on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      };
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

  const handleZipSubmit = useCallback(() => {
    if (!onZipSubmit || zipInput.length < 5) return;
    setZipSubmitted(true);
    onZipSubmit(zipInput);
  }, [onZipSubmit, zipInput]);

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
            <div className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col max-h-full">
              {/* Header */}
              <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
                <h2 id="reps-modal-title" className="text-lg font-semibold text-text-primary">
                  Your Representatives
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="text-text-secondary hover:text-text-primary transition-colors text-xl leading-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset rounded"
                >
                  &times;
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3 overflow-y-auto flex-1">
                {hasReps ? (
                  <>
                    <p className="text-xs text-text-secondary">
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
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <div className="text-4xl" aria-hidden="true">🏛️</div>
                    <p className="text-sm text-text-secondary text-center max-w-xs">
                      Enter your ZIP code to see how your representatives voted on spending decisions.
                    </p>
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleZipSubmit(); }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={5}
                        placeholder="ZIP code"
                        value={zipInput}
                        onChange={(e) => setZipInput(e.target.value.replace(/\D/g, ""))}
                        className="w-28 px-3 py-2 rounded-lg bg-surface-elevated border border-border text-text-primary text-sm text-center placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset focus:border-transparent"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={zipInput.length < 5 || zipLoading}
                        className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
                      >
                        {zipLoading ? "Looking up…" : "Look up"}
                      </button>
                    </form>
                    <p className="text-[10px] text-text-muted text-center">
                      We use your ZIP to find your House and Senate representatives.
                      Nothing is stored.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {hasReps && (
                <div className="px-5 py-3 border-t border-border shrink-0">
                  <p className="text-[10px] text-text-secondary text-center">
                    Representative data provided by Geocodio and Congress.gov. Campaign finance data from FEC.gov. Contact info may occasionally be outdated.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
