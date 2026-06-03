// RiderOpsScreen — real-API rider delivery operations
// Routes used:
//   GET  /api/v1/rider/me
//   POST /api/v1/rider/me/online         { isOnline }
//   GET  /api/v1/rider/orders/available
//   POST /api/v1/rider/orders/:id/accept
//   POST /api/v1/rider/orders/:id/picked-up   (system generates delivery OTP)
//   POST /api/v1/rider/orders/:id/delivered   { code }
//   GET  /api/v1/rider/me/orders
//   GET  /api/v1/rider/wallet

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, TextInput, Alert, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../state/AuthContext';
import { riderOpsApi } from '../lib/api';
import socketClient from '../lib/socket';
import { colors, radii, space } from '../theme';

const VEHICLE_ICON = { AUTO: '🛺', CAR: '🚗', BIKE: '🏍', SCOOTER: '🛵', BICYCLE: '🚲', EV_BIKE: '⚡' };

const STATUS_COLOR = {
  READY_FOR_PICKUP: colors.accent,
  OUT_FOR_DELIVERY: colors.brand,
  PICKED_UP:        colors.success,
  DELIVERED:        colors.inkMuted,
  CANCELLED:        colors.danger,
};

function paise(p) { return `₹${(Number(p) / 100).toFixed(0)}`; }

function callPhone(phone) {
  if (!phone) return;
  Linking.openURL(`tel:${phone}`).catch(() =>
    Alert.alert('Cannot call', 'Your device cannot make calls right now.')
  );
}

