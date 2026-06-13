import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Modal, TextInput, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../lib/api';
import { useAuth } from '../state/AuthContext';
import socketClient from '../lib/socket';
import { colors, radii, space } from '../theme';
import { layout } from '../lib/layout';

// ── Status → stage index ───────────────────────────────────────────────────────

const STATUS_TO_STAGE = {
  PLACED:            0,
  CONFIRMED:         1,
  PREPARING:         1,
  READY_FOR_PICKUP:  2,
  PICKED_UP:         3,
  OUT_FOR_DELIVERY:  3,
  DELIVERED:         4,
  CANCELLED:         4,
  FAILED:            4,
};

const STAGES = [
  { id: 'placed',    label: 'Order placed',     icon: 'checkmark-circle' },
  { id: 'cooking',   label: 'Kitchen accepted', icon: 'restaurant' },
  { id: 'ready',     label: 'Ready for pickup', icon: 'cube' },
  { id: 'enroute',   label: 'Rider on the way', icon: 'car' },
  { id: 'delivered', label: 'Delivered',        icon: 'home' },
];

// Socket events that signal a status advance (no tamper-seal events)
const ADVANCE_EVENTS = [
  'ORDER_CONFIRMED', 'ORDER_PREPARING', 'ORDER_READY',
  'RIDER_ASSIGNED', 'ORDER_PICKED_UP', 'ORDER_DELIVERED', 'ORDER_CANCELLED',
];

// Open the delivery location in Google Maps (works on Android + iOS + web).
function openDeliveryMap(order) {
  const lat = parseFloat(order?.addrLat);
  const lng = parseFloat(order?.addrLng);
  let url;
  if (!isNaN(lat) && !isNaN(lng)) {
    url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  } else {
    const label = [order?.addrLine1, order?.addrCity, order?.addrPincode].filter(Boolean).join(', ');
    if (!label) return;
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
  }
  Linking.openURL(url).catch(() =>
    Alert.alert('Cannot open maps', 'Install Google Maps or check your connection.')
  );
}

// Timeout-safe fetch — rejects after `ms` milliseconds
function withTimeout(promise, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return promise.finally(() => clearTimeout(timer));
}

// ── StarRow — tappable 1-5 star selector ─────────────────────────────────────

