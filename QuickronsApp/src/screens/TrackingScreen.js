import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../lib/api';
import { useAuth } from '../state/AuthContext';
import socketClient from '../lib/socket';
import { colors, radii, space } from '../theme';

// Map backend order status → UI stage index
const STATUS_TO_STAGE = {
  PLACED:            0,
  CONFIRMED:         1,
  PREPARING:         1,
  READY_FOR_PICKUP:  2,
  PICKED_UP:         3, // schema status — rider collected the order
  OUT_FOR_DELIVERY:  3,
  DELIVERED:         4,
  CANCELLED:         4, // terminal — handled separately
  FAILED:            4, // terminal
};

const STAGES = [
  { id: 'placed',    label: 'Order placed',      icon: 'checkmark-circle' },
  { id: 'cooking',   label: 'Kitchen accepted',  icon: 'restaurant' },
  { id: 'ready',     label: 'Ready for pickup',  icon: 'cube' },
  { id: 'enroute',   label: 'Auto en route 🛺',  icon: 'car' },
  { id: 'delivered', label: 'Delivered',         icon: 'home' },
];

// Socket events that signal a status advance
const ADVANCE_EVENTS = [
  'ORDER_CONFIRMED',
  'ORDER_PREPARING',
  'ORDER_READY',
  'ORDER_SEALED',
  'RIDER_ASSIGNED',
  'RIDER_VERIFIED_SEAL',  // was missing — status advances to OUT_FOR_DELIVERY on this event
  'ORDER_PICKED_UP',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
];

