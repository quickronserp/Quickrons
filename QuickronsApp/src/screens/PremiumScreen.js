import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../state/CartContext';
import { colors, radii, space } from '../theme';

const PERKS = [
  { icon: 'rocket', title: 'Free delivery', desc: 'On every order. Including Curated kitchens.' },
  { icon: 'pricetag', title: '8% off Forra Kitchen', desc: 'On every Forra signature dish, every day.' },
  { icon: 'star', title: 'Priority slots', desc: 'Lock in 30-min Quick Today windows ahead of others.' },
  { icon: 'gift', title: 'Member-only drops', desc: 'Hotel chef specials and limited home-maker batches.' },
];

export default function PremiumScreen({ navigation }) {
  const { isPlus, setIsPlus } = useCart();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.heroPad}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          <Ionicons name="diamond" size={48} color={colors.accent} />
          <View style={styles.soonTag}>
            <Text style={styles.soonTagTxt}>LAUNCHING SOON</Text>
          </View>
          <Text style={styles.title}>Quickrons Plus</Text>
          <Text style={styles.subtitle}>
            Premium food delivered, with the perks of a member.
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.priceCard}>
            <Text style={styles.priceTag}>Most popular</Text>
            <Text style={styles.priceMain}>₹149 <Text style={styles.priceMainSub}>/month</Text></Text>
            <Text style={styles.priceDesc}>Cancel anytime. First 7 days free.</Text>
          </View>

          {PERKS.map(p => (
            <View key={p.title} style={styles.perkRow}>
              <View style={styles.perkIcon}>
                <Ionicons name={p.icon} size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={styles.perkDesc}>{p.desc}</Text>
              </View>
            </View>
          ))}

          <View style={styles.calc}>
            <Text style={styles.calcTitle}>You save ₹400+ per month</Text>
            <Text style={styles.calcDesc}>
              Average Plus member orders 11 times per month. Free delivery (₹39 × 11) plus
              8% off Forra Kitchen (~₹120) easily covers the membership.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Pressable
        onPress={() => { setIsPlus(true); navigation.goBack(); }}
        style={[styles.cta, isPlus && { backgroundColor: colors.success }]}>
        <Text style={styles.ctaTxt}>
          {isPlus ? "You're on the Plus waitlist ✓" : 'Join the Plus waitlist'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroPad: { padding: space.xl, alignItems: 'flex-start', position: 'relative' },
  backBtn: { position: 'absolute', top: 12, right: 12, padding: 6 },
  soonTag: {
    backgroundColor: colors.accent + '22', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 12,
  },
  soonTagTxt: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#CBD5E1', fontSize: 15, marginTop: 6 },
  body: {
    backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: space.lg, marginTop: space.md,
  },
  priceCard: {
    backgroundColor: colors.ink, borderRadius: radii.lg, padding: space.lg, marginBottom: space.lg,
  },
  priceTag: {
    color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1,
  },
  priceMain: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4 },
  priceMainSub: { fontSize: 16, fontWeight: '600', color: '#94A3B8' },
  priceDesc: { color: '#CBD5E1', fontSize: 13, marginTop: 4 },
  perkRow: {
    flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 14,
  },
  perkIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  perkTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  perkDesc: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  calc: {
    backgroundColor: colors.bgAlt, padding: space.md, borderRadius: radii.md, marginTop: space.md,
  },
  calcTitle: { fontSize: 14, fontWeight: '800', color: colors.success },
  calcDesc: { fontSize: 12, color: colors.inkSoft, marginTop: 4, lineHeight: 18 },
  cta: {
    position: 'absolute', bottom: 18, left: 18, right: 18,
    backgroundColor: colors.accent, borderRadius: radii.lg, padding: 16, alignItems: 'center',
  },
  ctaTxt: { color: colors.ink, fontWeight: '800', fontSize: 15 },
});
