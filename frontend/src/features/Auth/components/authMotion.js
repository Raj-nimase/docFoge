/** Shared motion constants for the auth experience. */

// House easing — matches the app-wide cubic-bezier(0.16, 1, 0.3, 1)
export const EASE = [0.16, 1, 0.3, 1];
export const EASE_IN = [0.4, 0, 1, 1];

/** Entrance choreography for the shell + its direct children. */
export const shellVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: EASE, when: 'beforeChildren', staggerChildren: 0.08 },
  },
};

export const childVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

/** Direction-aware pane slide (mode switches + forgot steps). */
export const paneVariants = {
  enter: (dir) => ({ x: dir * 44, opacity: 0 }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: EASE, staggerChildren: 0.05, delayChildren: 0.04 },
  },
  exit: (dir) => ({
    x: dir * -44,
    opacity: 0,
    transition: { duration: 0.25, ease: EASE_IN },
  }),
};

/** Individual field cascade — propagated from paneVariants via variants inheritance. */
export const fieldVariants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};
