import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../state/CartContext';
import { colors, radii, space } from '../theme';
import { layout } from '../lib/layout';

export default function CartScreen({ navigation }) {
  const { items, updateQty, subtotal, deliveryFee, platformFee, gst, total } = useCart();
  const canGoBack = navigation.canGoBack();

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.empty}>
        <Ionicons name="bag-outline" size={64} color={colors.inkMuted} />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptyDesc}>Browse kitchens and add a dish to get started.</Text>
        <Pressable onPress={() => navigation.navigate('HomeTab')} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnTxt}>Browse kitchens</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgAlt }} edges={['top']}>
     <View style={layout.screen}>
      <View style={styles.header}>
        {canGoBack ? (
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.title}>Your cart</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 140 }}>
        {items.map(({ menuItem, partner, qty }) => (
          <View key={menuItem.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerLabel}>{partner.name}</Text>
              <Text style={styles.dish}>{menuItem.name}</Text>
              <Text style={styles.price}>₹{Math.round(menuItem.pricePaise / 100)}</Text>
            </View>
            <View style={styles.qtyBox}>
              <Pressable onPress={() => updateQty(menuItem.id, qty - 1)} style={styles.qtyBtn}>
                <Ionicons name="remove" size={16} color={colors.brand} />
              </Pressable>
              <Text style={styles.qtyTxt}>{qty}</Text>
              <Pressable onPress={() => updateQty(menuItem.id, qty + 1)} style={styles.qtyBtn}>
                <Ionicons name="add" size={16} color={colors.brand} />
              </Pressable>
            </View>
          </View>
        ))}

        <View style={styles.summary}>
          <SummaryRow label="Item subtotal" value={`₹${subtotal}`} />
          <SummaryRow label="Delivery fee" value={`₹${deliveryFee}`} />
          <SummaryRow label="Platform fee" value={`₹${platformFee}`} />
          <SummaryRow label="GST (5%)" value={`₹${gst}`} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>To pay</Text>
            <Text style={styles.totalValue}>₹{total}</Text>
          </View>
        </View>
      </ScrollView>

      <Pressable
        onPress={() => navigation.navigate('Checkout')}
        style={styles.cta}>
        <View>
          <Text style={styles.ctaSub}>₹{total}</Text>
          <Text style={styles.ctaTotal}>{items.length} item{items.length > 1 ? 's' : ''}</Text>
        </View>
        <Text style={styles.ctaTxt}>Proceed to checkout</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </Pressable>
     </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, valueColor }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.bg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: radii.md, padding: space.md, marginBottom: 10,
  },
  partnerLabel: { fontSize: 11, color: colors.inkMuted, fontWeight: '700', textTransform: 'uppercase' },
  dish: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 2 },
  price: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  qtyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: colors.brand, borderRadius: radii.sm, paddingHorizontal: 6, paddingVertical: 4,
  },
  qtyBtn: { padding: 4 },
  qtyTxt: { fontSize: 14, fontWeight: '800', color: colors.brand, minWidth: 16, textAlign: 'center' },
  summary: {
    backgroundColor: colors.bg, borderRadius: radii.md, padding: space.md, marginTop: space.md,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
  },
  summaryLabel: { fontSize: 13, color: colors.inkSoft },
  summaryValue: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 12,
  },
  totalLabel: { fontSize: 15, fontWeight: '800', color: colors.ink },
  totalValue: { fontSize: 17, fontWeight: '800', color: colors.brand },
  cta: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: colors.brand, borderRadius: radii.lg, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: colors.brand, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  ctaSub: { color: '#fff', fontWeight: '800', fontSize: 16 },
  ctaTotal: { color: '#FECDD3', fontSize: 11, fontWeight: '600' },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl,
    backgroundColor: colors.bg, gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  emptyDesc: { textAlign: 'center', color: colors.inkSoft },
  primaryBtn: {
    backgroundColor: colors.brand, paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: radii.md, marginTop: 8,
  },
  primaryBtnTxt: { color: '#fff', fontWeight: '800' },
});
