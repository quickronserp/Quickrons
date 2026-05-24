import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';
import { useAuth } from '../state/AuthContext';

const ROLE_CARDS = [
  {
    id: 'customer',
    title: 'Order food',
    desc: 'Browse Malabar kitchens, home-cooks, restaurants and caterers.',
    icon: 'restaurant',
    color: colors.brand,
    cta: 'Start ordering',
  },
  {
    id: 'rider',
    title: 'Become a rider',
    desc: 'Earn weekly. Branded fleet across Perinthalmanna & Malappuram.',
    icon: 'bicycle',
    color: colors.rider,
    cta: 'Join the fleet',
  },
  {
    id: 'partner',
    title: 'Sell on Quickrons',
    desc: 'Home cooks, restaurants, caterers — list your kitchen.',
    icon: 'storefront',
    color: colors.partner,
    cta: 'Open partner signup',
  },
];

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const phoneTail = user?.phone ? user.phone.slice(-4) : '';

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcome}>Welcome 🌿</Text>
            <Text style={styles.sub}>
              Signed in as <Text style={styles.subBold}>+91 ••••{phoneTail || '••••'}</Text>
            </Text>
          </View>
          <Pressable onPress={signOut} style={styles.signOutBtn}>
            <Ionicons name="log-out-outline" size={16} color={colors.ink} />
            <Text style={styles.signOutTxt}>Sign out</Text>
          </Pressable>
        </View>

        {/* Forra spotlight */}
        <View style={styles.spot}>
          <View style={styles.spotBadge}>
            <Text style={styles.spotBadgeTxt}>OUR FLAGSHIP</Text>
          </View>
          <Text style={styles.spotTitle}>Forra Foods Kitchen</Text>
          <Text style={styles.spotSub}>Daily-fresh Malabar thalis, biryanis, breakfast tiffins & dried fruits.</Text>
        </View>

        {/* Role cards */}
        <Text style={styles.sectionTitle}>What would you like to do?</Text>

        {ROLE_CARDS.map(r => (
          <Pressable key={r.id} style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: r.color + '18' }]}>
              <Ionicons name={r.icon} size={26} color={r.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{r.title}</Text>
              <Text style={styles.cardDesc}>{r.desc}</Text>
              <View style={[styles.cardCta, { borderColor: r.color }]}>
                <Text style={[styles.cardCtaTxt, { color: r.color }]}>{r.cta}</Text>
                <Ionicons name="arrow-forward" size={14} color={r.color} />
              </View>
            </View>
          </Pressable>
        ))}

        {/* Zone footer */}
        <View style={styles.zone}>
          <Ionicons name="location" size={14} color={colors.brand} />
          <Text style={styles.zoneTxt}>Live in Perinthalmanna · Malappuram corridor</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgAlt },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg,
  },
  welcome: { fontSize: 22, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  subBold: { fontWeight: '700', color: colors.ink },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  signOutTxt: { fontSize: 12, fontWeight: '700', color: colors.ink },

  spot: {
    marginHorizontal: space.lg, padding: space.lg, borderRadius: radii.lg,
    backgroundColor: colors.ink,
  },
  spotBadge: { alignSelf: 'flex-start', backgroundColor: colors.accent + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  spotBadgeTxt: { fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 1 },
  spotTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 8 },
  spotSub:   { color: '#CBD5E1', fontSize: 13, marginTop: 4, lineHeight: 18 },

  sectionTitle: {
    paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.sm,
    fontSize: 13, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.5,
  },

  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginHorizontal: space.lg, marginBottom: 10,
    padding: space.lg, borderRadius: radii.lg,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  cardDesc:  { fontSize: 13, color: colors.inkSoft, marginTop: 3, lineHeight: 18 },
  cardCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', marginTop: 10,
    borderWidth: 1, borderRadius: radii.sm,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  cardCtaTxt: { fontSize: 12, fontWeight: '800' },

  zone: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: space.xl,
  },
  zoneTxt: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
});
