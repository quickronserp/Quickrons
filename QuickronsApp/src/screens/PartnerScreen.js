import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import SegmentBadge from '../components/SegmentBadge';
import { kitchensApi } from '../lib/api';
import { colors, radii, space } from '../theme';
import { useCart } from '../state/CartContext';
import { useAuth } from '../state/AuthContext';

export default function PartnerScreen({ route, navigation }) {
  const { partnerId } = route.params;
  const { add, items } = useCart();
  const { accessToken } = useAuth();

  const { data: kitchen, isLoading: kitchenLoading } = useQuery({
    queryKey: ['kitchen', partnerId],
    queryFn:  () => kitchensApi.get(partnerId, accessToken),
    enabled:  !!accessToken && !!partnerId,
    select:   (res) => res.kitchen || res.partner || res,
    staleTime: 60_000,
  });

  const { data: menuData, isLoading: menuLoading } = useQuery({
    queryKey: ['kitchen-menu', partnerId],
    queryFn:  () => kitchensApi.menu(partnerId, accessToken),
    enabled:  !!accessToken && !!partnerId,
    select:   (res) => res.items || res.menuItems || res || [],
    staleTime: 60_000,
  });

  const cartCount = items.reduce((s, i) => s + i.qty, 0);
  const menuItems = menuData || [];

  if (kitchenLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!kitchen) {
    return (
      <View style={styles.loadingWrap}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.inkMuted} />
        <Text style={{ color: colors.inkSoft, marginTop: 8 }}>Kitchen not found</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.brand, fontWeight: '700' }}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  // Normalise kitchen fields
  const name     = kitchen.businessName  || kitchen.name     || '';
  const tagline  = kitchen.tagline       || kitchen.cuisineType || '';
  const image    = kitchen.bannerImageUrl|| kitchen.profileImageUrl || null;
  const rating   = kitchen.averageRating || 0;
  const etaMins  = kitchen.avgDeliveryMinutes || 30;
  const location = kitchen.city          || kitchen.addressLine || '';
  const segment  = kitchen.businessType  || kitchen.segment  || 'HOTEL';
  const badges   = kitchen.badges        || [];

  // Cart partner shape — needs a `name` field for CartScreen to display
  const cartPartner = { ...kitchen, name };

  const handleAdd = (menuItem) => {
    if (!menuItem.isAvailable) return;
    add(menuItem, cartPartner);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero banner */}
        <View>
          {image ? (
            <Image source={{ uri: image }} style={styles.hero} />
          ) : (
            <View style={[styles.hero, styles.heroPlaceholder]}>
              <Ionicons name="restaurant" size={48} color={colors.inkMuted} />
            </View>
          )}
          <SafeAreaView style={styles.heroBack} edges={['top']}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.ink} />
            </Pressable>
          </SafeAreaView>
        </View>

        {/* Kitchen info */}
        <View style={styles.body}>
          <SegmentBadge segment={segment} />
          <Text style={styles.name}>{name}</Text>
          {tagline ? <Text style={styles.tag}>{tagline}</Text> : null}

          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Ionicons name="star" size={14} color={colors.accent} />
              <Text style={styles.metaTxt}>{rating > 0 ? rating.toFixed(1) : '—'}</Text>
              <Text style={styles.metaSub}>rating</Text>
            </View>
            <View style={styles.metaCell}>
              <Ionicons name="time-outline" size={14} color={colors.inkSoft} />
              <Text style={styles.metaTxt}>{etaMins} min</Text>
              <Text style={styles.metaSub}>delivery</Text>
            </View>
            <View style={[styles.metaCell, { borderRightWidth: 0 }]}>
              <Ionicons name="location-outline" size={14} color={colors.inkSoft} />
              <Text style={styles.metaTxt} numberOfLines={1}>
                {location.split(',')[0] || 'Kerala'}
              </Text>
              <Text style={styles.metaSub}>kitchen</Text>
            </View>
          </View>

          {badges.length > 0 && (
            <View style={styles.badges}>
              {badges.map(b => (
                <View key={b} style={styles.badge}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.success} />
                  <Text style={styles.badgeTxt}>{b}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.divider} />
          <Text style={styles.menuTitle}>Menu</Text>
        </View>

        {/* Menu items */}
        {menuLoading ? (
          <View style={{ padding: space.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : menuItems.length === 0 ? (
          <View style={{ padding: space.xl, alignItems: 'center' }}>
            <Text style={{ color: colors.inkSoft }}>No menu items available</Text>
          </View>
        ) : (
          menuItems.map(item => (
            <MenuItemRow
              key={item.id}
              item={item}
              cartItems={items}
              onAdd={() => handleAdd(item)}
            />
          ))
        )}
      </ScrollView>

      {/* Floating cart */}
      {cartCount > 0 && (
        <Pressable onPress={() => navigation.navigate('Cart')} style={styles.fab}>
          <View style={styles.fabBadge}>
            <Text style={styles.fabBadgeTxt}>{cartCount}</Text>
          </View>
          <Ionicons name="bag" size={18} color={colors.bg} />
          <Text style={styles.fabTxt}>View cart</Text>
        </Pressable>
      )}
    </View>
  );
}

function MenuItemRow({ item, cartItems, onAdd }) {
  const cartEntry = cartItems.find(i => i.menuItem.id === item.id);
  const qty       = cartEntry?.qty || 0;
  // isAvailable === false → explicitly disabled by partner.
  // dailyQuantityRemaining null/undefined → no daily cap (unlimited); 0 → sold out today.
  const unavailable =
    item.isAvailable === false ||
    (item.dailyQuantityRemaining != null && item.dailyQuantityRemaining <= 0);

  return (
    <View style={[menuStyles.row, unavailable && menuStyles.rowDim]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Veg/non-veg indicator */}
          <View style={[menuStyles.vegDot, { borderColor: item.isVeg ? colors.success : '#C62828' }]}>
            <View style={[menuStyles.vegInner, { backgroundColor: item.isVeg ? colors.success : '#C62828' }]} />
          </View>
          <Text style={menuStyles.name}>{item.name}</Text>
          {item.isSignature && (
            <Ionicons name="star" size={12} color={colors.accent} />
          )}
        </View>
        {item.description ? (
          <Text style={menuStyles.desc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <Text style={menuStyles.price}>₹{Math.round(item.pricePaise / 100)}</Text>
        {unavailable && (
          <Text style={menuStyles.unavailable}>Sold out today</Text>
        )}
      </View>

      {unavailable ? (
        <View style={menuStyles.soldOutBtn}>
          <Text style={menuStyles.soldOutTxt}>Sold out</Text>
        </View>
      ) : qty > 0 ? (
        <View style={menuStyles.addedTag}>
          <Ionicons name="checkmark" size={14} color={colors.success} />
          <Text style={menuStyles.addedTxt}>{qty} added</Text>
        </View>
      ) : (
        <Pressable onPress={onAdd} style={menuStyles.addBtn}>
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  hero: { width: '100%', height: 220, backgroundColor: colors.bgAlt },
  heroPlaceholder: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgAlt,
  },
  heroBack: { position: 'absolute', top: 0, left: 0 },
  backBtn: {
    margin: space.md, width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  body: { padding: space.lg },
  name: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: space.sm },
  tag:  { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  metaRow: {
    flexDirection: 'row', marginTop: space.lg,
    backgroundColor: colors.bgAlt, borderRadius: radii.md, paddingVertical: 12,
  },
  metaCell: {
    flex: 1, alignItems: 'center',
    borderRightWidth: 1, borderRightColor: colors.border,
  },
  metaTxt: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 4 },
  metaSub: { fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: colors.success + '15',
  },
  badgeTxt: { fontSize: 11, fontWeight: '700', color: colors.success },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.lg },
  menuTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  fab: {
    position: 'absolute', bottom: 18, left: 18, right: 18,
    backgroundColor: colors.brand, borderRadius: radii.lg,
    paddingVertical: 14, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: colors.brand, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  fabBadge: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 },
  fabBadgeTxt: { fontSize: 12, fontWeight: '800', color: colors.brand },
  fabTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

const menuStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowDim: { opacity: 0.5 },
  vegDot: {
    width: 14, height: 14, borderRadius: 2, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  vegInner: { width: 6, height: 6, borderRadius: 3 },
  name:   { fontSize: 15, fontWeight: '700', color: colors.ink, flex: 1 },
  desc:   { fontSize: 12, color: colors.inkSoft, marginTop: 4, lineHeight: 17 },
  price:  { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 6 },
  unavailable: { fontSize: 11, color: colors.danger, marginTop: 2, fontWeight: '600' },
  addBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
  },
  soldOutBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  soldOutTxt: { fontSize: 11, color: colors.inkMuted, fontWeight: '600' },
  addedTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.success, backgroundColor: colors.success + '10',
  },
  addedTxt: { fontSize: 12, color: colors.success, fontWeight: '700' },
});
