import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';

// Local sample data — no backend yet.
const PARTNER = {
  name: 'Forra Foods Kitchen',
  tagline: 'Daily-fresh Malabar thalis, biryanis, breakfast tiffins & dried fruits.',
  location: 'Perinthalmanna',
  rating: 4.8,
  prepTimeMins: 25,
};

const DISHES = [
  {
    id: 'd1',
    name: 'Thalassery Chicken Biryani',
    desc: 'Kaima rice, slow-cooked Malabar masala, raita & lemon pickle.',
    price: 229,
    isVeg: false,
    signature: true,
  },
  {
    id: 'd2',
    name: 'Beef Fry + Parotta',
    desc: 'Slow-roasted beef pieces with layered Malabar parotta.',
    price: 189,
    isVeg: false,
  },
  {
    id: 'd3',
    name: 'Kerala Sadhya (Mini)',
    desc: '12-item banana-leaf veg meal in eco container.',
    price: 199,
    isVeg: true,
  },
  {
    id: 'd4',
    name: 'Puttu + Kadala Curry',
    desc: 'Steamed rice puttu with black chana curry. Breakfast staple.',
    price: 79,
    isVeg: true,
  },
  {
    id: 'd5',
    name: 'Forra Dried Fruits Box',
    desc: 'Premium dates, almonds, cashews, raisins. 500 g.',
    price: 299,
    isVeg: true,
    signature: true,
  },
];

