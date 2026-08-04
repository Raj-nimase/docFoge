// Shared motion vocabulary for the Landing page.
// Mirrors features/Dashboard/dashboardMotion.js so the whole app
// shares one motion language. Durations lean slightly longer than the
// dashboard's to match the glide of Lenis smooth scrolling.

export const EASE = [0.16, 1, 0.3, 1];
export const EASE_IN = [0.4, 0, 1, 1];

/* Hero entrance — cascade fragments, demo, CTAs on load */
export const heroVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: EASE,
      when: 'beforeChildren',
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
};

/* Hero fragments also carry scroll parallax — keep them transform/opacity
   only (no filter) so they stay on the compositor and move smoothly. */
export const heroItemVariants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE },
  },
};

/* The demo card gets a slightly longer, scaled entrance */
export const heroDemoVariants = {
  hidden: { opacity: 0, y: 34, scale: 0.96, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.85, ease: EASE },
  },
};

/* Below-fold sections — reveal once when scrolled into view */
export const revealVariants = {
  hidden: { opacity: 0, y: 28, filter: 'blur(5px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.65, ease: EASE },
  },
};

export const revealViewport = { once: true, amount: 0.25 };

/* Feature card grids — stagger their cards */
export const cardStaggerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.3, ease: EASE, staggerChildren: 0.08 },
  },
};

export const cardVariants = {
  hidden: { opacity: 0, y: 22, filter: 'blur(4px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: EASE },
  },
};

/* Shared hover lift (matches dashboard cards) */
export const hoverLift = { y: -4, transition: { duration: 0.2, ease: EASE } };

/* Gentle perpetual drift — support copy only, never headlines or the demo */
export const floatSlow = {
  animate: { y: [0, -6, 0] },
  transition: { duration: 7, repeat: Infinity, ease: 'easeInOut' },
};

/* Preview blocks appearing inside the hero demo A4 page */
export const demoBlockVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};
