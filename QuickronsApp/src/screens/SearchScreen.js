// SearchScreen — real, fast kitchen + dish search for the customer app.
//
// Two real data sources, no fake results:
//   • Kitchens: filtered client-side from the already-cached ['kitchens'] feed
//     (shared with Home) → instant, zero network.
//   • Dishes:   GET /api/v1/menu?q=  → only active, non-archived dishes from
//     live, KYC-approved kitchens (enforced server-side).
//
// Tapping any result opens that kitchen's storefront (Partner screen, which
// lives in the Home tab's stack).

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import SmartImage from '../components/SmartImage';
import { kitchensApi, menuApi } from '../lib/api';
import { useAuth } from '../state/AuthContext';
import { colors, radii, space } from '../theme';
import { layout } from '../lib/layout';

const QUICK_TERMS = ['Biryani', 'Veg meals', 'Breakfast', 'Healthy', 'Chicken'];

function rupees(paise) {
  return `₹${Math.round(Number(paise || 0) / 100)}`;
}

export default function SearchScreen({ navigation }) {
  const { accessToken } = useAuth();
  const [term, setTerm]       = useState('');
  const [debounced, setDebounced] = useState('');

  // Debounce the typed term so we don't fire a dish request on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(id);
  }, [term]);

  // Kitchens — reuse the cached Home feed; filter client-side (instant).
  const { data: kitchensRaw = [] } = useQuery({
    queryKey: ['kitchens'],
    queryFn:  () => kitchensApi.list(accessToken),
    enabled:  !!accessToken,
    select:   (res) => res.kitchens || res.data || res || [],
    staleTime: 60_000,
  });

  const kitchenResults = useMemo(() => {
    const q = debounced.toLowerCase();
    if (q.length < 1) return [];
    return kitchensRaw
      .map(k => ({
        id:      k.id,
        name:    k.brand || k.businessName || k.name || 'Kitchen',
        tagline: k.tagline || k.cuisineType || '',
        image:   k.bannerImageUrl || k.profileImageUrl || null,
        rating:  k.averageRating || 0,
      }))
      .filter(k =>
        k.name.toLowerCase().includes(q) ||
        (k.tagline && k.tagline.toLowerCase().includes(q)))
      .slice(0, 12);
  }, [kitchensRaw, debounced]);

  // Dishes — server search, only when the term is meaningful.
  const {
    data: dishResults = [],
    isFetching: dishesLoading,
  } = useQuery({
    queryKey: ['dish-search', debounced],
    queryFn:  () => menuApi.search(debounced, accessToken),
    enabled:  !!accessToken && debounced.length >= 2,
    select:   (res) => res.items || [],
    staleTime: 30_000,
  });

  const openKitchen = (partnerId) =>
    navigation.navigate('HomeTab', { screen: 'Partner', params: { partnerId } });

  const hasQuery   = debounced.length >= 1;
  const hasResults = kitchenResults.length > 0 || dishResults.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
     <View style={layout.screen}>
      {/* Search bar */}
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.inkMuted} />
          <TextInput
            style={styles.input}
            value={term}
            onChangeText={setTerm}
            placeholder="Search kitchens or dishes"
            placeholderTextColor={colors.inkMuted}
            autoCorrect={false}
            returnKeyType="search"
            autoFocus
          />
          {term.length > 0 && (
            <Pressable onPress={() => setTerm('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.inkMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>

        {/* Initial state — quick suggestions (real: they just prefill the box) */}
        {!hasQuery ? (
          <View>
            <Text style={styles.hint}>Try searching for</Text>
            <View style={styles.quickWrap}>
              {QUICK_TERMS.map(qt => (
                <Pressable key={qt} onPress={() => setTerm(qt)} style={styles.quickChip}>
                  <Text style={styles.quickChipTxt}>{qt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : !hasResults && !dishesLoading ? (
          /* No results */
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={40} color={colors.inkMuted} />
            <Text style={styles.emptyTitle}>No matches for “{debounced}”</Text>
            <Text style={styles.emptySub}>Try a different dish or kitchen name.</Text>
          </View>
        ) : (
          <>
            {/* Kitchens */}
            {kitchenResults.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Kitchens</Text>
                {kitchenResults.map(k => (
                  <Pressable
                    key={k.id}
                    onPress={() => openKitchen(k.id)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                    <SmartImage
                      uri={k.image}
                      style={styles.thumb}
                      fallback={
                        <View style={[styles.thumb, styles.thumbEmpty]}>
                          <Ionicons name="restaurant" size={20} color={colors.inkMuted} />
                        </View>
                      }
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{k.name}</Text>
                      {k.tagline ? (
                        <Text style={styles.rowSub} numberOfLines={1}>{k.tagline}</Text>
                      ) : null}
                    </View>
                    {k.rating > 0 && (
                      <View style={styles.ratingPill}>
                        <Ionicons name="star" size={11} color={colors.accent} />
                        <Text style={styles.ratingTxt}>{k.rating.toFixed(1)}</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
                  </Pressable>
                ))}
              </>
            )}

            {/* Dishes */}
            {(dishResults.length > 0 || dishesLoading) && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: space.lg }]}>
                  Dishes {dishesLoading ? '' : `· ${dishResults.length}`}
                </Text>
                {dishesLoading && dishResults.length === 0 ? (
                  <View style={styles.inlineLoading}>
                    <ActivityIndicator color={colors.brand} />
                  </View>
                ) : (
                  dishResults.map(d => (
                    <Pressable
                      key={d.id}
                      onPress={() => openKitchen(d.partnerId || d.partner?.id)}
                      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                      <SmartImage
                        uri={d.imageUrl}
                        style={styles.thumb}
                        fallback={
                          <View style={[styles.thumb, styles.thumbEmpty]}>
                            <Ionicons name="fast-food-outline" size={20} color={colors.inkMuted} />
                          </View>
                        }
                      />
                      <View style={{ flex: 1 }}>
                        <View style={styles.dishNameRow}>
                          <View style={[styles.vegDot, { borderColor: d.isVeg ? colors.success : colors.danger }]}>
                            <View style={[styles.vegInner, { backgroundColor: d.isVeg ? colors.success : colors.danger }]} />
                          </View>
                          <Text style={styles.rowName} numberOfLines={1}>{d.name}</Text>
                        </View>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {d.partner?.brand ? `${d.partner.brand} · ` : ''}{rupees(d.pricePaise)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
                    </Pressable>
                  ))
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
     </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: space.lg, paddingVertical: space.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bgAlt, borderRadius: radii.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, fontSize: 15, color: colors.ink, padding: 0 },

  hint: { fontSize: 13, color: colors.inkSoft, fontWeight: '700', marginBottom: 10 },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border,
  },
  quickChipTxt: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.inkSoft, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowPressed: { opacity: 0.6 },
  thumb: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.bgAlt },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  rowSub: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  dishNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vegDot: {
    width: 12, height: 12, borderWidth: 1.5, borderRadius: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  vegInner: { width: 5, height: 5, borderRadius: 3 },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.accent + '18', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
  },
  ratingTxt: { fontSize: 11, fontWeight: '800', color: colors.inkSoft },
  inlineLoading: { paddingVertical: space.lg, alignItems: 'center' },

  empty: { alignItems: 'center', paddingVertical: space.xxl, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  emptySub: { fontSize: 13, color: colors.inkSoft, textAlign: 'center' },
});
