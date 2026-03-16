/** Shared cubic-bezier easing for all Framer Motion transitions */
export const EASE_OUT_CUBIC = [0.33, 1, 0.68, 1] as const;

/** Standard transition preset for component animations */
export const TRANSITION_DEFAULT = {
  duration: 0.3,
  ease: EASE_OUT_CUBIC,
} as const;

/** Stagger delay between list items */
export const STAGGER_DELAY = 0.05;
