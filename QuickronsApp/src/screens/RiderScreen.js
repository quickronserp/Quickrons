import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RIDER_PROFILE, ACTIVE_DELIVERIES } from '../data/mockData';
import { colors, radii, space } from '../theme';

export default function RiderScreen() {
  const [online, setOnline] = useState(true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgAlt }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greet}>Hi, {RIDER_PROFILE.name.split(' ')[0]}</Text>
            <Text style={styles.zone}>{RIDER_PROFILE.zone}</Text>
            <Text style={styles.vehicle}>🛺 {RIDER_PROFILE.vehicle}</Text>
          </View>
          <Pressable onPress={() => setOnline(!online)} style={[styles.statusBtn, online && styles.online]}>
            <View style={[styles.dot, online && { backgroundColor: '#fff' }]} />
            <Text style={[styles.statusTxt, online && { color: '#fff' }]}>
              {online ? 'Online' : 'Offline'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Today" value={`₹${RIDER_PROFILE.todayEarnings}`} />
          <Stat label="Deliveries" value={RIDER_PROFILE.todayDeliveries} />
          <Stat label="Rating" value={`★ ${RIDER_PROFILE.rating}`} />
        </View>

        <View style={styles.weeklyCard}>
          <Text style={styles.weeklyLabel}>This week</Text>
          <Text style={styles.weeklyValue}>₹{RIDER_PROFILE.weeklyEarnings}</Text>
          <View style={styles.weeklyRow}>
            <View style={[styles.bar, { height: 16 }]} />
            <View style={[styles.bar, { height: 32 }]} />
            <View style={[styles.bar, { height: 28 }]} />
            <View style={[styles.bar, { height: 38 }]} />
            <View style={[styles.bar, { height: 22 }]} />
            <View style={[styles.bar, { height: 44 }]} />
            <View style={[styles.bar, { height: 36 }]} />
          </View>
          <View style={styles.daysRow}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <Text key={i} style={styles.day}>{d}</Text>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Active deliveries</Text>
        {ACTIVE_DELIVERIES.map(d => (
          <View key={d.id} style={styles.deliveryCard}>
            <View style={styles.deliveryHead}>
              <Text style={styles.deliveryNo}>{d.orderNo}</Text>
              <View style={[styles.statusPill, d.status === 'pickup' && styles.pickupPill]}>
                <Text style={[styles.statusPillTxt, d.status === 'pickup' && { color: '#fff' }]}>
                  {d.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.legRow}>
              <View style={styles.legDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.legLabel}>PICKUP</Text>
                <Text style={styles.legValue}>{d.from}</Text>
              </View>
            </View>
            <View style={styles.connector} />
            <View style={styles.legRow}>
              <View style={[styles.legDot, { backgroundColor: colors.brand }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.legLabel}>DROP</Text>
                <Text style={styles.legValue}>{d.to}</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Meta icon="navigate" value={d.distance} />
              <Meta icon="time-outline" value={`${d.etaMins} min`} />
              <Meta icon="cash-outline" value={`₹${d.payout}`} highlight />
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.secondary}>
                <Ionicons name="call" size={16} color={colors.ink} />
                <Text style={styles.secondaryTxt}>Customer</Text>
              </Pressable>
              <Pressable style={styles.primary}>
                <Text style={styles.primaryTxt}>
                  {d.status === 'pickup' ? 'Picked up' : 'Start delivery'}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Meta({ icon, value, highlight }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={highlight ? colors.success : colors.inkSoft} />
      <Text style={[styles.metaTxt, highlight && { color: colors.success, fontWeight: '800' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greet: { fontSize: 22, fontWeight: '800', color: colors.ink },
  zone: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  vehicle: { fontSize: 12, color: colors.inkMuted, marginTop: 2, fontWeight: '600' },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.bg, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: colors.border,
  },
  online: { backgroundColor: colors.success, borderColor: colors.success },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.inkMuted },
  statusTxt: { fontSize: 12, fontWeight: '800', color: colors.inkSoft },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: space.lg },
  statBox: {
    flex: 1, backgroundColor: colors.bg, padding: space.md, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: 19, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.inkMuted, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  weeklyCard: {
    backgroundColor: colors.ink, padding: space.lg, borderRadius: radii.lg, marginTop: space.lg,
  },
  weeklyLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  weeklyValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
  weeklyRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    height: 50, marginTop: 14,
  },
  bar: { width: 16, borderRadius: 4, backgroundColor: colors.accent },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  day: { color: '#94A3B8', fontSize: 11, width: 16, textAlign: 'center', fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.inkSoft, marginTop: space.lg, marginBottom: 10, textTransform: 'uppercase' },
  deliveryCard: {
    backgroundColor: colors.bg, padding: space.md, borderRadius: radii.md, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  deliveryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  deliveryNo: { fontSize: 15, fontWeight: '800', color: colors.ink },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: colors.bgAlt,
  },
  pickupPill: { backgroundColor: colors.brand },
  statusPillTxt: { fontSize: 10, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.5 },
  legRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  legDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success, marginTop: 4 },
  legLabel: { fontSize: 10, color: colors.inkMuted, fontWeight: '800' },
  legValue: { fontSize: 14, color: colors.ink, fontWeight: '600', marginTop: 1 },
  connector: { width: 2, height: 14, backgroundColor: colors.border, marginLeft: 4, marginVertical: 2 },
  metaRow: { flexDirection: 'row', gap: 14, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  secondary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  secondaryTxt: { fontSize: 13, fontWeight: '700', color: colors.ink },
  primary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.brand, paddingVertical: 10, borderRadius: radii.sm,
  },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
