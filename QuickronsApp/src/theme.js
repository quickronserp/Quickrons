// Quickrons design tokens. One place to tune brand look.
export const colors = {
  bg: '#FFFFFF',
  bgAlt: '#F8FAFC',
  ink: '#0F172A',
  inkSoft: '#475569',
  inkMuted: '#94A3B8',
  brand: '#15803D',          // Malabar green (Kerala launch palette)
  brandDark: '#166534',
  accent: '#F59E0B',          // saffron
  forra: '#7C2D12',           // Forra Foods deep terracotta
  premium: '#7C3AED',         // premium / hotels
  homeMaker: '#15803D',       // home-made green
  caterer: '#0EA5E9',         // caterers blue
  rider: '#0F766E',
  border: '#E2E8F0',
  success: '#16A34A',
  danger: '#DC2626',
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
  forra: { label: 'Forra Foods', color: colors.forra, icon: 'flame' },
  homeMaker: { label: 'Home Made', color: colors.homeMaker, icon: 'home' },
  hotel: { label: 'Premium Hotel', color: colors.premium, icon: 'business' },
  caterer: { label: 'Caterer', color: colors.caterer, icon: 'people' },
};
