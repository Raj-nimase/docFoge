/**
 * Central Design Token System
 * Single source of truth for all visual properties.
 * tokensToLatex.js on the backend mirrors these into the LaTeX preamble.
 */
export const tokens = {
  font: {
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },

  scale: {
    h1: { fontSize: '2rem',    lineHeight: 1.2, marginTop: '2.5rem', marginBottom: '0.75rem', fontWeight: 700 },
    h2: { fontSize: '1.5rem',  lineHeight: 1.3, marginTop: '2rem',   marginBottom: '0.6rem',  fontWeight: 600 },
    h3: { fontSize: '1.2rem',  lineHeight: 1.4, marginTop: '1.5rem', marginBottom: '0.5rem',  fontWeight: 600 },
    p:  { fontSize: '1rem',    lineHeight: 1.75, marginTop: '0',     marginBottom: '0.875rem', fontWeight: 400 },
    li: { fontSize: '1rem',    lineHeight: 1.7,  marginTop: '0',     marginBottom: '0.25rem',  fontWeight: 400 },
  },

  color: {
    bg:           '#0a0b0f',
    surface:      '#12141e',
    surfaceHover: '#1a1d2e',
    card:         '#1e2235',
    border:       '#252840',
    borderHover:  '#383d5c',
    accent:       '#7c3aed',
    accentLight:  '#a78bfa',
    accentGlow:   'rgba(124, 58, 237, 0.25)',
    cyan:         '#06b6d4',
    cyanGlow:     'rgba(6, 182, 212, 0.2)',
    text:         '#f1f5f9',
    textMuted:    '#8892a4',
    textFaint:    '#4a5568',
    success:      '#10b981',
    warning:      '#f59e0b',
    error:        '#ef4444',
    paperBg:      '#ffffff',
    paperText:    '#1a1a2e',
  },

  spacing: {
    pagePaddingX: '3.5rem',
    pagePaddingY: '2.5rem',
    blockGap:     '0.25rem',
    canvasMaxW:   '760px',
  },

  radius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '24px',
  },

  shadow: {
    card:   '0 4px 24px rgba(0,0,0,0.4)',
    glow:   '0 0 32px rgba(124, 58, 237, 0.3)',
    paper:  '0 8px 48px rgba(0,0,0,0.6)',
  },

  /** LaTeX equivalents (used by tokensToLatex.js on backend) */
  latex: {
    default: {
      topMargin:    '2.54cm',
      bottomMargin: '2.54cm',
      leftMargin:   '3.17cm',
      rightMargin:  '3.17cm',
      fontSize:     '11pt',
      lineSpread:   '1.3',
      font:         'lmodern',
    },
    academic: {
      topMargin:    '2.54cm',
      bottomMargin: '2.54cm',
      leftMargin:   '3.81cm',
      rightMargin:  '3.81cm',
      fontSize:     '12pt',
      lineSpread:   '1.6',
      font:         'lmodern',
    },
  },
};

export default tokens;
