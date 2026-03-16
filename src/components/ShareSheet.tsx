"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { PersonalSpendingCategory } from "@/lib/spending";
import { renderShareCard, mapSpendingToCard } from "@/lib/share-card";

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  spending: PersonalSpendingCategory[];
  effectiveRate: number;
  taxYear: number;
}

type CardMode = "share" | "classified";

export default function ShareSheet({
  isOpen,
  onClose,
  spending,
  effectiveRate,
  taxYear,
}: ShareSheetProps) {
  const [mode, setMode] = useState<CardMode>("share");
  const [blobError, setBlobError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Compute canvas + preview URL synchronously during render.
  // useMemo avoids any setState-in-effect pattern.
  const { canvas, previewUrl, renderError } = useMemo(() => {
    if (!isOpen) return { canvas: null, previewUrl: null, renderError: null };
    try {
      const cardData = mapSpendingToCard(spending);
      const c = renderShareCard({ spending: cardData, effectiveRate, taxYear, mode });
      return { canvas: c, previewUrl: c.toDataURL("image/png"), renderError: null };
    } catch {
      return { canvas: null, previewUrl: null, renderError: "Couldn't generate image preview." };
    }
  }, [isOpen, mode, spending, effectiveRate, taxYear]);

  const error = renderError ?? blobError;

  // Lock body scroll
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

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => modalRef.current?.focus());
      return () => {
        previousFocusRef.current?.focus();
      };
    }
  }, [isOpen]);

  const handleDownload = useCallback(() => {
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        setBlobError("Couldn't generate image. Try again.");
        return;
      }
      setBlobError(null);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "common-cents-receipt.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [canvas]);

  const handleShare = useCallback(async () => {
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setBlobError("Couldn't generate image. Try again.");
        return;
      }
      setBlobError(null);
      const file = new File([blob], "common-cents-receipt.png", {
        type: "image/png",
      });
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: "Common Cents — Your Federal Tax Receipt",
            files: [file],
          });
        } else {
          handleDownload();
        }
      } catch {
        // User cancelled share — ignore
      }
    }, "image/png");
  }, [canvas, handleDownload]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [tabindex]:not([tabindex="-1"])',
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
    [onClose],
  );

  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function";

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

          {/* Sheet */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-sheet-title"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 100 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 100 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
            className="fixed inset-x-4 bottom-4 top-auto sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-sm sm:bottom-8 z-50 outline-none"
          >
            <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
                <h2
                  id="share-sheet-title"
                  className="text-sm font-semibold text-white"
                >
                  Share Your Breakdown
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="text-slate-400 hover:text-white transition-colors text-xl leading-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                >
                  &times;
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Mode toggle */}
                <div
                  role="radiogroup"
                  aria-label="Card style"
                  className="flex rounded-lg bg-white/5 p-1"
                >
                  {(["share", "classified"] as const).map((m) => (
                    <button
                      key={m}
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setMode(m)}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        mode === m
                          ? "bg-indigo-500/20 text-indigo-400"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {m === "share" ? "Share" : "Classified"}
                    </button>
                  ))}
                </div>

                {/* Preview */}
                {previewUrl && (
                  <div className="rounded-lg overflow-hidden border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL from canvas, next/image adds no value */}
                    <img
                      src={previewUrl}
                      alt="Preview of share card showing top federal spending categories"
                      className="w-full aspect-square"
                    />
                  </div>
                )}

                {error && (
                  <div className="text-center space-y-2">
                    <p className="text-xs text-red-400">{error}</p>
                    <button
                      onClick={async () => {
                        const top3 = spending.slice(0, 3);
                        const text = `Where do my federal tax dollars go?\n\n${top3.map((s) => `${s.category.name} (${s.percentage.toFixed(1)}%)`).join(", ")}, and more.\n\nSee yours at`;
                        const shareUrl = window.location.origin;
                        if (navigator.share) {
                          try { await navigator.share({ title: "Common Cents", text, url: shareUrl }); } catch {}
                        } else {
                          await navigator.clipboard.writeText(`${text} ${shareUrl}`);
                        }
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer focus:outline-none"
                    >
                      Share as text instead
                    </button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleDownload}
                    disabled={!canvas}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Download Image
                  </button>
                  {canShare && (
                    <button
                      onClick={handleShare}
                      disabled={!canvas}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-lg shadow-indigo-500/25"
                    >
                      Share
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
