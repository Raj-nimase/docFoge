// Shared motion vocabulary for the Dashboard area.
// Mirrors the proven patterns in features/Auth/components/authMotion.js
// so the whole app shares one motion language.

export const EASE = [0.16, 1, 0.3, 1];
export const EASE_IN = [0.4, 0, 1, 1];

export const SPRING_MODAL = { type: 'spring', stiffness: 450, damping: 30 };
export const SPRING_PILL = { type: 'spring', stiffness: 400, damping: 34 };

export const SIDEBAR_WIDTH = 250;
export const SIDEBAR_COLLAPSED = 68;

/* Page root: fade + rise, then cascade children */
export const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: EASE,
      when: 'beforeChildren',
      staggerChildren: 0.07,
      delayChildren: 0.02,
    },
  },
};

/* Sections within a page */
export const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

/* Grid containers — stagger their cards */
export const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

/* Cards inside grids */
export const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: EASE } },
};

/* Dropdown panels (notifications) — pair with CSS transform-origin */
export const dropdownVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -6 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
  exit: { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.15, ease: EASE_IN } },
};

/* Modal backdrop + panel */
export const backdropVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: SPRING_MODAL },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.18, ease: EASE_IN } },
};

/* Shared hover lift for cards */
export const hoverLift = { y: -4, transition: { duration: 0.2, ease: EASE } };