function openMap(lat, lng, label) {
  const latN = parseFloat(lat);
  const lngN = parseFloat(lng);
  if (!isNaN(latN) && !isNaN(lngN)) {
    // Google Maps directions URL — works on Android and opens Maps on iOS too
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latN},${lngN}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot open maps', 'Install Google Maps or check your connection.')
    );
  } else if (label) {
    const encoded = encodeURIComponent(label);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`).catch(() => {});
  }
}

export default function RiderOpsScreen({ navigation }) {
  const { accessToken, user, signOut } = useAuth();

  const [profile, setProfile]             = useState(null);
  const [available, setAvailable]         = useState([]);
  const [activeOrders, setActiveOrders]   = useState([]);
  const [recentDeliveries, setRecentDeliveries] = useState([]);
  const [wallet, setWallet]               = useState(null);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  // actionLoading: { [orderId]: true } — button spinner
  const [actionLoading, setActionLoading] = useState({});
  // otpInput: { [orderId]: string }
  const [otpInput, setOtpInput]           = useState({});
  // otpError: { [orderId]: string } — inline OTP error per card
  const [otpError, setOtpError]           = useState({});
  const [error, setError]                 = useState(null);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const pollRef = useRef(null);

  const fetchAll = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    if (!quiet) setError(null);
    try {
      const [meRes, availRes, activeRes, walletRes] = await Promise.allSettled([
        riderOpsApi.me(accessToken),
        riderOpsApi.available(accessToken),
        riderOpsApi.myOrders(accessToken),
        riderOpsApi.wallet(accessToken),
      ]);

      if (meRes.status === 'fulfilled') setProfile(meRes.value.rider);
      if (availRes.status === 'fulfilled') setAvailable(availRes.value.orders || []);
      if (activeRes.status === 'fulfilled') {
        const all = activeRes.value.orders || [];
        setActiveOrders(all.filter(o => ['READY_FOR_PICKUP', 'PICKED_UP'].includes(o.status)));
        const todayKey = new Date().toDateString();
        setRecentDeliveries(
          all
            .filter(o =>
              o.status === 'DELIVERED' &&
              new Date(o.deliveredAt || o.createdAt).toDateString() === todayKey
            )
            .slice(0, 10)
        );
      }
      if (walletRes.status === 'fulfilled') setWallet(walletRes.value.wallet);
      if (meRes.status === 'rejected') throw meRes.reason;
    } catch (e) {
      if (!quiet) setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    pollRef.current = setInterval(() => fetchAll(true), 7_000);
    return () => clearInterval(pollRef.current);
  }, [fetchAll]);

  useEffect(() => {
    if (!profile?.id) return;
    socketClient.connect();
    socketClient.joinRider(profile.id);
  }, [profile?.id]);

  useEffect(() => {
    socketClient.connect();
    const refresh = () => fetchAll(true);
    const RIDER_EVENTS = ['RIDER_ASSIGNED', 'ORDER_PICKED_UP', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'ORDER_READY'];
    RIDER_EVENTS.forEach(e => socketClient.on(e, refresh));
    return () => RIDER_EVENTS.forEach(e => socketClient.off(e, refresh));
  }, [fetchAll]);

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  async function toggleOnline() {
    if (!profile) return;
    setTogglingOnline(true);
    try {
      const res = await riderOpsApi.setOnline(!profile.isOnline, accessToken);
      setProfile(res.rider);
      await fetchAll(true);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setTogglingOnline(false);
    }
  }

  // Generic action handler. onSuccess runs before re-fetch (for optimistic updates).
  async function doAction(orderId, actionFn, onSuccess) {
    setActionLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      await actionFn();
      if (onSuccess) onSuccess(orderId);
      await fetchAll(true);
    } catch (e) {
      Alert.alert('Error', e.message || 'Action failed');
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
  }

  // Deliver action — wraps doAction with inline OTP error handling
  async function doDeliver(orderId, code) {
    setOtpError(prev => ({ ...prev, [orderId]: '' }));
    setActionLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      await riderOpsApi.delivered(orderId, code, accessToken);
      // Optimistically remove from active list — smoother UX
      setActiveOrders(prev => prev.filter(o => o.id !== orderId));
      setOtpInput(prev => { const n = { ...prev }; delete n[orderId]; return n; });
      await fetchAll(true);
    } catch (e) {
      const msg = e.message || 'Action failed';
      if (msg.toLowerCase().includes('otp') || msg.toLowerCase().includes('match')) {
        setOtpError(prev => ({
          ...prev,
          [orderId]: 'Invalid delivery OTP. Ask the customer to confirm again.',
        }));
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderAvailableOrder(order) {
    const busy = actionLoading[order.id];
    const addrText = [order.addrLine1, order.addrCity].filter(Boolean).join(', ');
    return (
      <View key={order.id} style={styles.card}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNum}>#{order.orderNumber}</Text>
            <Text style={styles.partnerName}>{order.partner?.brand || 'Kitchen'}</Text>
          </View>
          <Text style={styles.amount}>{paise(order.totalPaise)}</Text>
        </View>
        <Text style={styles.addr}>{addrText}</Text>
        <Text style={styles.itemSummary}>
          {order.itemCount} item{order.itemCount !== 1 ? 's' : ''} · {order.paymentMethod}
        </Text>
        <Pressable
          onPress={() => doAction(order.id, () => riderOpsApi.accept(order.id, accessToken))}
          disabled={busy}
          style={[styles.primaryBtn, busy && styles.disabledBtn]}
        >
          {busy
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="checkmark-circle" size={18} color="#fff" />
          }
          <Text style={styles.primaryBtnTxt}>Accept Delivery</Text>
        </Pressable>
      </View>
    );
  }

  function renderActiveOrder(order) {
    const busy   = actionLoading[order.id];
    const s      = order.status;
    const dCode  = otpInput[order.id] || '';
    const errMsg = otpError[order.id] || '';

    const addrFull = [
      order.addrLine1,
      order.addrLine2,
      order.addrLandmark,
      order.addrCity,
      order.addrPincode,
    ].filter(Boolean).join(', ');

    const hasCoords = order.addrLat && order.addrLng &&
      !isNaN(parseFloat(order.addrLat)) && !isNaN(parseFloat(order.addrLng));

    return (
      <View key={order.id} style={[styles.card, styles.activeCard]}>
        {/* Header: order number + status pill */}
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNum}>#{order.orderNumber}</Text>
            <Text style={styles.partnerName}>{order.partner?.brand || 'Kitchen'}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: (STATUS_COLOR[s] || colors.inkMuted) + '20' }]}>
            <Text style={[styles.statusPillTxt, { color: STATUS_COLOR[s] || colors.inkMuted }]}>
              {s.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        {/* Customer name + call button */}
        <View style={styles.contactRow}>
          <Ionicons name="person-outline" size={14} color={colors.inkMuted} />
          <Text style={styles.customerLabel} numberOfLines={1}>
            {order.customerName || 'Customer'}
          </Text>
          {order.customerPhone ? (
            <Pressable
              onPress={() => callPhone(order.customerPhone)}
              style={styles.miniCallBtn}
              hitSlop={8}
            >
              <Ionicons name="call" size={14} color={colors.brand} />
              <Text style={styles.miniCallTxt}>Call</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Address + navigation */}
        <View style={styles.addrRow}>
          <Ionicons name="location-outline" size={14} color={colors.inkMuted} />
          <Text style={styles.addrTxt} numberOfLines={2}>{addrFull || 'Address unavailable'}</Text>
          <Pressable
            onPress={() => openMap(order.addrLat, order.addrLng, addrFull)}
            style={styles.miniMapBtn}
            hitSlop={8}
          >
            <Ionicons name="navigate" size={14} color={hasCoords ? colors.brand : colors.inkMuted} />
            <Text style={[styles.miniCallTxt, { color: hasCoords ? colors.brand : colors.inkMuted }]}>
              Map
            </Text>
          </Pressable>
        </View>

        {order.addrNotes ? (
          <Text style={styles.addrNotes}>📝 {order.addrNotes}</Text>
        ) : null}

        <View style={styles.actions}>
          {/* READY_FOR_PICKUP: tap Picked Up */}
          {s === 'READY_FOR_PICKUP' && (
            <Pressable
              onPress={() => doAction(order.id, () => riderOpsApi.pickedUp(order.id, accessToken))}
              disabled={busy}
              style={[styles.deliverBtn, { backgroundColor: colors.brand }, busy && styles.disabledBtn]}
            >
              {busy
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="bag-check" size={18} color="#fff" />
              }
              <Text style={styles.primaryBtnTxt}>Picked Up</Text>
            </Pressable>
          )}

          {/* PICKED_UP: enter customer's delivery OTP */}
          {s === 'PICKED_UP' && (
            <View style={{ flex: 1 }}>
              <Text style={styles.otpInputLabel}>Enter Customer Delivery OTP</Text>
              <View style={styles.otpRow}>
                <TextInput
                  style={[styles.otpInput, errMsg ? { borderColor: colors.danger } : null]}
                  placeholder="4-digit code"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={dCode}
                  onChangeText={t => {
                    setOtpInput(prev => ({ ...prev, [order.id]: t.replace(/\D/g, '') }));
                    if (otpError[order.id]) setOtpError(prev => ({ ...prev, [order.id]: '' }));
                  }}
                />
                <Pressable
                  onPress={() => doDeliver(order.id, dCode)}
                  disabled={dCode.length !== 4 || busy}
                  style={[styles.deliverBtn, (dCode.length !== 4 || busy) && styles.disabledBtn]}
                >
                  {busy
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  }
                  <Text style={styles.primaryBtnTxt}>Deliver</Text>
                </Pressable>
              </View>
              {errMsg ? (
                <Text style={styles.otpError}>{errMsg}</Text>
              ) : null}
            </View>
          )}
        </View>
      </View>
    );
  }

  function renderRecentDelivery(order) {
    const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
    const timeStr = deliveredAt
      ? deliveredAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '';
    return (
      <View key={order.id} style={styles.recentCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.recentOrderNum}>#{order.orderNumber}</Text>
          <Text style={styles.recentMeta}>
            {order.partner?.brand || 'Kitchen'} · {paise(order.totalPaise)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={styles.deliveredBadge}>
            <Ionicons name="checkmark-circle" size={12} color={colors.success} />
            <Text style={styles.deliveredBadgeTxt}>Delivered</Text>
          </View>
          {timeStr ? <Text style={styles.recentTime}>{timeStr}</Text> : null}
        </View>
      </View>
    );
  }

  // ── Loading / error screens ────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.centerWrap} edges={['top']}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.loadTxt}>Loading…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centerWrap} edges={['top']}>
        <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
        <Text style={[styles.loadTxt, { color: colors.danger }]}>{error}</Text>
        <Pressable onPress={fetchAll} style={styles.retryBtn}>
          <Text style={styles.retryTxt}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isOnline     = profile?.isOnline ?? false;
  const vehicleEmoji = VEHICLE_ICON[profile?.vehicleType] || '🛺';

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgAlt }} edges={['top']}>
      <View style={styles.header}>
        {navigation.canGoBack()
          ? <Pressable onPress={() => navigation.goBack()} style={styles.back}>
              <Ionicons name="arrow-back" size={22} color={colors.ink} />
            </Pressable>
          : <Pressable onPress={signOut} style={styles.back}>
              <Ionicons name="log-out-outline" size={22} color={colors.danger} />
            </Pressable>
        }
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {vehicleEmoji} {profile?.fullName || user?.name || 'Rider'}
          </Text>
          <Text style={styles.subtitle}>
            {profile?.zoneCode || '—'} · {profile?.vehicleType || '—'}
          </Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={colors.brand} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          {/* Online toggle */}
          <View style={styles.onlineCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.onlineTitle}>
                {isOnline ? '🟢 You are Online' : '🔴 You are Offline'}
              </Text>
              <Text style={styles.onlineHint}>
                {isOnline ? 'Visible to dispatch queue' : 'Go online to accept deliveries'}
              </Text>
            </View>
            <Pressable
              onPress={toggleOnline}
              disabled={togglingOnline}
              style={[styles.onlineToggle, isOnline ? styles.onlineBtnOff : styles.onlineBtnOn]}
            >
              {togglingOnline
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.onlineToggleTxt}>{isOnline ? 'Go Offline' : 'Go Online'}</Text>
              }
            </Pressable>
          </View>

          {/* Wallet summary */}
          {wallet && (
            <View style={styles.walletCard}>
              <Ionicons name="wallet" size={18} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.walletBal}>{paise(wallet.balancePaise)}</Text>
                <Text style={styles.walletLabel}>Wallet Balance</Text>
              </View>
              <Text style={styles.walletEarned}>{paise(wallet.lifetimeCreditPaise)} lifetime</Text>
            </View>
          )}

          {/* Active deliveries */}
          {activeOrders.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Your Active Deliveries</Text>
              {activeOrders.map(renderActiveOrder)}
            </>
          )}

          {/* Available queue */}
          {isOnline ? (
            <>
              <Text style={styles.sectionTitle}>
                {available.length > 0 ? `${available.length} Available` : 'No orders available'}
              </Text>
              {available.map(renderAvailableOrder)}
              {available.length === 0 && (
                <View style={styles.emptyBox}>
                  <Ionicons name="time-outline" size={32} color={colors.inkMuted} />
                  <Text style={styles.emptyTxt}>Waiting for new orders…</Text>
                  <Text style={styles.emptyHint}>Auto-refreshes every 7 seconds</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="radio-outline" size={40} color={colors.inkMuted} />
              <Text style={styles.emptyTxt}>Go online to see orders</Text>
            </View>
          )}

          {/* Completed today */}
          {recentDeliveries.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Completed Today</Text>
              {recentDeliveries.map(renderRecentDelivery)}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg },
  loadTxt:  { fontSize: 14, color: colors.inkSoft },
  retryBtn: { backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radii.md },
  retryTxt: { color: '#fff', fontWeight: '800' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back:       { padding: 4 },
  title:      { fontSize: 17, fontWeight: '800', color: colors.ink },
  subtitle:   { fontSize: 12, color: colors.inkSoft, marginTop: 1 },
  refreshBtn: { padding: 8 },
  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: colors.inkSoft,
    textTransform: 'uppercase', marginTop: space.lg, marginBottom: 8,
  },
  onlineCard: {
    backgroundColor: colors.bg, borderRadius: radii.md, padding: space.md,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    marginBottom: space.sm,
  },
  onlineTitle:    { fontSize: 15, fontWeight: '800', color: colors.ink },
  onlineHint:     { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  onlineToggle:   { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', minWidth: 96 },
  onlineBtnOn:    { backgroundColor: colors.success },
  onlineBtnOff:   { backgroundColor: colors.danger },
  onlineToggleTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  walletCard: {
    backgroundColor: colors.bg, borderRadius: radii.md, padding: space.md,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: colors.border, marginBottom: space.sm,
  },
  walletBal:     { fontSize: 20, fontWeight: '800', color: colors.success },
  walletLabel:   { fontSize: 11, color: colors.inkSoft, fontWeight: '700' },
  walletEarned:  { fontSize: 12, color: colors.inkMuted },
  card: {
    backgroundColor: colors.bg, borderRadius: radii.md, padding: space.md,
    marginBottom: space.sm, borderWidth: 1, borderColor: colors.border,
  },
  activeCard:   { borderColor: colors.brand, borderWidth: 2 },
  cardHead:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  orderNum:     { fontSize: 15, fontWeight: '800', color: colors.ink },
  partnerName:  { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  amount:       { fontSize: 16, fontWeight: '800', color: colors.ink },
  // Contact row (customer name + call)
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6,
  },
  customerLabel: { flex: 1, fontSize: 13, color: colors.ink, fontWeight: '600' },
  miniCallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: colors.brand + '12', borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.brand + '30',
  },
  miniCallTxt: { fontSize: 11, fontWeight: '700', color: colors.brand },
  // Address row (address + map)
  addrRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4,
  },
  addrTxt:    { flex: 1, fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  miniMapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: colors.brand + '12', borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.brand + '30',
  },
  addrNotes:  { fontSize: 12, color: colors.inkMuted, marginBottom: 4, fontStyle: 'italic' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillTxt: { fontSize: 11, fontWeight: '800' },
  actions: { marginTop: 10 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.brand, paddingVertical: 12, borderRadius: radii.sm,
  },
  primaryBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  disabledBtn:   { opacity: 0.5 },
  otpInputLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, marginBottom: 6 },
  otpRow:   { flexDirection: 'row', gap: 8 },
  otpInput: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 22, fontWeight: '800',
    letterSpacing: 8, textAlign: 'center', backgroundColor: colors.bgAlt, color: colors.ink,
  },
  otpError: { fontSize: 12, color: colors.danger, fontWeight: '600', marginTop: 6 },
  deliverBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.success, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radii.sm, justifyContent: 'center',
  },
  itemSummary: { fontSize: 12, color: colors.inkMuted, marginBottom: 10 },
  addr:        { fontSize: 13, color: colors.inkSoft, marginBottom: 8 },
  emptyBox: { alignItems: 'center', paddingVertical: space.xl, gap: 8 },
  emptyTxt: { fontSize: 15, fontWeight: '700', color: colors.ink },
  emptyHint: { fontSize: 13, color: colors.inkMuted },
  recentCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: radii.md, padding: space.md,
    marginBottom: space.sm, borderWidth: 1, borderColor: colors.border,
  },
  recentOrderNum:   { fontSize: 14, fontWeight: '800', color: colors.ink },
  recentMeta:       { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  deliveredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.success + '18', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  deliveredBadgeTxt: { fontSize: 11, fontWeight: '700', color: colors.success },
  recentTime:        { fontSize: 11, color: colors.inkMuted, marginTop: 4 },
});
