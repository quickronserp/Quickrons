// PartnerOpsScreen — real-API partner kitchen operations
// Routes used:
//   GET  /api/v1/partner/orders?status=PLACED
//   GET  /api/v1/partner/orders  (all active)
//   POST /api/v1/partner/orders/:id/accept
//   POST /api/v1/partner/orders/:id/preparing
//   POST /api/v1/partner/orders/:id/ready
//   POST /api/v1/partner/orders/:id/reject

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, RefreshControl, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../state/AuthContext';
import { partnerApi } from '../lib/api';
import socketClient from '../lib/socket';
import { colors, radii, space } from '../theme';

const ACTIVE_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'];

// Section grouping for the dashboard board — explicit phase per status.
const STATUS_SECTION = {
  PLACED:           'new',
  CONFIRMED:        'preparing',
  PREPARING:        'preparing',
  READY_FOR_PICKUP: 'ready',
};

const SECTION_META = {
  new:       { title: 'New orders',   subtitle: 'Tap to accept or reject', icon: 'notifications' },
  preparing: { title: 'In the kitchen', subtitle: 'Confirmed & cooking',  icon: 'restaurant' },
  ready:     { title: 'Ready for pickup', subtitle: 'Awaiting rider',     icon: 'cube' },
};

const STATUS_COLOR = {
  PLACED:           colors.accent,
  CONFIRMED:        colors.brand,
  PREPARING:        colors.brand,
  READY_FOR_PICKUP: colors.success,
  PICKED_UP:        colors.inkSoft,
  DELIVERED:        colors.inkMuted,
  CANCELLED:        colors.danger,
};

function paise(p) {
  return `₹${(Number(p) / 100).toFixed(0)}`;
}

