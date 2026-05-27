// AdminOpsScreen — minimal admin observation dashboard
// Routes used:
//   GET /api/v1/admin/orders
//   GET /api/v1/admin/analytics
//   GET /api/v1/admin/wallets
//   GET /api/v1/admin/partners
//   GET /api/v1/admin/riders
//   POST /api/v1/admin/orders/:id/cancel

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../state/AuthContext';
import { adminApi } from '../lib/api';
import { colors, radii, space } from '../theme';

const STATUS_COLOR = {
  PLACED:           colors.accent,
  CONFIRMED:        colors.brand,
  PREPARING:        '#7C3AED',
  READY_FOR_PICKUP: '#0EA5E9',
  OUT_FOR_DELIVERY: colors.brand,
  PICKED_UP:        colors.success,
  DELIVERED:        colors.inkMuted,
  CANCELLED:        colors.danger,
  FAILED:           colors.danger,
};

const TABS = ['orders', 'analytics', 'riders', 'partners'];

function paise(p) {
  const n = Number(p);
  if (!p || n === 0) return '₹0';
  return `₹${(n / 100).toFixed(0)}`;
}

export default function AdminOpsScreen({ navigation }) {
  const { accessToken, signOut } = useAuth();
  const [tab, setTab]             = useState('orders');
  const [orders, setOrders]       = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [wallets, setWallets]     = useState([]);
  const [partners, setPartners]   = useState([]);
  const [riders, setRiders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError]         = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const pollRef = useRef(null);

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const [ordRes, analRes, walRes, partRes, ridRes] = await Promise.allSettled([
        adminApi.orders(accessToken, statusFilter || undefined),
        adminApi.analytics(accessToken),
        adminApi.wallets(accessToken),
        adminApi.partners(accessToken),
        adminApi.riders(accessToken),
      ]);
      if (ordRes.status === 'fulfilled')  setOrders(ordRes.value.orders || []);
      if (analRes.status === 'fulfilled') setAnalytics(analRes.value);
      if (walRes.status === 'fulfilled')  setWallets(walRes.value.wallets || []);
      if (partRes.status === 'fulfilled') setPartners(partRes.value.partners || []);
      if (ridRes.status === 'fulfilled')  setRiders(ridRes.value.riders || []);

      // Surface the most critical error
      const firstFail = [ordRes, analRes].find(r => r.status === 'rejected');
      if (firstFail) throw firstFail.reason;
    } catch (e) {
      setError(e.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    pollRef.current = setInterval(() => fetchData(true), 15_000);
    return () => clearInterval(pollRef.current);
  }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  async function cancelOrder(id) {
    Alert.alert('Cancel Order', 'Confirm cancel?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Order', style: 'destructive',
        onPress: async () => {
          setActionLoading(prev => ({ ...prev, [id]: true }));
          try {
            await adminApi.cancelOrder(id, 'Admin cancelled', accessToken);
            await fetchData(true);
          } catch (e) {
            Alert.alert('Error', e.message);
          } finally {
            setActionLoading(prev => ({ ...prev, [id]: false }));
          }
        },
      },
    ]);
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderAnalytics() {
    if (!analytics) return <LoadingPlaceholder />;
    const { orders: ords, gmv, wallets: wals } = analytics;
    return (
      <ScrollView contentContainerStyle={{ padding: space.md }}>
        <Text style={styles.sectionTitle}>Live Metrics</Text>
        <View style={styles.statGrid}>
          <StatCard label="Total Orders"    value={ords.total}     color={colors.brand} />
          <StatCard label="Delivered"       value={ords.delivered} color={colors.success} />
          <StatCard label="Active"          value={ords.active}    color={colors.accent} />
          <StatCard label="Cancelled"       value={ords.cancelled} color={colors.danger} />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: space.lg }]}>GMV</Text>
        <View style={styles.statGrid}>
          <StatCard label="Total GMV"     value={paise(gmv.totalPaise)}     color="#7C3AED" wide />
          <StatCard label="Delivered GMV" value={paise(gmv.deliveredPaise)} color={colors.success} wide />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: space.lg }]}>Payouts</Text>
        <View style={styles.statGrid}>
          <StatCard label="Partner Payouts" value={paise(wals.partnerTotalCreditPaise)} color={colors.brand} wide />
          <StatCard label="Rider Earnings"  value={paise(wals.riderTotalCreditPaise)}  color={colors.success} wide />
        </View>
      </ScrollView>
    );
  }

  function renderOrders() {
    const STATUS_OPTIONS = ['', 'PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP',
      'OUT_FOR_DELIVERY', 'PICKED_UP', 'DELIVERED', 'CANCELLED'];

    return (
      <ScrollView contentContainerStyle={{ padding: space.md }}>
        {/* Status filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {STATUS_OPTIONS.map(s => (
              <Pressable key={s || 'all'} onPress={() => setStatusFilter(s)}
                style={[styles.filterPill, statusFilter === s && styles.filterPillActive]}>
                <Text style={[styles.filterTxt, statusFilter === s && styles.filterTxtActive]}>
                  {s || 'All'}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {orders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={40} color={colors.inkMuted} />
            <Text style={styles.emptyTxt}>No orders</Text>
          </View>
        ) : orders.map(o => {
          const s = o.status;
          const busy = actionLoading[o.id];
          const isTerminal = ['DELIVERED', 'CANCELLED', 'FAILED'].includes(s);
          return (
            <View key={o.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNum}>#{o.orderNumber}</Text>
                  <Text style={styles.subText}>{o.customerName} · {o.partner?.brand}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: (STATUS_COLOR[s] || colors.inkMuted) + '20' }]}>
                  <Text style={[styles.statusPillTxt, { color: STATUS_COLOR[s] || colors.inkMuted }]}>
                    {s.replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.metaTxt}>
                  <Ionicons name="person" size={12} color={colors.inkMuted} />{' '}
                  {o.rider ? o.rider.fullName : 'No rider'}
                </Text>
                <Text style={styles.metaTxt}>
                  {paise(o.totalPaise)} · {o.paymentMethod}
                </Text>
              </View>
              <Text style={styles.metaTxt}>🔒 {o.tamperSealStatus || 'NONE'}</Text>
              {!isTerminal && (
                <Pressable
                  onPress={() => cancelOrder(o.id)}
                  disabled={busy}
                  style={styles.cancelBtn}
                >
                  {busy
                    ? <ActivityIndicator size="small" color={colors.danger} />
                    : <Text style={styles.cancelBtnTxt}>Cancel Order</Text>
                  }
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  }

  function renderRiders() {
    return (
      <ScrollView contentContainerStyle={{ padding: space.md }}>
        {riders.map(r => (
          <View key={r.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNum}>{r.fullName}</Text>
                <Text style={styles.subText}>{r.vehicleType} · Zone {r.zoneCode}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <StatusDot label={r.isOnline ? 'Online' : 'Offline'} ok={r.isOnline} />
                <StatusDot label={r.kycStatus} ok={r.kycStatus === 'APPROVED'} />
              </View>
            </View>
            <Text style={styles.subText}>{r.user?.phone}</Text>
          </View>
        ))}
        {riders.length === 0 && <EmptyState label="No riders found" />}
      </ScrollView>
    );
  }

  function renderPartners() {
    return (
      <ScrollView contentContainerStyle={{ padding: space.md }}>
        {partners.map(p => (
          <View key={p.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNum}>{p.brand}</Text>
                <Text style={styles.subText}>{p.ownerName} · {p.category}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <StatusDot label={p.isActive ? 'Active' : 'Inactive'} ok={p.isActive} />
                <StatusDot label={p.kycStatus} ok={p.kycStatus === 'APPROVED'} />
              </View>
            </View>
            <Text style={styles.subText}>Zone {p.zoneCode} · {p.user?.phone}</Text>
          </View>
        ))}
        {partners.length === 0 && <EmptyState label="No partners found" />}
      </ScrollView>
    );
  }

  const tabContent = {
    orders:    renderOrders,
    analytics: renderAnalytics,
    riders:    renderRiders,
    partners:  renderPartners,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgAlt }} edges={['top']}>
      {/* Header */}
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
          <Text style={styles.title}>Admin Console</Text>
          <Text style={styles.subtitle}>Quickrons Operations</Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshBtn}>
          {refreshing
            ? <ActivityIndicator size="small" color={colors.brand} />
            : <Ionicons name="refresh" size={20} color={colors.brand} />
          }
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <Pressable key={t} onPress={() => setTab(t)}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}>
            <Text style={[styles.tabItemTxt, tab === t && styles.tabItemTxtActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadTxt}>Loading admin data…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
          <Text style={[styles.loadTxt, { color: colors.danger }]}>{error}</Text>
          <Pressable onPress={fetchData} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {tabContent[tab]?.()}
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color, wide }) {
  return (
    <View style={[styles.statCard, wide && styles.statCardWide]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatusDot({ label, ok }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={[styles.dot, { backgroundColor: ok ? colors.success : colors.danger }]} />
      <Text style={styles.dotLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ label }) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name="cube-outline" size={36} color={colors.inkMuted} />
      <Text style={styles.emptyTxt}>{label}</Text>
    </View>
  );
}

function LoadingPlaceholder() {
  return (
    <View style={styles.centerWrap}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { padding: 4 },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 12, color: colors.inkSoft, marginTop: 1 },
  refreshBtn: { padding: 8 },
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.bg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabItem: {
    flex: 1, paddingVertical: 11, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: colors.brand },
  tabItemTxt: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  tabItemTxtActive: { color: colors.brand },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadTxt: { fontSize: 14, color: colors.inkSoft },
  retryBtn: { backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radii.md },
  retryTxt: { color: '#fff', fontWeight: '800' },
  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: colors.inkSoft,
    textTransform: 'uppercase', marginBottom: 8,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: colors.bg, borderRadius: radii.md,
    padding: space.md, borderWidth: 1, borderColor: colors.border,
  },
  statCardWide: { minWidth: '45%' },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 11, color: colors.inkSoft, fontWeight: '700', marginTop: 2 },
  card: {
    backgroundColor: colors.bg, borderRadius: radii.md, padding: space.md,
    marginBottom: space.sm, borderWidth: 1, borderColor: colors.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  orderNum: { fontSize: 15, fontWeight: '800', color: colors.ink },
  subText: { fontSize: 12, color: colors.inkSoft, marginTop: 1 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  metaTxt: { fontSize: 12, color: colors.inkSoft },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusPillTxt: { fontSize: 10, fontWeight: '800' },
  cancelBtn: {
    marginTop: 10, paddingVertical: 8, borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.danger, alignItems: 'center',
  },
  cancelBtnTxt: { color: colors.danger, fontWeight: '800', fontSize: 13 },
  filterPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border,
  },
  filterPillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterTxt: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  filterTxtActive: { color: '#fff' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotLabel: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: space.xl, gap: 8 },
  emptyTxt: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
});
