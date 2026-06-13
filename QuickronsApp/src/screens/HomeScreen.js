import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import PartnerCard from '../components/PartnerCard';
import { ZONE } from '../data/mockData';
import { kitchensApi } from '../lib/api';
import { colors, radii, space } from '../theme';
import { layout } from '../lib/layout';
import { useCart } from '../state/CartContext';
import { useAuth } from '../state/AuthContext';
import { useI18n } from '../i18n';

// Lightweight skeleton placeholder — gives the home a sense of "instant" while
// the kitchens query resolves, instead of a lone spinner on a blank screen.
function KitchenSkeleton() {
  return (
    <View style={styles.skelCard}>
      <View style={styles.skelImg} />
      <View style={{ padding: space.md, gap: 8 }}>
        <View style={[styles.skelLine, { width: '40%', height: 12 }]} />
        <View style={[styles.skelLine, { width: '70%', height: 16 }]} />
        <View style={[styles.skelLine, { width: '55%' }]} />
      </View>
    </View>
  );
}

// Inline wordmark — avoids an extra component file import
function QuickronsWordmark() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ justifyContent: 'center', marginRight: 2 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{
            width: 5, height: 3, borderRadius: 2,
            backgroundColor: colors.brand,
            marginBottom: i < 2 ? 2 : 0,
          }} />
        ))}
      </View>
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.brand, letterSpacing: -0.3 }}>
        quickrons
      </Text>
    </View>
  );
}

// Backend businessType (PartnerCategory enum) → frontend filter segment
const TYPE_TO_SEGMENT = {
  FORRA_KITCHEN:  'forra',
  FORRA_SUPPLIER: 'forra',      // schema enum value
  HOME_MAKER:     'homeMaker',
  HOTEL:          'hotel',      // legacy alias kept for safety
  RESTAURANT:     'hotel',      // actual schema enum value for hotel-style partners
  CATERER:        'caterer',
};

// Customer-facing categories: Forra Kitchen (flagship), Grocery (Forra packaged
// goods — future), Home Kitchen, Restaurants. Catering is hidden for now.
const FILTER_IDS = ['all', 'forra', 'grocery', 'homeMaker', 'hotel'];

// Normalise a backend kitchen into the shape PartnerCard + HomeScreen expect.
// The live backend (kitchens route) returns: brand, category, zone{}, tagline,
// profileImageUrl, bannerImageUrl. Older field names (businessName/businessType/
// city) are kept as fallbacks so this is resilient to either shape.
function normaliseKitchen(k) {
  return {
    id:       k.id,
    name:     k.brand || k.businessName || k.name || 'Kitchen',
    nameMl:   k.businessNameMl || k.brand || k.businessName || '',
    segment:  TYPE_TO_SEGMENT[k.category || k.businessType] || 'hotel',
    tagline:  k.tagline        || k.cuisineType || '',
    taglineMl:k.taglineMl      || k.tagline || k.cuisineType || '',
    rating:   k.averageRating  || 0,
    reviews:  k.reviewCount    || 0,
    etaMins:  k.avgDeliveryMinutes || 30,
    badges:   k.badges         || [],
    location: k.city           || k.zone?.nameEn || k.addressLine || '',
    image:    k.bannerImageUrl || k.profileImageUrl || null,
  };
}

