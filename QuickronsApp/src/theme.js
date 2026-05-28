// Quickrons design tokens.
// Brand palette derived from official Quickrons orange logo.

export const colors = {
  bg:        '#FFFFFF',
  bgAlt:     '#F8FAFC',
  bgWarm:    '#FFF8F5',          // warm tint for active/selected states

  ink:       '#0F172A',
  inkSoft:   '#475569',
  inkMuted:  '#94A3B8',

  // ── Brand ────────────────────────────────────────────────────────────────
  brand:     '#E8500A',          // Quickrons orange (logo reference)
  brandDark: '#C94000',          // pressed / shadow
  brandTint: '#FFF0EA',          // input focus bg, active pill bg

  // ── Accent ───────────────────────────────────────────────────────────────
  accent:    '#F59E0B',          // saffron / star ratings

  // ── Segment identity ─────────────────────────────────────────────────────
  forra:     '#E8500A',          // Forra flagship = brand orange
  homeMaker: '#16A34A',          // home-made green
  hotel:     '#7C3AED',          // premium hotels purple
  caterer:   '#0EA5E9',          // caterers blue

  // ── Utility ──────────────────────────────────────────────────────────────
  rider:   '#0F766E',
  border:  '#E2E8F0',
  success: '#16A34A',
  danger:  '#DC2626',
};

export const radii = { sm: 8, md: 12, lg: 18, xl: 28 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const text = {
  h1: { fontSize: 28, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 22, fontWeight: '700', color: colors.ink },
  h3: { fontSize: 18, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, color: colors.ink },
  muted: { fontSize: 13, color: colors.inkMuted },
};

export const segmentMeta = {
  forra:     { label: 'Forra Foods',    color: colors.forra,     icon: 'flame' },
  homeMaker: { label: 'Home Made',      color: colors.homeMaker, icon: 'home' },
  // Internal key remains `hotel` to avoid churning the HomeScreen filter ids;
  // the user-facing label is "Restaurant".
  hotel:     { label: 'Restaurant',     color: colors.hotel,     icon: 'business' },
  caterer:   { label: 'Caterer',        color: colors.caterer,   icon: 'people' },
  // backend businessType aliases
  FORRA_KITCHEN: { label: 'Forra Foods', color: colors.forra,     icon: 'flame' },
  HOME_MAKER:    { label: 'Home Made',   color: colors.homeMaker, icon: 'home' },
  HOTEL:         { label: 'Restaurant',  color: colors.hotel,     icon: 'business' },
  RESTAURANT:    { label: 'Restaurant',  color: colors.hotel,     icon: 'business' },
  CATERER:       { label: 'Caterer',     color: colors.caterer,   icon: 'people' },
};
