import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PartnerCard from '../components/PartnerCard';
import { PARTNERS, ZONE } from '../data/mockData';
import { colors, radii, space } from '../theme';
import { useCart } from '../state/CartContext';
import { useI18n } from '../i18n';

const FILTER_IDS = ['all', 'forra', 'homeMaker', 'hotel', 'caterer'];

export default function HomeScreen({ navigation }) {
  const { t, lang, setLang } = useI18n();
  const [tab, setTab] = useState('now');     // 'now' (Ippol) | 'preorder'
  const [filter, setFilter] = useState('all');
  const { items } = useCart();

  const filtered = useMemo(() => {
    let list = PARTNERS;
    if (filter !== 'all') list = list.filter(p => p.segment === filter);
    if (tab === 'now') list = list.filter(p => p.etaMins <= 45);
    return list;
  }, [tab, filter]);

  const cartCount = items.reduce((s, i) => s + i.qty, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.greeting_morning') : t('home.greeting_evening');
  const filterLabel = id => t(`home.filters.${id === 'homeMaker' ? 'home' : id}`);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet} numberOfLines={1}>
            {greeting}, Shakeeb
          </Text>
          <View style={styles.locRow}>
            <Ionicons name="location" size={14} color={colors.brand} />
            <Text style={styles.loc}>
              {lang === 'ml' ? ZONE.nameMl : ZONE.name}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.inkMuted} />
          </View>
        </View>

        {/* Language toggle */}
        <Pressable
          onPress={() => setLang(lang === 'ml' ? 'en' : 'ml')}
          style={styles.langPill}>
          <Ionicons name="language" size={14} color={colors.ink} />
          <Text style={styles.langTxt}>{lang === 'ml' ? 'മലയാളം' : 'English'}</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
          <Ionicons name="person" size={18} color={colors.bg} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Forra spotlight */}
        <Pressable
          onPress={() => navigation.navigate('Partner', { partnerId: 'forra-flagship' })}
          style={styles.forraCard}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1633237308525-cd587cf71926?w=900' }}
            style={styles.forraImg}
          />
          <View style={styles.forraOverlay}>
            <Text style={styles.forraTag}>{t('home.forra_spotlight_tag')}</Text>
            <Text style={styles.forraTitle}>{t('home.forra_spotlight_title')}</Text>
            <Text style={styles.forraSub}>{t('home.forra_spotlight_sub')}</Text>
          </View>
        </Pressable>

        {/* Tabs — Ippol vs Pre-order */}
        <View style={styles.tabs}>
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

        {/* Partner list */}
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          <Text style={styles.sectionTitle}>
            {t('home.section_kitchens', { count: filtered.length })}
          </Text>
          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <PartnerCard
                partner={{ ...item, name: lang === 'ml' && item.nameMl ? item.nameMl : item.name,
                                    tagline: lang === 'ml' && item.taglineMl ? item.taglineMl : item.tagline }}
                onPress={() => navigation.navigate('Partner', { partnerId: item.id })}
              />
            )}
          />
        </View>

        <View style={{ height: 100 }} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md,
  },
  greet: { fontSize: 17, fontWeight: '700', color: colors.ink },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  loc: { fontSize: 13, color: colors.inkSoft, fontWeight: '600' },
  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border,
  },
  langTxt: { fontSize: 12, fontWeight: '700', color: colors.ink },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  forraCard: {
    margin: space.lg, borderRadius: radii.lg, overflow: 'hidden', height: 170,
  },
  forraImg: { width: '100%', height: '100%' },
  forraOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.78)', padding: space.md,
  },
  forraTag: { fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 1 },
  forraTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 2 },
  forraSub: { fontSize: 13, color: '#E2E8F0', marginTop: 4 },
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