function StarRow({ label, value, onChange }) {
  return (
    <View style={ratingStyles.starGroup}>
      <Text style={ratingStyles.starLabel}>{label}</Text>
      <View style={ratingStyles.starsRow}>
        {[1, 2, 3, 4, 5].map(n => (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
            <Ionicons
              name={n <= value ? 'star' : 'star-outline'}
              size={34}
              color={n <= value ? colors.accent : colors.inkMuted}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── RatingModal ────────────────────────────────────────────────────────────────
//
// Posts to the backend (ordersApi.submitRating). The order's existing rating
// (order.rating) is passed in; when present the modal opens straight into the
// thank-you state so a delivered order can never be rated twice.

function RatingModal({ orderId, token, existingRating, visible, onClose, onSubmitted }) {
  const alreadyRated = !!existingRating;

  const [food,     setFood]     = useState(0);
  const [delivery, setDelivery] = useState(0);
  const [note,     setNote]     = useState('');
  const [saved,    setSaved]    = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset / seed local state each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    if (alreadyRated) {
      setFood(existingRating.foodRating || 0);
      setDelivery(existingRating.deliveryRating || 0);
      setNote(existingRating.reviewText || '');
      setSaved(true);
    } else {
      setFood(0); setDelivery(0); setNote(''); setSaved(false);
    }
    setSubmitting(false);
  }, [visible, alreadyRated, existingRating]);

  async function submit() {
    if (food === 0 || delivery === 0) {
      Alert.alert('Rate your experience', 'Please rate both the food and the delivery.');
      return;
    }
    setSubmitting(true);
    try {
      await ordersApi.submitRating(
        orderId,
        { foodRating: food, deliveryRating: delivery, reviewText: note.trim() || undefined },
        token,
      );
      setSaved(true);
      onSubmitted?.();
    } catch (e) {
      // 409 = already rated (raced another submit) — treat as success.
      if (e?.status === 409) {
        setSaved(true);
        onSubmitted?.();
      } else {
        Alert.alert('Could not submit', e?.message || 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ratingStyles.backdrop} onPress={onClose}>
        <Pressable style={ratingStyles.sheet} onPress={e => e.stopPropagation()}>
          <View style={ratingStyles.handle} />

          {saved ? (
            <>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} style={{ alignSelf: 'center', marginBottom: 8 }} />
              <Text style={ratingStyles.title}>Thank you!</Text>
              <Text style={ratingStyles.sub}>
                {alreadyRated
                  ? 'You already rated this order.'
                  : 'Your feedback helps us improve Quickrons.'}
              </Text>
              <Pressable onPress={onClose} style={ratingStyles.doneBtn}>
                <Text style={ratingStyles.doneBtnTxt}>Close</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={ratingStyles.title}>How was your order?</Text>
              <Text style={ratingStyles.sub}>Tap a star to rate each part.</Text>

              <StarRow label="Food" value={food} onChange={setFood} />
              <StarRow label="Delivery" value={delivery} onChange={setDelivery} />

              <TextInput
                style={ratingStyles.noteInput}
                placeholder="Tell us more (optional)"
                placeholderTextColor={colors.inkMuted}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={500}
              />

              <Pressable
                onPress={submit}
                disabled={submitting}
                style={[ratingStyles.submitBtn, submitting && { opacity: 0.6 }]}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={ratingStyles.submitBtnTxt}>Submit</Text>}
              </Pressable>

              <Pressable onPress={onClose} style={ratingStyles.skipBtn}>
                <Text style={ratingStyles.skipBtnTxt}>Skip</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function TrackingScreen({ route, navigation }) {
  const { orderId } = route.params || {};
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [cancelled, setCancelled] = useState(false);
  const [showRating, setShowRating] = useState(false);

  // ── Fetch order (10 s timeout, 1 retry) ────────────────────────────────────

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn:  () => withTimeout(ordersApi.get(orderId, accessToken), 10_000),
    enabled:  !!accessToken && !!orderId,
    select:   (res) => res.order || res,
    staleTime:       15_000,
    retry:           1,
    // Stop background polling once delivered/failed/cancelled — order won't change
    refetchInterval: (data) => {
      const s = data?.status;
      if (s === 'DELIVERED' || s === 'CANCELLED' || s === 'FAILED') return false;
      return 30_000;
    },
  });

  const status      = order?.status || 'PLACED';
  const stage       = STATUS_TO_STAGE[status] ?? 0;
  const orderNumber = order?.orderNumber || '—';
  const rider       = order?.rider || null;
  // Privacy-first: the rider's raw number is never in the payload. We resolve a
  // dialable target on demand via the contact endpoint when the customer taps Call.
  const canCallRider = !!rider && ['READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(status);
  const [calling, setCalling] = useState(false);

  const isDelivered = status === 'DELIVERED';
  const isFailed    = status === 'FAILED';

  // ── Socket ─────────────────────────────────────────────────────────────────

  const invalidate = useRef(() =>
    queryClient.invalidateQueries({ queryKey: ['order', orderId] })
  );
  invalidate.current = () =>
    queryClient.invalidateQueries({ queryKey: ['order', orderId] });

  useEffect(() => {
    if (!orderId) return;
    socketClient.connect();
    socketClient.joinOrder(orderId);

    const handleAdvance   = () => invalidate.current();
    const handleCancelled = () => { setCancelled(true); invalidate.current(); };

    ADVANCE_EVENTS.forEach(evt =>
      socketClient.on(evt, evt === 'ORDER_CANCELLED' ? handleCancelled : handleAdvance)
    );
    return () => ADVANCE_EVENTS.forEach(evt =>
      socketClient.off(evt, evt === 'ORDER_CANCELLED' ? handleCancelled : handleAdvance)
    );
  }, [orderId]);

  // ── Call rider ─────────────────────────────────────────────────────────────

  const callRider = useCallback(async () => {
    if (calling) return;
    setCalling(true);
    try {
      const { contact } = await ordersApi.contact(orderId, accessToken);
      if (!contact?.dial) {
        Alert.alert('Cannot call', 'No contact number is available right now.');
        return;
      }
      Linking.openURL(`tel:${contact.dial}`).catch(() =>
        Alert.alert('Cannot call', 'Your device cannot make calls right now.')
      );
    } catch (e) {
      Alert.alert('Cannot call', e?.message || 'Could not connect the call.');
    } finally {
      setCalling(false);
    }
  }, [orderId, accessToken, calling]);

  // ── Render helpers ─────────────────────────────────────────────────────────

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
        <Pressable onPress={() => refetch()} style={styles.homeBtn}>
          <Text style={styles.homeBtnTxt}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('HomeTab')} style={[styles.homeBtn, { backgroundColor: colors.bgAlt, marginTop: 8 }]}>
          <Text style={[styles.homeBtnTxt, { color: colors.inkSoft }]}>Go home</Text>
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
     <View style={layout.screen}>
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

        {/* ETA / status card */}
        {isDelivered ? (
          <View style={[styles.etaCard, { backgroundColor: colors.success }]}>
            <Text style={styles.etaLabel}>Delivered ✓</Text>
            <Text style={styles.etaTime}>Enjoy your meal!</Text>
            <Text style={styles.etaDesc}>Thank you for ordering with Quickrons</Text>
          </View>
        ) : isFailed ? (
          <View style={[styles.etaCard, { backgroundColor: colors.danger }]}>
            <Text style={styles.etaLabel}>Order failed</Text>
            <Text style={styles.etaTime}>Sorry</Text>
            <Text style={styles.etaDesc}>Contact support for assistance</Text>
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
                <Ionicons name={s.icon} size={16} color={i <= stage ? '#fff' : colors.inkMuted} />
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

        {/* Rider card
            • Show rider info (with call button) once assigned.
            • "Finding your rider…" only while READY_FOR_PICKUP / PICKED_UP and no rider yet.
            • Never shown for DELIVERED or FAILED. */}
        {rider ? (
          <View style={styles.riderCard}>
            <View style={styles.riderAvatar}>
              <Ionicons name="person" size={22} color={colors.bg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.riderName}>{rider.fullName || 'Your rider'}</Text>
              <Text style={styles.riderMeta}>
                {rider.vehicleType ? rider.vehicleType.replace('_', ' ') : 'Quickrons'} · Quickrons
              </Text>
            </View>
            {canCallRider ? (
              <Pressable onPress={callRider} disabled={calling} style={styles.callBtn}>
                {calling
                  ? <ActivityIndicator size="small" color={colors.brand} />
                  : <Ionicons name="call" size={18} color={colors.brand} />}
              </Pressable>
            ) : (
              <View style={[styles.callBtn, { borderColor: colors.border }]}>
                <Ionicons name="call" size={18} color={colors.inkMuted} />
              </View>
            )}
          </View>
        ) : stage >= 2 && !isDelivered && !isFailed ? (
          <View style={styles.riderCard}>
            <View style={[styles.riderAvatar, { backgroundColor: colors.bgAlt }]}>
              <ActivityIndicator size="small" color={colors.brand} />
            </View>
            <Text style={[styles.riderName, { color: colors.inkSoft }]}>
              Finding your rider…
            </Text>
          </View>
        ) : null}

        {/* Delivery address + map — only while the order is in flight */}
        {!isDelivered && !isFailed && (order.addrLine1 || order.addrCity) ? (
          <View style={styles.addrCard}>
            <Ionicons name="location" size={18} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrCardLabel}>Delivering to</Text>
              <Text style={styles.addrCardTxt} numberOfLines={2}>
                {[order.addrLine1, order.addrLandmark, order.addrCity, order.addrPincode].filter(Boolean).join(', ')}
              </Text>
            </View>
            <Pressable onPress={() => openDeliveryMap(order)} style={styles.mapBtn} hitSlop={6}>
              <Ionicons name="navigate" size={16} color={colors.brand} />
              <Text style={styles.mapBtnTxt}>Map</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Delivery OTP — customer reads this code to the rider at door */}
        {status === 'PICKED_UP' && order?.deliveryOtp && (
          <View style={styles.verifyCard}>
            <View style={styles.verifyHeader}>
              <Ionicons name="key" size={20} color={colors.brand} />
              <Text style={styles.verifyTitle}>Your Delivery Code</Text>
            </View>
            <Text style={styles.verifyHint}>
              When your rider arrives, read this code to them. They will enter it
              in their app to confirm delivery.
            </Text>
            <Text style={styles.otpDisplay}>{order.deliveryOtp}</Text>
          </View>
        )}

        {/* Delivered — rate + done */}
        {isDelivered && (
          <View style={{ gap: 10, marginTop: space.xl }}>
            {order.rating ? (
              <Pressable onPress={() => setShowRating(true)} style={styles.ratedBtn}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.ratedBtnTxt}>
                  You rated this order {'★'.repeat(order.rating.overallRating || 0)}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setShowRating(true)} style={styles.rateBtn}>
                <Ionicons name="star" size={18} color={colors.accent} />
                <Text style={styles.rateBtnTxt}>Rate your experience</Text>
              </Pressable>
            )}
            <Pressable onPress={() => navigation.navigate('HomeTab')} style={styles.doneBtn}>
              <Text style={styles.doneTxt}>Back to home</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Rating modal */}
      {orderId && (
        <RatingModal
          orderId={orderId}
          token={accessToken}
          existingRating={order.rating || null}
          visible={showRating}
          onClose={() => setShowRating(false)}
          onSubmitted={() => invalidate.current()}
        />
      )}
     </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

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
  etaCard: { backgroundColor: colors.ink, padding: space.lg, borderRadius: radii.lg },
  etaLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  etaTime:  { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4 },
  etaDesc:  { color: colors.accent, fontSize: 14, fontWeight: '700', marginTop: 4 },
  stages: { marginTop: space.xl },
  stageRow: { flexDirection: 'row', alignItems: 'center', position: 'relative', marginBottom: 22 },
  stageIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bgAlt,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  stageIconActive: { backgroundColor: colors.success },
  stageLabel: { fontSize: 14, color: colors.inkMuted, fontWeight: '600' },
  stageLabelActive: { color: colors.ink, fontWeight: '700' },
  connector: { position: 'absolute', left: 14, top: 30, width: 2, height: 22, backgroundColor: colors.border },
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
    borderWidth: 1.5, borderColor: colors.brand,
  },
  addrCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bgAlt, padding: space.md, borderRadius: radii.md,
    marginTop: space.md, borderWidth: 1, borderColor: colors.border,
  },
  addrCardLabel: { fontSize: 11, color: colors.inkMuted, fontWeight: '700', textTransform: 'uppercase' },
  addrCardTxt: { fontSize: 13, color: colors.ink, marginTop: 2, lineHeight: 18 },
  mapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm,
    borderWidth: 1.5, borderColor: colors.brand,
  },
  mapBtnTxt: { fontSize: 12, fontWeight: '800', color: colors.brand },
  verifyCard: {
    backgroundColor: colors.brandTint, borderRadius: radii.md, padding: space.md,
    marginTop: space.md, borderWidth: 1, borderColor: colors.brand + '40', alignItems: 'center',
  },
  verifyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  verifyTitle: { fontSize: 15, fontWeight: '800', color: colors.brand },
  verifyHint: { fontSize: 13, color: colors.inkSoft, marginBottom: 12, lineHeight: 18, textAlign: 'center' },
  otpDisplay: {
    fontSize: 48, fontWeight: '900', color: colors.brand,
    letterSpacing: 14, textAlign: 'center', paddingVertical: 8,
  },
  rateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.accent + '18', borderRadius: radii.md, padding: 14,
    borderWidth: 1, borderColor: colors.accent + '40',
  },
  rateBtnTxt: { color: colors.accent, fontWeight: '800', fontSize: 15 },
  ratedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.success + '14', borderRadius: radii.md, padding: 14,
    borderWidth: 1, borderColor: colors.success + '40',
  },
  ratedBtnTxt: { color: colors.success, fontWeight: '800', fontSize: 15 },
  doneBtn: {
    backgroundColor: colors.bgAlt, borderRadius: radii.md, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  doneTxt: { color: colors.inkSoft, fontWeight: '700', fontSize: 14 },
});

const ratingStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    padding: space.xl, paddingBottom: 36,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: space.lg,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: 4 },
  sub:   { fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginBottom: space.lg },
  starGroup: { marginBottom: space.md },
  starLabel: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginBottom: 6, textAlign: 'center' },
  starsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 10,
  },
  noteInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md,
    padding: space.md, fontSize: 14, color: colors.ink,
    minHeight: 80, textAlignVertical: 'top', marginBottom: space.md,
  },
  submitBtn: {
    backgroundColor: colors.brand, borderRadius: radii.md, padding: 14, alignItems: 'center',
    marginBottom: space.sm,
  },
  submitBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  skipBtn:  { alignItems: 'center', padding: 10 },
  skipBtnTxt: { color: colors.inkMuted, fontWeight: '600', fontSize: 14 },
  doneBtn: {
    backgroundColor: colors.brand, borderRadius: radii.md, padding: 14,
    alignItems: 'center', marginTop: space.md,
  },
  doneBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
