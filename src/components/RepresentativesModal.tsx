"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Representative, VoteRecord } from "@/data/representatives";
import RepresentativeCard from "./RepresentativeCard";

interface RepresentativesModalProps {
  isOpen: boolean;
  onClose: () => void;
  representatives: Representative[];
  votes: VoteRecord[];
}

export default function RepresentativesModal({
  isOpen,
  onClose,
  representatives,
  votes,
}: RepresentativesModalProps) {
  // Lock body scroll when modal is open to prevent backdrop gap on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

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
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-x-4 top-[10%] bottom-[10%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-50 flex flex-col"
          >
            <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden flex flex-col max-h-full">
              {/* Header */}
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-semibold text-white">
                  Your Representatives
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition-colors text-xl leading-none cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3 overflow-y-auto flex-1">
                <p className="text-xs text-gray-500">
                  Based on your ZIP code. Contact your representatives about any
                  spending issue that matters to you.
                </p>

                {representatives.map((rep) => (
                  <RepresentativeCard
                    key={rep.id}
                    rep={rep}
                    votes={getRepVotes(rep.id)}
                  />
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-white/10 shrink-0">
                <p className="text-[10px] text-gray-600 text-center">
                  Representative data provided by Geocodio and Congress.gov. Contact info may occasionally be outdated.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
