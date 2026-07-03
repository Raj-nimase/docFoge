import { Platform } from 'react-native';

// ── Brand palette ─────────────────────────────────────────────────────────────
export const Brand = {
  accent:       '#4F6BED',   // primary blue — matches web app
  accentLight:  '#EEF1FD',
  accentDark:   '#3651C9',
  success:      '#10B981',
  successLight: '#D1FAE5',
  error:        '#EF4444',
  errorLight:   '#FEE2E2',
  warning:      '#F59E0B',
  warningLight: '#FEF3C7',
};

// ── Full colour tokens (light + dark) ─────────────────────────────────────────
export const Colors = {
  light: {
    // navigation / tabs (used by expo-router)
    text:           '#0F172A',
    background:     '#F8FAFC',
    tint:           Brand.accent,
    icon:           '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: Brand.accent,

    // surfaces
    surface:        '#FFFFFF',
    surfaceAlt:     '#F1F5F9',
    border:         '#E2E8F0',
    borderStrong:   '#CBD5E1',

    // text
    textMuted:      '#64748B',
    textSubtle:     '#94A3B8',

    // brand shortcuts
    accent:         Brand.accent,
    accentLight:    Brand.accentLight,
    error:          Brand.error,
    errorLight:     Brand.errorLight,
    success:        Brand.success,
    successLight:   Brand.successLight,
  },
  dark: {
    text:           '#F1F5F9',
    background:     '#0F172A',
    tint:           '#818CF8',
    icon:           '#94A3B8',
    tabIconDefault: '#475569',
    tabIconSelected: '#818CF8',

    surface:        '#1E293B',
    surfaceAlt:     '#0F172A',
    border:         '#1E293B',
    borderStrong:   '#334155',

    textMuted:      '#94A3B8',
    textSubtle:     '#475569',

    accent:         '#818CF8',
    accentLight:    '#1E254A',
    error:          '#F87171',
    errorLight:     '#3B1515',
    success:        '#34D399',
    successLight:   '#064E3B',
  },
};

// ── Spacing scale ─────────────────────────────────────────────────────────────
export const Space = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  '2xl': 32,
  '3xl': 48,
};

// ── Border radii ──────────────────────────────────────────────────────────────
export const Radius = {
  sm:  6,
  md:  10,
  lg:  14,
  xl:  20,
  full: 999,
};

// ── Typography ────────────────────────────────────────────────────────────────
export const Fonts = Platform.select({
  ios: {
    sans:    'system-ui',
    serif:   'ui-serif',
    rounded: 'ui-rounded',
    mono:    'ui-monospace',
  },
  default: {
    sans:    'normal',
    serif:   'serif',
    rounded: 'normal',
    mono:    'monospace',
  },
  web: {
    sans:    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif:   "Georgia, 'Times New Roman', serif",
    rounded: "normal",
    mono:    "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

export const FontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   16,
  lg:   18,
  xl:   22,
  '2xl': 26,
  '3xl': 32,
};
