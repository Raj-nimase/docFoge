/**
 * AcaDoc Design Tokens — Japandi warm-minimalist theme
 * Mirrors frontend/src/styles/japandi-theme.css exactly.
 *
 * Short-form exports (used by new files):  C, S, R, F, shadows
 * Long-form exports (legacy aliases):      Colors, Brand, Space, FontSize, Radius
 */

// ── Core palette ──────────────────────────────────────────────────────────────
export const C = {
  bg:           '#f3efe6',
  surface:      '#faf8f3',
  card:         '#fffcf7',
  cardAlt:      '#f7f3ec',
  border:       '#ddd6c8',
  borderStrong: '#c4b9a8',
  // Accent — forest green
  accent:       '#3d4a3a',
  accentLight:  '#6b7d62',
  accentWarm:   '#9a7b5f',
  accentGlow:   'rgba(61,74,58,0.08)',
  accentMid:    'rgba(61,74,58,0.15)',
  // Text
  text:         '#2c2a26',
  textMuted:    '#6b6560',
  textFaint:    '#9c958c',
  // Aliases used by legacy screens
  textSubtle:   '#9c958c',
  background:   '#f3efe6',
  surfaceAlt:   '#f7f3ec',
  // Status
  success:      '#5a7d6e',
  successBg:    '#eaf2ee',
  successLight: '#eaf2ee',
  error:        '#a64d4d',
  errorBg:      '#f9eeee',
  errorLight:   '#f9eeee',
  warning:      '#b8860b',
  warningBg:    '#fdf6e3',
  white:        '#ffffff',
  black:        '#000000',
  // Editor paper
  editorPaper:  '#ffffff',
  // Tab bar
  tabIconDefault:  '#9c958c',
  tabIconSelected: '#3d4a3a',
  tint:            '#3d4a3a',
  // Sheet
  sheetBg:      '#faf8f3',
  overlay:      'rgba(44,42,38,0.55)',
};

// ── Spacing ───────────────────────────────────────────────────────────────────
export const S = {
  xs:    4,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
};

// ── Radii ─────────────────────────────────────────────────────────────────────
export const R = {
  sm:    4,
  md:    8,
  lg:    12,
  xl:    16,
  '2xl': 24,
  full:  999,
};

// ── Font sizes ────────────────────────────────────────────────────────────────
export const F = {
  xs:    11,
  sm:    13,
  base:  15,
  md:    16,
  lg:    18,
  xl:    22,
  '2xl': 28,
  '3xl': 36,
};

// ── Animation durations ───────────────────────────────────────────────────────
export const Timing = {
  fast:   150,
  normal: 250,
  slow:   350,
};

// ── Shadows ───────────────────────────────────────────────────────────────────
export const shadows = {
  card: {
    shadowColor: '#2c2a26',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  strong: {
    shadowColor: '#2c2a26',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 24,
  },
  toolbar: {
    shadowColor: '#2c2a26',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
};

// ── Legacy aliases (keeps old imports working without touching those files) ───
export const Colors = {
  light: C,
  dark:  C,   // same palette — no dark mode yet
};

export const Brand = {
  accent:      C.accent,
  accentLight: C.accentLight,
  accentWarm:  C.accentWarm,
  success:     C.success,
  error:       C.error,
  warning:     C.warning,
};

export const Space  = S;
export const FontSize = F;
export const Radius   = R;