export default function HomeScreen({ navigation }) {
  const { t, lang, setLang } = useI18n();
  const [tab,    setTab]    = useState('now');     // 'now' | 'preorder'
  const [filter, setFilter] = useState('all');
  const { items } = useCart();
  const { accessToken, user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['kitchens'],
    queryFn:  () => kitchensApi.list(accessToken),
    enabled:  !!accessToken,
    select:   (res) => (res.kitchens || res.data || res || []).map(normaliseKitchen),
    staleTime: 60_000,
  });

  const kitchens = data || [];

  const filtered = useMemo(() => {
    let list = kitchens;
    if (filter !== 'all') list = list.filter(p => p.segment === filter);
    return list;
  }, [kitchens, filter]);

  const cartCount = items.reduce((s, i) => s + i.qty, 0);
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? t('home.greeting_morning') : t('home.greeting_evening');
  const filterLabel = id => t(`home.filters.${id === 'homeMaker' ? 'home' : id}`);
  const displayName = user?.name || user?.phone || 'there';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
     <View style={layout.screen}>
      {/* Header */}
      <View style={styles.header}>
        {/* Brand wordmark */}
        <QuickronsWordmark />

        {/* Location — single beta zone, so this is a clean static label, not a
            fake "change location" dropdown (no dead affordance). */}
        <View style={styles.locRow}>
          <Ionicons name="location" size={12} color={colors.brand} />
          <Text style={styles.loc} numberOfLines={1}>
            {lang === 'ml' ? ZONE.nameMl : ZONE.name}
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* Language toggle */}
        <Pressable
          onPress={() => setLang(lang === 'ml' ? 'en' : 'ml')}
          style={styles.langPill}>
          <Ionicons name="language" size={13} color={colors.inkSoft} />
          <Text style={styles.langTxt}>{lang === 'ml' ? 'ML' : 'EN'}</Text>
        </Pressable>

        {/* My orders — real destination (recent order activity) */}
        <Pressable
          onPress={() => navigation.navigate('MyOrders')}
          style={styles.iconBtn}
          hitSlop={6}>
          <Ionicons name="receipt-outline" size={20} color={colors.inkSoft} />
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
          <Ionicons name="person" size={16} color="#fff" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Beta hero — brand-forward, beta-safe (no fake discounts) */}
        <View style={styles.hero}>
          <View style={styles.heroTagPill}>
            <Ionicons name="sparkles" size={11} color={colors.brand} />
            <Text style={styles.heroTagTxt}>For Smart People</Text>
          </View>
          <Text style={styles.heroTitle}>
            {greeting}, {displayName} 👋
          </Text>
          <Text style={styles.heroSub}>
            Fresh, local kitchens in {lang === 'ml' ? ZONE.nameMl : ZONE.name} — ready when you are.
          </Text>
        </View>
        {/* Tabs — Ippol vs Pre-order */}
        <View style={[styles.tabs, { marginTop: space.md }]}>
          <Pressable
            onPress={() => setTab('now')}
            style={[styles.tabBtn, tab === 'now' && styles.tabActive]}>
            <Text style={[styles.tabLabel, tab === 'now' && styles.tabLabelActive]}>
              {t('home.tabs.now')}
            </Text>
            <Text style={[styles.tabDesc, tab === 'now' && { color: colors.bg, opacity: 0.85 }]}>
              {t('home.tabs.now_desc')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('preorder')}
            style={[styles.tabBtn, tab === 'preorder' && styles.tabActive]}>
            <Text style={[styles.tabLabel, tab === 'preorder' && styles.tabLabelActive]}>
              {t('home.tabs.preorder')}
            </Text>
            <Text style={[styles.tabDesc, tab === 'preorder' && { color: colors.bg, opacity: 0.85 }]}>
              {t('home.tabs.preorder_desc')}
            </Text>
          </Pressable>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}>
          {FILTER_IDS.map(id => (
            <Pressable
              key={id}
              onPress={() => setFilter(id)}
              style={[styles.chip, filter === id && styles.chipActive]}>
              <Text style={[styles.chipTxt, filter === id && { color: colors.bg }]}>
                {filterLabel(id)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Kitchen list */}
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          {isLoading ? (
            <>
              <View style={[styles.skelLine, { width: '50%', marginBottom: space.md }]} />
              {[0, 1, 2].map(i => <KitchenSkeleton key={i} />)}
            </>
          ) : isError ? (
            <View style={styles.center}>
              <Ionicons name="cloud-offline-outline" size={36} color={colors.inkMuted} />
              <Text style={styles.statusTxt}>Couldn't load kitchens</Text>
              <Pressable onPress={refetch} style={styles.retryBtn}>
                <Text style={styles.retryTxt}>Retry</Text>
              </Pressable>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.center}>
              <Ionicons
                name={filter === 'grocery' ? 'basket-outline' : 'restaurant-outline'}
                size={36}
                color={colors.inkMuted}
              />
              <Text style={styles.statusTxt}>
                {filter === 'grocery'
                  ? 'Grocery is coming soon — Forra coconut oil, sprouted ragi, spices & more.'
                  : 'No kitchens available right now'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                {t('home.section_kitchens', { count: filtered.length })}
              </Text>
              <FlatList
                data={filtered}
                keyExtractor={i => i.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <PartnerCard
                    partner={{
                      ...item,
                      name:    lang === 'ml' && item.nameMl    ? item.nameMl    : item.name,
                      tagline: lang === 'ml' && item.taglineMl ? item.taglineMl : item.tagline,
                    }}
                    onPress={() => navigation.navigate('Partner', { partnerId: item.id })}
                  />
                )}
              />
            </>
          )}
        </View>

        {/* Bottom clearance: only reserve room for the floating cart when it's
            actually shown — avoids a large blank gap on an empty cart. */}
        <View style={{ height: cartCount > 0 ? 96 : space.lg }} />
      </ScrollView>

      {/* Floating cart */}
      {cartCount > 0 && (
        <Pressable onPress={() => navigation.navigate('Cart')} style={styles.fab}>
          <View style={styles.fabBadge}>
            <Text style={styles.fabBadgeTxt}>{cartCount}</Text>
          </View>
          <Ionicons name="bag" size={18} color={colors.bg} />
          <Text style={styles.fabTxt}>{t('cart.view_cart')}</Text>
        </Pressable>
      )}
     </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  locRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border,
    maxWidth: 130,
  },
  loc: { fontSize: 11, color: colors.inkSoft, fontWeight: '700', flexShrink: 1 },
  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999,
    backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border,
  },
  langTxt: { fontSize: 11, fontWeight: '800', color: colors.inkSoft },
  iconBtn: { padding: 4 },
  avatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Beta hero ──────────────────────────────────────────────────────────────
  hero: {
    marginHorizontal: space.lg, marginTop: space.md,
    backgroundColor: colors.bgWarm, borderRadius: radii.lg,
    padding: space.lg, borderWidth: 1, borderColor: colors.brandTint,
  },
  heroTagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: colors.bg, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.brandTint,
  },
  heroTagTxt: { fontSize: 11, fontWeight: '800', color: colors.brand, letterSpacing: 0.2 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 10 },
  heroSub: { fontSize: 13, color: colors.inkSoft, marginTop: 4, lineHeight: 18 },

  // ── Skeletons ────────────────────────────────────────────────────────────────
  skelCard: {
    backgroundColor: colors.bg, borderRadius: radii.lg, marginBottom: space.md,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
  },
  skelImg: { width: '100%', height: 148, backgroundColor: colors.bgAlt },
  skelLine: { height: 13, borderRadius: 6, backgroundColor: colors.bgAlt },
  tabs: { flexDirection: 'row', gap: 10, paddingHorizontal: space.lg },
  tabBtn: {
    flex: 1, padding: space.md, borderRadius: radii.lg,
    backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabLabel: { fontSize: 16, fontWeight: '800', color: colors.ink },
  tabLabelActive: { color: colors.bg },
  tabDesc: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  filterBar: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipTxt: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.inkSoft, marginBottom: space.md },
  center: { alignItems: 'center', paddingVertical: space.xl, gap: 10 },
  statusTxt: { fontSize: 14, color: colors.inkSoft, fontWeight: '600' },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: radii.md,
    backgroundColor: colors.brand, marginTop: 4,
  },
  retryTxt: { color: '#fff', fontWeight: '700' },
  fab: {
    position: 'absolute', bottom: 18, left: 18, right: 18,
    backgroundColor: colors.brand, borderRadius: radii.lg,
    paddingVertical: 14, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: colors.brand, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  fabBadge: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2,
  },
  fabBadgeTxt: { fontSize: 12, fontWeight: '800', color: colors.brand },
  fabTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
