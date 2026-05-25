import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';

export default function CheckoutSuccessScreen({ route, navigation }) {
  const { orderId = 'QR-30421', total = 0, itemCount = 0 } = route?.params || {};

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Order placed successfully</Text>
          <Text style={styles.heroSub}>
            Forra Foods Kitchen has your order. We'll keep you posted on every step.
          </Text>
        </View>

        {/* Order ID card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Order ID</Text>
            <Text style={styles.value}>{orderId}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Items</Text>
            <Text style={styles.value}>{itemCount}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Total paid</Text>
            <Text style={[styles.value, { color: colors.brand, fontSize: 18 }]}>₹{total}</Text>
          </View>
        </View>

        {/* ETA */}
        <View style={[styles.card, styles.etaCard]}>
          <Ionicons name="time-outline" size={22} color={colors.brand} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.etaLabel}>Estimated delivery</Text>
            <Text style={styles.etaValue}>25 – 30 min</Text>
          </View>
        </View>

        {/* Tamper seal message */}
        <View style={[styles.card, styles.sealCard]}>
          <Ionicons name="shield-checkmark" size={22} color={colors.brand} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.sealTitle}>Tamper-seal protected</Text>
            <Text style={styles.sealDesc}>
              Your order will be sealed at the kitchen. Scan the QR sticker at delivery
              to verify it wasn't opened in transit.
            </Text>
          </View>
        </View>

        {/* Rider pending */}
        <View style={[styles.card, styles.riderCard]}>
          <View style={styles.riderDot} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.riderTitle}>Rider assignment pending</Text>
            <Text style={styles.riderDesc}>
              We'll assign a Quickrons rider once your order is ready for pickup.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* CTAs */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => navigation.navigate('Tracking', { orderId, total, itemCount })}
          style={styles.trackBtn}>
          <Text style={styles.trackTxt}>Track order</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
        <Pressable
          onPress={() => navigation.popToTop()}
          style={styles.homeBtn}>
          <Text style={styles.homeTxt}>Back to home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgAlt },

  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 16, paddingHorizontal: space.lg },
  successCircle: {
    width: 86, height: 86, borderRadius: 43, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.brand, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroTitle: { marginTop: 16, fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  heroSub:   { marginTop: 6, fontSize: 13, color: colors.inkSoft, textAlign: 'center', lineHeight: 19, paddingHorizontal: 16 },

  card: {
    marginHorizontal: space.lg, marginTop: 12,
    padding: space.md, borderRadius: radii.md,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  label: { fontSize: 12, color: colors.inkSoft, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  value: { fontSize: 15, color: colors.ink, fontWeight: '800', fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: colors.border },

  etaCard: { flexDirection: 'row', alignItems: 'center' },
  etaLabel: { fontSize: 11, color: colors.inkSoft, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  etaValue: { fontSize: 22, color: colors.ink, fontWeight: '800', marginTop: 2 },

  sealCard: { flexDirection: 'row', alignItems: 'flex-start' },
  sealTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  sealDesc:  { marginTop: 4, fontSize: 12, color: colors.inkSoft, lineHeight: 17 },

  riderCard: { flexDirection: 'row', alignItems: 'flex-start' },
  riderDot: {
    width: 10, height: 10, borderRadius: 5, marginTop: 6,
    backgroundColor: colors.accent,
  },
  riderTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  riderDesc:  { marginTop: 4, fontSize: 12, color: colors.inkSoft, lineHeight: 17 },

  footer: {
    paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 18,
    backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
    gap: 8,
  },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.brand, borderRadius: radii.lg, paddingVertical: 14,
  },
  trackTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  homeBtn: {
    paddingVertical: 12, alignItems: 'center',
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  homeTxt: { color: colors.inkSoft, fontWeight: '700', fontSize: 13 },
});
