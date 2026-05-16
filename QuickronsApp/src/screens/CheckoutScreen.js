import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../state/CartContext';
import { colors, radii, space } from '../theme';

const PAY_METHODS = [
  { id: 'upi', label: 'UPI', icon: 'phone-portrait', desc: 'PhonePe / GPay / Paytm' },
  { id: 'card', label: 'Card', icon: 'card', desc: 'Credit / Debit' },
  { id: 'cod', label: 'Cash on delivery', icon: 'cash', desc: 'Pay rider on arrival' },
];

export default function CheckoutScreen({ navigation }) {
  const [pay, setPay] = useState('upi');
  const { total, clear } = useCart();

  const placeOrder = () => {
    clear();
    navigation.replace('Tracking');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgAlt }} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Checkout</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>
        <Text style={styles.section}>Deliver to</Text>
        <View style={styles.card}>
          <Ionicons name="home" size={18} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Home</Text>
            <Text style={styles.cardDesc}>312, 4th cross, Indiranagar, Bengaluru — 560038</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
        </View>

        <Text style={styles.section}>Payment</Text>
        {PAY_METHODS.map(m => (
          <Pressable
            key={m.id}
            onPress={() => setPay(m.id)}
            style={[styles.payRow, pay === m.id && styles.payRowActive]}>
            <Ionicons
              name={m.icon}
              size={20}
              color={pay === m.id ? colors.brand : colors.inkSoft}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{m.label}</Text>
              <Text style={styles.cardDesc}>{m.desc}</Text>
            </View>
            <View style={[styles.radio, pay === m.id && styles.radioActive]}>
              {pay === m.id && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        ))}

        <Text style={styles.section}>Delivery instructions</Text>
        <View style={styles.card}>
          <Ionicons name="document-text-outline" size={18} color={colors.inkSoft} />
          <Text style={styles.cardDesc}>Avoid contact delivery. Leave at door.</Text>
        </View>

        <View style={styles.trustBox}>
          <Ionicons name="shield-checkmark" size={20} color={colors.success} />
          <Text style={styles.trustTxt}>
            Tamper-evident packaging. 100% replacement guarantee on Quickrons partners.
          </Text>
        </View>
      </ScrollView>

      <Pressable onPress={placeOrder} style={styles.cta}>
        <Text style={styles.ctaTxt}>Place order — ₹{total}</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.bg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink },
  section: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bg, padding: space.md, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  cardDesc: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bg, padding: space.md, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  payRowActive: { borderColor: colors.brand, backgroundColor: '#FFF1F4' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.inkMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  trustBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.success + '12', padding: space.md, borderRadius: radii.md, marginTop: 16,
  },
  trustTxt: { flex: 1, fontSize: 12, color: colors.success, fontWeight: '600', lineHeight: 18 },
  cta: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: colors.brand, borderRadius: radii.lg, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: colors.brand, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
