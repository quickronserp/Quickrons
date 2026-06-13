import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert,
  TextInput, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '../state/CartContext';
import { useAuth } from '../state/AuthContext';
import { addressesApi, ordersApi } from '../lib/api';
import { goHomeOrBack } from '../lib/nav';
import { colors, radii, space } from '../theme';
import { layout } from '../lib/layout';

// Shown inline (not via Alert) when the user taps "place order" on UPI without
// a reference — RN Web Alert is easy to miss and reads as a dead-end.
const UPI_REF_REQUIRED_MSG = 'Enter the UTR / reference number after completing UPI payment.';

// UPI-first: UPI is the primary, recommended method; COD remains available.
const PAY_METHODS = [
  { id: 'UPI', label: 'UPI',              icon: 'qr-code', desc: 'Pay now, enter the reference', recommended: true },
  { id: 'COD', label: 'Cash on delivery', icon: 'cash',    desc: 'Pay the rider on arrival' },
];
// Company UPI details customers pay to. Set per-deploy via EXPO_PUBLIC_UPI_*.
// Razorpay/PSP auto-collect arrives later; until then we never auto-confirm UPI.
const UPI_VPA    = process.env.EXPO_PUBLIC_UPI_ID || process.env.EXPO_PUBLIC_UPI_VPA || 'quickrons@upi';
const UPI_NAME   = process.env.EXPO_PUBLIC_UPI_NAME || 'Quickrons';
const UPI_QR_URL = process.env.EXPO_PUBLIC_UPI_QR_URL || null;
// True when no real UPI ID is configured — surfaces a "demo" marker in the UI.
const UPI_IS_DEMO = !(process.env.EXPO_PUBLIC_UPI_ID || process.env.EXPO_PUBLIC_UPI_VPA);