export default function OrderFoodScreen({ navigation }) {
  const [cart, setCart] = useState({}); // { [dishId]: qty }

  const add    = id => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const remove = id => setCart(c => {
    const q = (c[id] || 0) - 1;
    const next = { ...c };
    if (q <= 0) delete next[id]; else next[id] = q;
    return next;
  });

  const totals = useMemo(() => {
    const items = Object.entries(cart);
    const itemCount = items.reduce((s, [, q]) => s + q, 0);
    const total = items.reduce((s, [id, q]) => {
      const d = DISHES.find(x => x.id === id);
      return s + (d ? d.price * q : 0);
    }, 0);
    return { itemCount, total };
  }, [cart]);

  const onCheckout = () => {
    if (totals.itemCount === 0) return;
    // Local mock order id like QR-XXXXX (5 digits).
    const orderId = `QR-${Math.floor(10000 + Math.random() * 89999)}`;
    navigation.navigate('CheckoutSuccess', {
      orderId,
      total: totals.total,
      itemCount: totals.itemCount,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Order food</Text>
          <Text style={styles.headerSub}>Forra Foods Kitchen</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Partner spotlight */}
        <View style={styles.spot}>
          <View style={styles.spotBadge}>
            <Text style={styles.spotBadgeTxt}>OUR FLAGSHIP</Text>
          </View>
          <Text style={styles.spotTitle}>{PARTNER.name}</Text>
          <Text style={styles.spotSub}>{PARTNER.tagline}</Text>

          <View style={styles.metaRow}>
            <Meta icon="star"          value={PARTNER.rating.toFixed(1)} accent />
            <Meta icon="time-outline"  value={`${PARTNER.prepTimeMins} min`} />
            <Meta icon="location-outline" value={PARTNER.location} />
          </View>
        </View>

        {/* Menu */}
        <Text style={styles.sectionTitle}>MENU</Text>

        {DISHES.map(d => {
          const qty = cart[d.id] || 0;
          return (
            <View key={d.id} style={styles.dish}>
              <View style={{ flex: 1, paddingRight: space.md }}>
                <View style={styles.dishHead}>
                  <View style={[styles.vegDot, { borderColor: d.isVeg ? colors.success : colors.danger }]}>
                    <View style={[styles.vegInner, { backgroundColor: d.isVeg ? colors.success : colors.danger }]} />
                  </View>
                  {d.signature ? (
                    <View style={styles.signature}>
                      <Ionicons name="ribbon" size={11} color={colors.accent} />
                      <Text style={styles.sigTxt}>Signature</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.dishName}>{d.name}</Text>
                <Text style={styles.dishPrice}>₹{d.price}</Text>
                <Text style={styles.dishDesc} numberOfLines={2}>{d.desc}</Text>
              </View>

              {qty === 0 ? (
                <Pressable onPress={() => add(d.id)} style={styles.addBtn}>
                  <Text style={styles.addTxt}>ADD</Text>
                  <Ionicons name="add" size={14} color={colors.brand} />
                </Pressable>
              ) : (
                <View style={styles.qtyBox}>
                  <Pressable onPress={() => remove(d.id)} style={styles.qtyStep}>
                    <Ionicons name="remove" size={16} color={colors.brand} />
                  </Pressable>
                  <Text style={styles.qtyTxt}>{qty}</Text>
                  <Pressable onPress={() => add(d.id)} style={styles.qtyStep}>
                    <Ionicons name="add" size={16} color={colors.brand} />
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Sticky cart bar */}
      <View style={styles.cartBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cartCount}>
            {totals.itemCount === 0
              ? 'Cart is empty'
              : `${totals.itemCount} item${totals.itemCount > 1 ? 's' : ''} in cart`}
          </Text>
          <Text style={styles.cartTotal}>₹{totals.total}</Text>
        </View>
        <Pressable
          onPress={onCheckout}
          disabled={totals.itemCount === 0}
          style={[styles.checkoutBtn, totals.itemCount === 0 && styles.checkoutDisabled]}>
          <Text style={styles.checkoutTxt}>Checkout</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Meta({ icon, value, accent }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={13} color={accent ? colors.accent : colors.inkSoft} />
      <Text style={[styles.metaTxt, accent && { color: colors.ink, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgAlt },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md,
    backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  headerSub:   { fontSize: 12, color: colors.inkSoft },

  spot: {
    margin: space.lg, padding: space.lg, borderRadius: radii.lg,
    backgroundColor: colors.ink,
  },
  spotBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent + '22',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  spotBadgeTxt: { fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 1 },
  spotTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 8 },
  spotSub:   { color: '#CBD5E1', fontSize: 13, marginTop: 4, lineHeight: 18 },
  metaRow:   { flexDirection: 'row', gap: 14, marginTop: 12 },
  meta:      { flexDirection: 'row', alignItems: 'center', gap: 4,
               backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  metaTxt:   { fontSize: 12, color: '#CBD5E1', fontWeight: '600' },

  sectionTitle: {
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm,
    fontSize: 12, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.6,
  },

  dish: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.bg, marginHorizontal: space.lg, marginBottom: 10,
    padding: space.md, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
  },
  dishHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vegDot: {
    width: 14, height: 14, borderWidth: 1.5, borderRadius: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  vegInner: { width: 6, height: 6, borderRadius: 3 },
  signature: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.accent + '22',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  sigTxt: { fontSize: 10, fontWeight: '700', color: colors.accent },
  dishName:  { marginTop: 6, fontSize: 15, fontWeight: '800', color: colors.ink },
  dishPrice: { marginTop: 2, fontSize: 14, fontWeight: '700', color: colors.ink },
  dishDesc:  { marginTop: 4, fontSize: 12, color: colors.inkSoft, lineHeight: 17 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.brand, borderRadius: radii.md,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F0FDF4',
  },
  addTxt: { color: colors.brand, fontSize: 13, fontWeight: '800' },

  qtyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.brand, borderRadius: radii.md,
    paddingHorizontal: 6, paddingVertical: 4, backgroundColor: '#F0FDF4',
  },
  qtyStep: { padding: 4 },
  qtyTxt:  { fontSize: 14, fontWeight: '800', color: colors.brand, minWidth: 14, textAlign: 'center' },

  cartBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 18,
    backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  cartCount: { fontSize: 11, color: colors.inkSoft, fontWeight: '700', letterSpacing: 0.4 },
  cartTotal: { fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 2 },
  checkoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.brand, borderRadius: radii.lg,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  checkoutDisabled: { opacity: 0.45 },
  checkoutTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
