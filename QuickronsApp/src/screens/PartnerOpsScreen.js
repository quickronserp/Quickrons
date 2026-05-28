// PartnerOpsScreen — real-API partner kitchen operations
// Routes used:
//   GET  /api/v1/partner/orders?status=PLACED
//   GET  /api/v1/partner/orders  (all active)
//   POST /api/v1/partner/orders/:id/accept
//   POST /api/v1/partner/orders/:id/preparing
//   POST /api/v1/partner/orders/:id/ready    → returns tamperSealCode
//   POST /api/v1/partner/orders/:id/seal
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
  const [sealCodes, setSealCodes] = useState({});          // { [orderId]: '123456' }
  const [rejectInput, setRejectInput] = useState({});      // { [orderId]: text }
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const fetchOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      // Fetch all active orders for this partner
      const statusFilter = tab === 'active' ? undefined : 'DELIVERED';
      const res = await partnerApi.orders(accessToken, statusFilter);
      const all = res.orders || [];
      if (tab === 'active') {
        setOrders(all.filter(o => ACTIVE_STATUSES.includes(o.status)));
      } else {
        setOrders(all);
      }
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

  async function doAction(orderId, actionFn, onSuccess) {
    setActionLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      const res = await actionFn();
      // If response has tamperSealCode (from /ready), store it
      if (res.tamperSealCode) {
        setSealCodes(prev => ({ ...prev, [orderId]: res.tamperSealCode }));
      }
      await fetchOrders(true);
      if (onSuccess) onSuccess(res);
    } catch (e) {
      Alert.alert('Error', e.message || 'Action failed');
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
  }

  function renderOrderCard(order) {
    const busy = actionLoading[order.id];
    const sealCode = sealCodes[order.id] || order.tamperSealCode;
    const s = order.status;

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

        {/* Seal code display */}
        {sealCode ? (
          <View style={styles.sealBox}>
            <Ionicons name="lock-closed" size={16} color={colors.success} />
            <Text style={styles.sealLabel}>Tamper Seal Code</Text>
            <Text style={styles.sealCode}>{sealCode}</Text>
            <Text style={styles.sealHint}>Show this to the rider</Text>
          </View>
        ) : null}

        {/* Action buttons */}
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
          {s === 'READY_FOR_PICKUP' && !order.tamperSealStatus?.includes('SEALED') && (
            <ActionBtn
              label="Seal Package"
              icon="lock-closed"
              color={colors.brand}
              busy={busy}
              onPress={() => doAction(order.id, () => partnerApi.seal(order.id, accessToken))}
            />
          )}
          {s === 'READY_FOR_PICKUP' && order.tamperSealStatus === 'SEALED' && (
            <View style={styles.sealedBadge}>
              <Ionicons name="shield-checkmark" size={16} color={colors.success} />
              <Text style={styles.sealedTxt}>Package sealed — awaiting rider</Text>
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
  sealBox: {
    backgroundColor: colors.success + '15', borderRadius: radii.sm, padding: space.md,
    alignItems: 'center', marginBottom: 10, gap: 4,
  },
  sealLabel: { fontSize: 11, fontWeight: '700', color: colors.success, textTransform: 'uppercase' },
  sealCode: { fontSize: 36, fontWeight: '900', color: colors.success, letterSpacing: 8 },
  sealHint: { fontSize: 12, color: colors.success },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.sm, flex: 1,
    justifyContent: 'center', minWidth: 100,
  },
  actionBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  sealedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.success + '15', borderRadius: radii.sm,
  },
  sealedTxt: { fontSize: 13, fontWeight: '700', color: colors.success },
});