export default function CheckoutScreen({ navigation }) {
  const [pay,      setPay]      = useState('UPI');
  const [upiRef,   setUpiRef]   = useState('');
  const [upiError, setUpiError] = useState('');
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
  });

  const addresses = addrData || [];
  const activeAddress = addresses.find(a => a.id === selectedAddr) || addresses[0];

  // Auto-select default or first address once data loads.
  // NOTE: useQuery onSuccess was removed in TanStack Query v5 — use useEffect instead.
  useEffect(() => {
    if (!selectedAddr && addresses.length > 0) {
      const def = addresses.find(a => a.isDefault) || addresses[0];
      setSelectedAddr(def.id);
    }
  }, [addresses]);

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

    if (pay === 'UPI' && upiRef.trim().length < 6) {
      // Inline error (server enforces the same ≥6-char rule). Clear, visible,
      // and keyboard-adjacent — no easy-to-miss web Alert.
      setUpiError(UPI_REF_REQUIRED_MSG);
      return;
    }
    setUpiError('');

    setPlacing(true);
    try {
      const body = {
        addressId:     activeAddress.id,
        paymentMethod: pay,
        ...(pay === 'UPI' && { paymentRef: upiRef.trim() }),
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
     <View style={layout.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => goHomeOrBack(navigation)} style={{ padding: 8 }}>
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
              <View style={styles.payTitleRow}>
                <Text style={styles.cardTitle}>{m.label}</Text>
                {m.recommended ? (
                  <View style={styles.recoBadge}>
                    <Text style={styles.recoBadgeTxt}>Recommended</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardDesc}>{m.desc}</Text>
            </View>
            <View style={[styles.radio, pay === m.id && styles.radioActive]}>
              {pay === m.id && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        ))}

        {/* UPI pay-now panel — amount + QR + UPI ID + reference entry */}
        {pay === 'UPI' && (
          <View style={styles.upiPanel}>
            {/* Exact payable amount */}
            <View style={styles.upiAmountRow}>
              <Text style={styles.upiAmountLabel}>Pay exactly</Text>
              <Text style={styles.upiAmount}>₹{total}</Text>
            </View>

            {/* QR — real image when configured, else a clearly-marked demo box */}
            {UPI_QR_URL ? (
              <View style={styles.qrWrap}>
                <Image source={{ uri: UPI_QR_URL }} style={styles.qrImg} resizeMode="contain" />
                <Text style={styles.qrHint}>Scan with any UPI app</Text>
              </View>
            ) : (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code" size={64} color={colors.ink} />
                <Text style={styles.qrHint}>
                  {UPI_IS_DEMO ? 'Demo QR — set EXPO_PUBLIC_UPI_QR_URL' : 'Scan to pay'}
                </Text>
              </View>
            )}

            {/* UPI ID + payee name */}
            <View style={styles.upiVpaRow}>
              <Ionicons name="at" size={16} color={colors.brand} />
              <Text style={styles.upiVpa}>{UPI_VPA}</Text>
            </View>
            <Text style={styles.upiPayee}>
              {UPI_NAME}{UPI_IS_DEMO ? '  ·  demo/local' : ''}
            </Text>

            <Text style={styles.upiSteps}>
              1. Scan the QR (or use the UPI ID) in any UPI app.{'\n'}
              2. Pay exactly ₹{total}.{'\n'}
              3. Enter the UTR / reference number it shows you.{'\n'}
              4. Place the order — we verify and start it.
            </Text>
            <TextInput
              style={[styles.upiInput, upiError && styles.upiInputError]}
              value={upiRef}
              onChangeText={t => {
                setUpiRef(t.replace(/[^0-9A-Za-z]/g, '').slice(0, 40));
                if (upiError) setUpiError('');
              }}
              placeholder="UTR / reference number"
              placeholderTextColor={colors.inkMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {upiError ? (
              <View style={styles.upiErrorRow}>
                <Ionicons name="alert-circle" size={14} color={colors.danger} />
                <Text style={styles.upiErrorTxt}>{upiError}</Text>
              </View>
            ) : null}
            <Text style={styles.upiNote}>
              Payment shows as “pending” until Quickrons verifies it — we never auto-confirm.
            </Text>
          </View>
        )}

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
            Delivery confirmed with a one-time code. 100% replacement guarantee on Quickrons partners.
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
            <Text style={styles.ctaTxt}>
              {pay === 'UPI' ? `I've paid — place order · ₹${total}` : `Place order — ₹${total}`}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </>
        )}
      </Pressable>
     </View>
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
  addrRowActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  cardDesc: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bg, padding: space.md, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  payRowActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  payTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recoBadge: {
    backgroundColor: colors.success + '1A', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  recoBadgeTxt: { fontSize: 10, fontWeight: '800', color: colors.success },
  upiPanel: {
    backgroundColor: colors.bg, borderRadius: radii.md, padding: space.md,
    borderWidth: 1, borderColor: colors.brand + '40', marginBottom: 8, gap: 10,
  },
  qrPlaceholder: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.bgAlt, borderRadius: radii.md, paddingVertical: 24,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  qrWrap: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  qrImg: { width: 200, height: 200, borderRadius: radii.sm, backgroundColor: '#fff' },
  qrHint: { fontSize: 11, color: colors.inkMuted, fontWeight: '600' },
  upiAmountRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
  },
  upiAmountLabel: { fontSize: 13, color: colors.inkSoft, fontWeight: '700' },
  upiAmount: { fontSize: 24, fontWeight: '900', color: colors.brand },
  upiPayee: { fontSize: 12, color: colors.inkSoft, textAlign: 'center', marginTop: -4 },
  upiVpaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: colors.brandTint, borderRadius: 999, paddingVertical: 8,
  },
  upiVpa: { fontSize: 15, fontWeight: '800', color: colors.brand, letterSpacing: 0.3 },
  upiSteps: { fontSize: 12, color: colors.inkSoft, lineHeight: 20 },
  upiInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.sm,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink,
    backgroundColor: colors.bgAlt, letterSpacing: 1,
  },
  upiInputError: { borderColor: colors.danger },
  upiErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -2 },
  upiErrorTxt: { flex: 1, fontSize: 12, color: colors.danger, fontWeight: '700' },
  upiNote: { fontSize: 11, color: colors.inkMuted, fontStyle: 'italic' },
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
