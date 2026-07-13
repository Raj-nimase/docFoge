/**
 * AcaDoc Design Tokens — Japandi warm-minimalist theme
 * Mirrors frontend/src/styles/japandi-theme.css exactly.
 *
 * Short-form exports (used by new files):  C, S, R, F, shadows
 * Long-form exports (legacy aliases):      Colors, Brand, Space, FontSize, Radius
 */

// ── Core palette ──────────────────────────────────────────────────────────────
export const C = {
  bg:           '#f7f9fb',
  surface:      '#f7f9fb',
  card:         '#ffffff',
  cardAlt:      '#eceef0',
  border:       '#bfc9c3',
  borderStrong: '#707974',
  // Accent — scholarly dark green
  accent:       '#003527',
  accentLight:  '#2b6954',
  accentWarm:   '#d5e0f8',
  accentGlow:   'rgba(0,53,39,0.06)',
  accentMid:    'rgba(0,53,39,0.12)',
  // AI Accent — Indigo
  aiAccent:     '#6366F1',
  aiAccentGlow: 'rgba(99,102,241,0.08)',
  aiAccentMid:  'rgba(99,102,241,0.15)',
  // Text
  text:         '#191c1e',
  textMuted:    '#404944',
  textFaint:    '#707974',
  // Aliases used by legacy screens
  textSubtle:   '#707974',
  background:   '#f7f9fb',
  surfaceAlt:   '#eceef0',
  // Status
  success:      '#2b6954',
  successBg:    '#b0f0d6',
  successLight: '#b0f0d6',
  error:        '#ba1a1a',
  errorBg:      '#ffdad6',
  errorLight:   '#ffdad6',
  warning:      '#ff9f0d',
  warningBg:    '#ffddb8',
  white:        '#ffffff',
  black:        '#000000',
  // Editor paper
  editorPaper:  '#ffffff',
  // Tab bar
  tabIconDefault:  '#707974',
  tabIconSelected: '#003527',
  tint:            '#003527',
  // Sheet
  sheetBg:      '#f7f9fb',
  overlay:      'rgba(25,28,30,0.4)',
};

// ── Spacing ───────────────────────────────────────────────────────────────────
export const S = {
  xs:    4,
  sm:    8,
  md:    16,
  lg:    24,
  xl:    40,
  '2xl': 48,
  '3xl': 64,
  '4xl': 80,
};

// ── Radii ─────────────────────────────────────────────────────────────────────
export const R = {
  sm:    2,
  md:    4,
  lg:    8,
  xl:    12,
  '2xl': 16,
  full:  999,
};

// ── Font sizes ────────────────────────────────────────────────────────────────
export const F = {
  xs:    12,
  sm:    14,
  base:  16,
  md:    16,
  lg:    18,
  xl:    20,
  '2xl': 24,
  '3xl': 32,
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

// ── Font Families ─────────────────────────────────────────────────────────────
export const Fonts = {
  display:        'Merriweather-Bold',
  playfair:       'PlayfairDisplay-Bold',
  hankenRegular:  'HankenGrotesk-Regular',
  hankenMedium:   'HankenGrotesk-Medium',
  hankenSemiBold: 'HankenGrotesk-SemiBold',
  hankenBold:     'HankenGrotesk-Bold',
  interRegular:   'Inter-Regular',
  interSemiBold:  'Inter-SemiBold',
  mono:           'JetBrainsMono-Medium',
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