export default function PartnerOpsScreen({ navigation }) {
  const { accessToken, user, signOut } = useAuth();
  const [tab, setTab] = useState('active');       // 'active' | 'done'
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState({}); // { [orderId]: true }
  const [rejectInput, setRejectInput] = useState({});     // { [orderId]: text }
  const [error, setError] = useState(null);
  // Today summary — derived from the most-recent DELIVERED orders, filtered to
  // today's calendar date. Refreshes on every poll alongside the active list.
  const [todayStats, setTodayStats] = useState({ count: 0, grossPaise: 0 });
  const pollRef = useRef(null);

  const fetchOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      // Two parallel fetches: the visible list AND today's DELIVERED orders
      // (for the summary tile). The DELIVERED fetch is cheap — capped at 50
      // by the backend — and filtered to today's calendar date in JS.
      const statusFilter = tab === 'active' ? undefined : 'DELIVERED';

      const [listRes, deliveredRes] = await Promise.allSettled([
        partnerApi.orders(accessToken, statusFilter),
        // Don't double-fetch if we're already on the done tab
        tab === 'done'
          ? Promise.resolve(null)
          : partnerApi.orders(accessToken, 'DELIVERED'),
      ]);

      if (listRes.status === 'fulfilled') {
        const all = listRes.value.orders || [];
        if (tab === 'active') {
          setOrders(all.filter(o => ACTIVE_STATUSES.includes(o.status)));
        } else {
          setOrders(all);
        }
      } else if (listRes.status === 'rejected') {
        throw listRes.reason;
      }

      // Compute today's summary from whichever response carries DELIVERED data.
      const deliveredOrders =
        (deliveredRes.status === 'fulfilled' && deliveredRes.value?.orders) ||
        (tab === 'done' && listRes.status === 'fulfilled' ? listRes.value.orders : []) ||
        [];
      const todayKey = new Date().toDateString();
      const todays = deliveredOrders.filter(o => new Date(o.createdAt).toDateString() === todayKey);
      const grossPaise = todays.reduce((sum, o) => sum + Number(o.totalPaise || 0), 0);
      setTodayStats({ count: todays.length, grossPaise });
    } catch (e) {
      setError(e.message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, tab]);

  // Initial load + tab switch
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Poll every 10s
  useEffect(() => {
    pollRef.current = setInterval(() => fetchOrders(true), 10_000);
    return () => clearInterval(pollRef.current);
  }, [fetchOrders]);

  // Fetch partner profile once to get Partner model ID for socket room join
  useEffect(() => {
    partnerApi.me(accessToken)
      .then(r => {
        if (r?.partner?.id) {
          socketClient.connect();
          socketClient.joinPartner(r.partner.id);
        }
      })
      .catch(() => {/* not blocking — polling covers it */});
  }, [accessToken]);

  // Socket: listen for any order event on the partner room
  useEffect(() => {
    socketClient.connect();
    const refresh = () => fetchOrders(true);
    const PARTNER_EVENTS = [
      'ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_PREPARING',
      'ORDER_READY', 'ORDER_SEALED', 'ORDER_CANCELLED',
    ];
    PARTNER_EVENTS.forEach(e => socketClient.on(e, refresh));
    return () => PARTNER_EVENTS.forEach(e => socketClient.off(e, refresh));
  }, [fetchOrders]);

  const onRefresh = () => { setRefreshing(true); fetchOrders(); };

  async function doAction(orderId, actionFn) {
    setActionLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      await actionFn();
      await fetchOrders(true);
    } catch (e) {
      Alert.alert('Error', e.message || 'Action failed');
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
  }

  function renderOrderCard(order) {
    const busy = actionLoading[order.id];
    const s    = order.status;

    return (
      <View key={order.id} style={styles.card}>
        {/* Header row */}
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNum}>#{order.orderNumber}</Text>
            <Text style={styles.customerName}>{order.customerName}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: (STATUS_COLOR[s] || colors.inkMuted) + '20' }]}>
            <Text style={[styles.statusPillTxt, { color: STATUS_COLOR[s] || colors.inkMuted }]}>
              {s.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        {/* Items */}
        <View style={styles.items}>
          {(order.items || []).map(item => (
            <Text key={item.id} style={styles.itemRow}>
              {item.qty}× {item.name}
              {item.notesPerRow ? <Text style={styles.itemNote}> ({item.notesPerRow})</Text> : null}
            </Text>
          ))}
        </View>

        {/* Amount + address */}
        <View style={styles.metaRow}>
          <Text style={styles.amount}>{paise(order.totalPaise)}</Text>
          <Text style={styles.meta}>
            {[order.addrLine1, order.addrCity].filter(Boolean).join(', ')}
          </Text>
        </View>

        {/* Action buttons — ACCEPTED → PREPARING → READY_FOR_PICKUP */}
        <View style={styles.actions}>
          {s === 'PLACED' && (
            <>
              <ActionBtn
                label="Accept"
                icon="checkmark-circle"
                color={colors.success}
                busy={busy}
                onPress={() => doAction(order.id, () => partnerApi.accept(order.id, accessToken))}
              />
              <ActionBtn
                label="Reject"
                icon="close-circle"
                color={colors.danger}
                busy={busy}
                onPress={() => {
                  Alert.alert('Reject Order', 'Reason (optional)?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reject', style: 'destructive',
                      onPress: () => doAction(order.id,
                        () => partnerApi.reject(order.id, rejectInput[order.id] || '', accessToken))
                    },
                  ]);
                }}
              />
            </>
          )}
          {s === 'CONFIRMED' && (
            <ActionBtn
              label="Start Preparing"
              icon="restaurant"
              color={colors.brand}
              busy={busy}
              onPress={() => doAction(order.id, () => partnerApi.preparing(order.id, accessToken))}
            />
          )}
          {s === 'PREPARING' && (
            <ActionBtn
              label="Mark Ready"
              icon="checkmark-done"
              color={colors.success}
              busy={busy}
              onPress={() => doAction(order.id, () => partnerApi.ready(order.id, accessToken))}
            />
          )}
          {s === 'READY_FOR_PICKUP' && (
            <View style={styles.awaitingBadge}>
              <Ionicons name="time-outline" size={16} color={colors.inkSoft} />
              <Text style={styles.awaitingTxt}>Awaiting rider pickup</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

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
          <Text style={styles.title}>Partner Kitchen</Text>
          <Text style={styles.subtitle}>
            {user?.name || user?.fullName || user?.phone}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('PartnerMenu')}
          style={styles.menuBtn}
        >
          <Ionicons name="restaurant" size={16} color={colors.brand} />
          <Text style={styles.menuBtnTxt}>Menu</Text>
        </Pressable>
        <Pressable onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={colors.brand} />
        </Pressable>
      </View>

      {/* Today summary — orders count + revenue today */}
      <View style={styles.todayCard}>
        <View style={styles.todayCell}>
          <Text style={styles.todayValue}>{todayStats.count}</Text>
          <Text style={styles.todayLabel}>Orders today</Text>
        </View>
        <View style={styles.todayDivider} />
        <View style={styles.todayCell}>
          <Text style={styles.todayValue}>{paise(todayStats.grossPaise)}</Text>
          <Text style={styles.todayLabel}>Revenue today</Text>
        </View>
        <View style={styles.todayDivider} />
        <View style={styles.todayCell}>
          <Text style={styles.todayValue}>
            {todayStats.count > 0
              ? paise(Math.round(todayStats.grossPaise / todayStats.count))
              : '—'}
          </Text>
          <Text style={styles.todayLabel}>Avg order</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['active', 'done'].map(t => (
          <Pressable key={t} onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
              {t === 'active' ? 'Active Orders' : 'Completed'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadTxt}>Loading orders…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
          <Text style={[styles.loadTxt, { color: colors.danger }]}>{error}</Text>
          <Pressable onPress={fetchOrders} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={48} color={colors.inkMuted} />
          <Text style={styles.emptyTxt}>
            {tab === 'active' ? 'No active orders' : 'No completed orders'}
          </Text>
          <Text style={styles.emptyHint}>Pull down to refresh</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          {tab === 'active' ? (
            // Group active orders into operational phases.
            (() => {
              const groups = { new: [], preparing: [], ready: [] };
              for (const o of orders) {
                const sec = STATUS_SECTION[o.status];
                if (sec) groups[sec].push(o);
              }
              return ['new', 'preparing', 'ready'].map(secKey => {
                const meta  = SECTION_META[secKey];
                const list  = groups[secKey];
                return (
                  <View key={secKey} style={{ marginBottom: space.lg }}>
                    <View style={styles.sectionHead}>
                      <Ionicons name={meta.icon} size={14} color={colors.inkSoft} />
                      <Text style={styles.sectionTitle}>
                        {meta.title}
                        <Text style={styles.sectionCount}>  {list.length}</Text>
                      </Text>
                      <Text style={styles.sectionHint}>{meta.subtitle}</Text>
                    </View>
                    {list.length === 0
                      ? <Text style={styles.sectionEmpty}>—</Text>
                      : list.map(renderOrderCard)
                    }
                  </View>
                );
              });
            })()
          ) : (
            orders.map(renderOrderCard)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ActionBtn({ label, icon, color, busy, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.actionBtn, { backgroundColor: color }]}
    >
      {busy
        ? <ActivityIndicator size="small" color="#fff" />
        : <Ionicons name={icon} size={16} color="#fff" />
      }
      <Text style={styles.actionBtnTxt}>{label}</Text>
    </Pressable>
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
  menuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.brand + '40', backgroundColor: colors.brandTint,
  },
  menuBtnTxt: { fontSize: 12, fontWeight: '800', color: colors.brand },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: colors.ink,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  sectionCount: { color: colors.brand },
  sectionHint:  { fontSize: 11, color: colors.inkMuted, marginLeft: 'auto' },
  sectionEmpty: { fontSize: 13, color: colors.inkMuted, paddingVertical: 6 },

  todayCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: 14, paddingHorizontal: space.md,
  },
  todayCell:    { flex: 1, alignItems: 'center', gap: 2 },
  todayDivider: { width: 1, height: 28, backgroundColor: colors.border },
  todayValue:   { fontSize: 18, fontWeight: '900', color: colors.brand },
  todayLabel:   { fontSize: 10, fontWeight: '700', color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tabs: {
    flexDirection: 'row', backgroundColor: colors.bg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.brand },
  tabTxt: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  tabTxtActive: { color: colors.brand },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: space.xl },
  loadTxt: { fontSize: 14, color: colors.inkSoft },
  emptyTxt: { fontSize: 16, fontWeight: '700', color: colors.ink },
  emptyHint: { fontSize: 13, color: colors.inkMuted },
  retryBtn: {
    backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: radii.md, marginTop: 8,
  },
  retryTxt: { color: '#fff', fontWeight: '800' },
  card: {
    backgroundColor: colors.bg, borderRadius: radii.md, padding: space.md,
    marginBottom: space.md, borderWidth: 1, borderColor: colors.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  orderNum: { fontSize: 15, fontWeight: '800', color: colors.ink },
  customerName: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  statusPillTxt: { fontSize: 11, fontWeight: '800' },
  items: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginBottom: 8 },
  itemRow: { fontSize: 14, color: colors.ink, marginBottom: 3, fontWeight: '500' },
  itemNote: { color: colors.inkSoft, fontWeight: '400' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  amount: { fontSize: 16, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 12, color: colors.inkSoft, flex: 1, textAlign: 'right', marginLeft: 8 },
  awaitingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.bgAlt, borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  awaitingTxt: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.sm, flex: 1,
    justifyContent: 'center', minWidth: 100,
  },
  actionBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
