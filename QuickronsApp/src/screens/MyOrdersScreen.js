import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../lib/api';
import { useAuth } from '../state/AuthContext';
import { colors, radii, space } from '../theme';

const STATUS_LABEL = {
  PLACED:           'Order placed',
  CONFIRMED:        'Confirmed',
  PREPARING:        'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED:        'Delivered',
  CANCELLED:        'Cancelled',
  FAILED:           'Failed',
};

const STATUS_COLOR = {
  PLACED:           colors.brand,
  CONFIRMED:        colors.brand,
  PREPARING:        '#F59E0B',
  READY_FOR_PICKUP: '#F59E0B',
  OUT_FOR_DELIVERY: '#3B82F6',
  DELIVERED:        colors.success,
  CANCELLED:        colors.danger,
  FAILED:           colors.danger,
};

const ACTIVE_STATUSES = new Set([
  'PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY',
]);

export default function MyOrdersScreen({ navigation }) {
  const { accessToken } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-orders'],
    queryFn:  () => ordersApi.myList(accessToken),
    enabled:  !!accessToken,
    select:   (res) => res.orders || res.data || res || [],
    staleTime: 30_000,
  });

  const orders = data || [];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.statusTxt}>Loading orders…</Text>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.inkMuted} />
        <Text style={styles.statusTxt}>Couldn't load orders</Text>
        <Pressable onPress={refetch} style={styles.retryBtn}>
          <Text style={styles.retryTxt}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgAlt }} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>My orders</Text>
        <View style={{ width: 36 }} />
      </View>

      {orders.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={56} color={colors.inkMuted} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.statusTxt}>Your order history will appear here.</Text>
          <Pressable onPress={() => navigation.navigate('HomeTab')} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Browse kitchens</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => o.id}
          contentContainerStyle={{ padding: space.lg, gap: 12 }}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() =>
                ACTIVE_STATUSES.has(item.status)
                  ? navigation.navigate('Tracking', { orderId: item.id })
                  : null
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function OrderCard({ order, onPress }) {
  const label    = STATUS_LABEL[order.status] || order.status;
  const color    = STATUS_COLOR[order.status] || colors.inkSoft;
  const isActive = ACTIVE_STATUSES.has(order.status);

  // Item summary: first 2 items + "and N more"
  const allItems  = order.items || order.orderItems || [];
  const preview   = allItems.slice(0, 2);
  const moreCount = Math.max(0, allItems.length - 2);

  const placedAt  = order.createdAt ? new Date(order.createdAt) : null;
  const dateStr   = placedAt
    ? placedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const totalRupees = order.totalPaise != null
    ? Math.round(order.totalPaise / 100)
    : null;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, isActive && styles.cardActive]}>
      {/* Header row */}
      <View style={styles.cardHead}>
        <View>
          <Text style={styles.orderNum}>#{order.orderNumber || order.id?.slice(-8)}</Text>
          {dateStr ? <Text style={styles.dateStr}>{dateStr}</Text> : null}
        </View>
        <View style={[styles.statusPill, { backgroundColor: color + '18' }]}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusTxtBadge, { color }]}>{label}</Text>
        </View>
      </View>

      {/* Kitchen name */}
      {order.partner?.businessName ? (
        <Text style={styles.kitchenName} numberOfLines={1}>
          {order.partner.businessName}
        </Text>
      ) : null}

      {/* Items preview */}
      {preview.length > 0 && (
        <Text style={styles.itemsPreview} numberOfLines={1}>
          {preview.map(i => i.menuItem?.name || i.name || '—').join(', ')}
          {moreCount > 0 ? ` +${moreCount} more` : ''}
        </Text>
      )}

      {/* Footer */}
      <View style={styles.cardFoot}>
        {totalRupees != null ? (
          <Text style={styles.totalTxt}>₹{totalRupees}</Text>
        ) : null}
        {isActive && (
          <View style={styles.trackRow}>
            <Text style={styles.trackTxt}>Track order</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.brand} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.bg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg, gap: 12, padding: space.xl,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  statusTxt:  { fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  retryBtn:   {
    backgroundColor: colors.brand, borderRadius: radii.md,
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 8,
  },
  retryTxt: { color: '#fff', fontWeight: '800' },
  card: {
    backgroundColor: colors.bg, borderRadius: radii.lg, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardActive: { borderColor: colors.brand },
  cardHead: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  orderNum:     { fontSize: 15, fontWeight: '800', color: colors.ink },
  dateStr:      { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  statusPill:   {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
  },
  statusDot:    { width: 7, height: 7, borderRadius: 4 },
  statusTxtBadge: { fontSize: 12, fontWeight: '700' },
  kitchenName:  { fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 6 },
  itemsPreview: { fontSize: 12, color: colors.inkSoft, marginTop: 3 },
  cardFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  totalTxt:  { fontSize: 15, fontWeight: '800', color: colors.ink },
  trackRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackTxt:  { fontSize: 13, fontWeight: '700', color: colors.brand },
});
