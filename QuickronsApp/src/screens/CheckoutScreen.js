import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '../state/CartContext';
import { useAuth } from '../state/AuthContext';
import { addressesApi, ordersApi } from '../lib/api';
import { colors, radii, space } from '../theme';

const PAY_METHODS = [
  { id: 'COD',  label: 'Cash on delivery', icon: 'cash',          desc: 'Pay rider on arrival' },
];
// UPI / Card can be added when a payment gateway is wired up.

export default function CheckoutScreen({ navigation }) {
  const [pay,      setPay]      = useState('COD');
  const [placing,  setPlacing]  = useState(false);
  const [selectedAddr, setSelectedAddr] = useState(null);

  const { items, total, clear } = useCart();
  const { accessToken }         = useAuth();

  // ── Addresses ────────────────────────────────────────────────────────────────

  const { data: addrData, isLoading: addrLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn:  () => addressesApi.list(accessToken),
    enabled:  !!accessToken,
    select:   (res) => res.addresses || res || [],
    onSuccess: (list) => {
      // Auto-select default or first address
      if (!selectedAddr && list.length > 0) {
        const def = list.find(a => a.isDefault) || list[0];
        setSelectedAddr(def.id);
      }
    },
  });

  const addresses = addrData || [];
  const activeAddress = addresses.find(a => a.id === selectedAddr) || addresses[0];

  // ── Place order ───────────────────────────────────────────────────────────────

  const placeOrder = async () => {
    if (!activeAddress) {
      Alert.alert('Add an address', 'Please add a delivery address before placing your order.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Cart is empty', 'Add items before checking out.');
      return;
    }

    setPlacing(true);
    try {
      const body = {
        addressId:     activeAddress.id,
        paymentMethod: pay,
        items: items.map(i => ({ menuItemId: i.menuItem.id, qty: i.qty })),
      };

      const res = await ordersApi.place(body, accessToken);
      const orderId = res?.order?.id || res?.id;

      clear();
      navigation.replace('Tracking', { orderId });
    } catch (err) {
      Alert.alert('Order failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setPlacing(false);
    }
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
        {/* Delivery address */}
        <Text style={styles.section}>Deliver to</Text>

        {addrLoading ? (
          <View style={[styles.card, { justifyContent: 'center' }]}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.card}>
            <Ionicons name="location-outline" size={18} color={colors.inkMuted} />
            <Text style={[styles.cardDesc, { flex: 1 }]}>
              No saved addresses. Add one in your profile.
            </Text>
          </View>
        ) : (
          addresses.map(addr => (
            <Pressable
              key={addr.id}
              onPress={() => setSelectedAddr(addr.id)}
              style={[
                styles.addrRow,
                selectedAddr === addr.id && styles.addrRowActive,
              ]}>
              <Ionicons
                name={addr.label?.toLowerCase() === 'home' ? 'home' : 'business'}
                size={18}
                color={selectedAddr === addr.id ? colors.brand : colors.inkSoft}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {addr.label || 'Address'}
                  {addr.isDefault ? '  ✓ Default' : ''}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {[addr.line1, addr.line2, addr.city, addr.pincode]
                    .filter(Boolean).join(', ')}
                </Text>
              </View>
              <View style={[styles.radio, selectedAddr === addr.id && styles.radioActive]}>
                {selectedAddr === addr.id && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          ))
        )}

        {/* Payment */}
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

        {/* Order summary */}
        <Text style={styles.section}>Your order</Text>
        <View style={styles.card}>
          {items.map(({ menuItem, qty }) => (
            <View key={menuItem.id} style={styles.orderRow}>
              <Text style={styles.orderItem}>{menuItem.name}</Text>
              <Text style={styles.orderQty}>×{qty}</Text>
              <Text style={styles.orderPrice}>
                ₹{Math.round(menuItem.pricePaise * qty / 100)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total (incl. fees)</Text>
            <Text style={styles.totalValue}>₹{total}</Text>
          </View>
        </View>

        {/* Trust badge */}
        <View style={styles.trustBox}>
          <Ionicons name="shield-checkmark" size={20} color={colors.success} />
          <Text style={styles.trustTxt}>
            Tamper-evident packaging. 100% replacement guarantee on Quickrons partners.
          </Text>
        </View>
      </ScrollView>

      <Pressable
        onPress={placeOrder}
        disabled={placing}
        style={[styles.cta, placing && { opacity: 0.7 }]}>
        {placing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.ctaTxt}>Place order — ₹{total}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </>
        )}
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
  section: {
    fontSize: 13, fontWeight: '700', color: colors.inkSoft,
    marginTop: 16, marginBottom: 8, textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.bg, padding: space.md, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  addrRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bg, padding: space.md, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  addrRowActive: { borderColor: colors.brand, backgroundColor: '#FFF1F4' },
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
  orderRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 4,
  },
  orderItem:  { flex: 1, fontSize: 13, color: colors.ink },
  orderQty:   { fontSize: 13, color: colors.inkSoft, marginRight: 8 },
  orderPrice: { fontSize: 13, fontWeight: '700', color: colors.ink },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 14, fontWeight: '800', color: colors.ink },
  totalValue: { fontSize: 14, fontWeight: '800', color: colors.brand },
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