export default function TrackingScreen({ route, navigation }) {
  const { orderId } = route.params || {};
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [cancelled, setCancelled] = useState(false);

  // ── Fetch order ────────────────────────────────────────────────────────────

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', orderId],
    queryFn:  () => ordersApi.get(orderId, accessToken),
    enabled:  !!accessToken && !!orderId,
    select:   (res) => res.order || res,
    // Poll every 30s as a fallback even if socket misses
    refetchInterval: 30_000,
  });

  const status      = order?.status || 'PLACED';
  const stage       = STATUS_TO_STAGE[status] ?? 0;
  const orderNumber = order?.orderNumber || '—';
  const rider       = order?.rider || null;

  // ── Socket.IO ──────────────────────────────────────────────────────────────

  const invalidate = useRef(() =>
    queryClient.invalidateQueries({ queryKey: ['order', orderId] })
  );
  // Keep ref current without re-registering listeners
  invalidate.current = () =>
    queryClient.invalidateQueries({ queryKey: ['order', orderId] });

  useEffect(() => {
    if (!orderId) return;

    socketClient.connect();
    socketClient.joinOrder(orderId);

    const handleAdvance = () => invalidate.current();
    const handleCancelled = () => {
      setCancelled(true);
      invalidate.current();
    };

    ADVANCE_EVENTS.forEach(evt => {
      if (evt === 'ORDER_CANCELLED') {
        socketClient.on(evt, handleCancelled);
      } else {
        socketClient.on(evt, handleAdvance);
      }
    });

    return () => {
      ADVANCE_EVENTS.forEach(evt => {
        if (evt === 'ORDER_CANCELLED') {
          socketClient.off(evt, handleCancelled);
        } else {
          socketClient.off(evt, handleAdvance);
        }
      });
    };
  }, [orderId]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!orderId) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.inkMuted} />
        <Text style={styles.statusTxt}>No order to track</Text>
        <Pressable onPress={() => navigation.navigate('HomeTab')} style={styles.homeBtn}>
          <Text style={styles.homeBtnTxt}>Go home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.statusTxt}>Loading order…</Text>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.inkMuted} />
        <Text style={styles.statusTxt}>Couldn't load order</Text>
        <Pressable onPress={() => navigation.navigate('HomeTab')} style={styles.homeBtn}>
          <Text style={styles.homeBtnTxt}>Go home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (cancelled || status === 'CANCELLED') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Order #{orderNumber}</Text>
          <Pressable onPress={() => navigation.navigate('HomeTab')}>
            <Ionicons name="close" size={24} color={colors.ink} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Ionicons name="close-circle" size={56} color={colors.danger} />
          <Text style={[styles.statusTxt, { fontSize: 18, fontWeight: '800', color: colors.ink }]}>
            Order cancelled
          </Text>
          <Text style={styles.statusTxt}>
            {order.cancelledReason || 'This order was cancelled.'}
          </Text>
          <Pressable onPress={() => navigation.navigate('HomeTab')} style={styles.homeBtn}>
            <Text style={styles.homeBtnTxt}>Browse kitchens</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const etaMins = Math.max(2, 30 - stage * 6);

  const isDelivered = status === 'DELIVERED';
  const isFailed    = status === 'FAILED';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('HomeTab')}
          style={{ padding: 4 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Order #{orderNumber}</Text>
        <Pressable onPress={() => navigation.navigate('HomeTab')} style={{ padding: 4 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        {/* ETA card */}
        {isDelivered ? (
          <View style={[styles.etaCard, { backgroundColor: colors.success }]}>
            <Text style={styles.etaLabel}>Order delivered ✓</Text>
            <Text style={styles.etaTime}>Enjoy!</Text>
            <Text style={styles.etaDesc}>Thank you for ordering with Quickrons</Text>
          </View>
        ) : isFailed ? (
          <View style={[styles.etaCard, { backgroundColor: colors.danger }]}>
            <Text style={styles.etaLabel}>Order failed</Text>
            <Text style={styles.etaTime}>Sorry</Text>
            <Text style={styles.etaDesc}>Something went wrong with this order</Text>
          </View>
        ) : (
          <View style={styles.etaCard}>
            <Text style={styles.etaLabel}>Estimated arrival</Text>
            <Text style={styles.etaTime}>{etaMins}–{etaMins + 5} min</Text>
            <Text style={styles.etaDesc}>{STAGES[Math.min(stage, STAGES.length - 1)].label}</Text>
          </View>
        )}

        {/* Progress stages */}
        <View style={styles.stages}>
          {STAGES.map((s, i) => (
            <View key={s.id} style={styles.stageRow}>
              <View style={[styles.stageIcon, i <= stage && styles.stageIconActive]}>
                <Ionicons
                  name={s.icon}
                  size={16}
                  color={i <= stage ? '#fff' : colors.inkMuted}
                />
              </View>
              <Text style={[styles.stageLabel, i <= stage && styles.stageLabelActive]}>
                {s.label}
              </Text>
              {i < STAGES.length - 1 && (
                <View style={[styles.connector, i < stage && styles.connectorActive]} />
              )}
            </View>
          ))}
        </View>

        {/* Rider card — show once assigned */}
        {rider ? (
          <View style={styles.riderCard}>
            <View style={styles.riderAvatar}>
              <Ionicons name="person" size={22} color={colors.bg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.riderName}>{rider.fullName || 'Your rider'}</Text>
              <Text style={styles.riderMeta}>Auto · Quickrons</Text>
            </View>
            <Pressable style={styles.callBtn}>
              <Ionicons name="call" size={18} color={colors.brand} />
            </Pressable>
          </View>
        ) : stage >= 2 ? (
          <View style={styles.riderCard}>
            <View style={[styles.riderAvatar, { backgroundColor: colors.bgAlt }]}>
              <ActivityIndicator size="small" color={colors.brand} />
            </View>
            <Text style={[styles.riderName, { color: colors.inkSoft }]}>
              Finding your rider…
            </Text>
          </View>
        ) : null}

        {/* Delivery OTP — customer reads this 4-digit code to the rider at the door */}
        {status === 'PICKED_UP' && order?.tamperSealCode && (
          <View style={styles.verifyCard}>
            <View style={styles.verifyHeader}>
              <Ionicons name="key" size={20} color={colors.brand} />
              <Text style={styles.verifyTitle}>Your Delivery Code</Text>
            </View>
            <Text style={styles.verifyHint}>
              When your rider arrives, read this code to them. They will enter it
              in their app to confirm delivery.
            </Text>
            <Text style={styles.otpDisplay}>{order.tamperSealCode}</Text>
          </View>
        )}

        {/* Done button */}
        {status === 'DELIVERED' && (
          <Pressable
            onPress={() => navigation.navigate('HomeTab')}
            style={styles.doneBtn}>
            <Text style={styles.doneTxt}>Order delivered — Rate your experience</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.ink, flex: 1, textAlign: 'center' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg, gap: 12, padding: space.xl,
  },
  statusTxt: { fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  homeBtn: {
    backgroundColor: colors.brand, borderRadius: radii.md,
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 8,
  },
  homeBtnTxt: { color: '#fff', fontWeight: '800' },
  etaCard: {
    backgroundColor: colors.ink, padding: space.lg, borderRadius: radii.lg,
  },
  etaLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  etaTime:  { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4 },
  etaDesc:  { color: colors.accent, fontSize: 14, fontWeight: '700', marginTop: 4 },
  stages: { marginTop: space.xl },
  stageRow: {
    flexDirection: 'row', alignItems: 'center', position: 'relative', marginBottom: 22,
  },
  stageIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bgAlt,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  stageIconActive: { backgroundColor: colors.success },
  stageLabel: { fontSize: 14, color: colors.inkMuted, fontWeight: '600' },
  stageLabelActive: { color: colors.ink, fontWeight: '700' },
  connector: {
    position: 'absolute', left: 14, top: 30, width: 2, height: 22,
    backgroundColor: colors.border,
  },
  connectorActive: { backgroundColor: colors.success },
  riderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bgAlt, padding: space.md, borderRadius: radii.md, marginTop: space.lg,
  },
  riderAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  riderName: { fontSize: 15, fontWeight: '800', color: colors.ink },
  riderMeta: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  callBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.brand,
  },
  trustCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.success + '10', padding: space.md, borderRadius: radii.md,
    marginTop: space.md,
  },
  trustTitle: { fontSize: 13, fontWeight: '800', color: colors.success },
  trustDesc:  { fontSize: 12, color: colors.success, marginTop: 2, lineHeight: 18 },
  doneBtn: {
    backgroundColor: colors.brand, borderRadius: radii.md, padding: 14,
    alignItems: 'center', marginTop: space.xl,
  },
  doneTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  verifyCard: {
    backgroundColor: colors.brandTint, borderRadius: radii.md, padding: space.md,
    marginTop: space.md, borderWidth: 1, borderColor: colors.brand + '40',
    alignItems: 'center',
  },
  verifyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  verifyTitle: { fontSize: 15, fontWeight: '800', color: colors.brand },
  verifyHint: { fontSize: 13, color: colors.inkSoft, marginBottom: 12, lineHeight: 18, textAlign: 'center' },
  otpDisplay: {
    fontSize: 48, fontWeight: '900', color: colors.brand,
    letterSpacing: 14, textAlign: 'center', paddingVertical: 8,
  },
});
