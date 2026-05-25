// Quickrons brand theme — bright orange identity (matches the wordmark logo).
export const colors = {
  bg: '#FFFFFF',
  bgAlt: '#F8FAFC',
  ink: '#0F172A',
  inkSoft: '#475569',
  inkMuted: '#94A3B8',

  // ── Brand ──────────────────────────────────────────────────────────
  brand:     '#F25C26',   // Quickrons orange (logo)
  brandDark: '#C44A1A',   // pressed / shadow / hover
  brandTint: '#FEF1EC',   // very light orange — for active input bg, soft fills

  // ── Accents (kept) ─────────────────────────────────────────────────
  accent:  '#F59E0B',     // saffron — secondary accent (e.g. signature badges)
  forra:   '#7C2D12',     // deep terracotta — Forra flagship surfaces
  rider:   '#0F766E',     // teal — rider role card
  partner: '#7C3AED',     // purple — partner role card

  border:  '#E2E8F0',
  success: '#16A34A',     // semantic green (delivered / veg dot / health "up")
  danger:  '#DC2626',
};

export const radii = { sm: 8, md: 12, lg: 18, xl: 28 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Typography — display vs body sizes. Use these instead of literal numbers
// when adding new screens; existing screens are fine as-is.
export const type = {
  display:   { fontSize: 28, fontWeight: '800', letterSpacing: -0.3 },
  h1:        { fontSize: 22, fontWeight: '800', letterSpacing: -0.2 },
  h2:        { fontSize: 17, fontWeight: '800' },
  body:      { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  bodyBold:  { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  caption:   { fontSize: 12, fontWeight: '600', color: '#475569' },
  label:     { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: '#475569' },
  mono:      { fontVariant: ['tabular-nums'] },
};

// Elevation — cross-platform shadow + Android elevation tokens.
// Apply by spreading into a style: { ...elevation.card }.
export const elevation = {
  // Subtle card lift — for content cards on the white background.
  card: {
    shadowColor:  '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius:  12,
    shadowOffset:  { width: 0, height: 2 },
    elevation:     1,
  },
  // Strong brand-tinted lift — for primary CTAs.
  ctaBrand: {
    shadowColor:  '#F25C26',
    shadowOpacity: 0.28,
    shadowRadius:  14,
    shadowOffset:  { width: 0, height: 8 },
    elevation:     5,
  },
  // Neutral lift — for secondary CTAs and modal sheets.
  ctaInk: {
    shadowColor:  '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius:  14,
    shadowOffset:  { width: 0, height: 6 },
    elevation:     4,
  },
};
