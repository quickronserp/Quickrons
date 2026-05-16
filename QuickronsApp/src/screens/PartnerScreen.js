import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DishCard from '../components/DishCard';
import SegmentBadge from '../components/SegmentBadge';
import { PARTNERS } from '../data/mockData';
import { colors, radii, space } from '../theme';
import { useCart } from '../state/CartContext';

export default function PartnerScreen({ route, navigation }) {
  const { partnerId } = route.params;
  const partner = PARTNERS.find(p => p.id === partnerId);
  const { add, items } = useCart();
  const cartCount = items.reduce((s, i) => s + i.qty, 0);

  if (!partner) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View>
          <Image source={{ uri: partner.image }} style={styles.hero} />
          <SafeAreaView style={styles.heroBack} edges={['top']}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.ink} />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <SegmentBadge segment={partner.segment} />
          <Text style={styles.name}>{partner.name}</Text>
          <Text style={styles.tag}>{partner.tagline}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Ionicons name="star" size={14} color={colors.accent} />
              <Text style={styles.metaTxt}>{partner.rating.toFixed(1)}</Text>
              <Text style={styles.metaSub}>{partner.reviews}+ reviews</Text>
            </View>
            <View style={styles.metaCell}>
              <Ionicons name="time-outline" size={14} color={colors.inkSoft} />
              <Text style={styles.metaTxt}>{partner.etaMins} min</Text>
              <Text style={styles.metaSub}>delivery</Text>
            </View>
            <View style={styles.metaCell}>
              <Ionicons name="location-outline" size={14} color={colors.inkSoft} />
              <Text style={styles.metaTxt} numberOfLines={1}>
                {partner.location.split(',')[0]}
              </Text>
              <Text style={styles.metaSub}>kitchen</Text>
            </View>
          </View>

          <View style={styles.badges}>
            {partner.badges.map(b => (
              <View key={b} style={styles.badge}>
                <Ionicons name="shield-checkmark" size={11} color={colors.success} />
                <Text style={styles.badgeTxt}>{b}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={styles.menuTitle}>Menu</Text>
        </View>

        {partner.dishes.map(d => (
          <DishCard key={d.id} dish={d} onAdd={() => add(d, partner)} />
        ))}
      </ScrollView>

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

const styles = StyleSheet.create({
  hero: { width: '100%', height: 220, backgroundColor: colors.bgAlt },
  heroBack: { position: 'absolute', top: 0, left: 0 },
  backBtn: {
    margin: space.md, width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  body: { padding: space.lg },
  name: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: space.sm },
  tag: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
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
