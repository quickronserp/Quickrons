import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';

// Mock progression: advance one stage every 5 seconds (capped at the last stage).
const STAGES = [
  { id: 'placed',    label: 'Order placed',        desc: 'Forra Foods Kitchen received your order.',     icon: 'receipt-outline' },
  { id: 'preparing', label: 'Kitchen preparing',   desc: 'Chef is cooking your dishes fresh.',            icon: 'restaurant' },
  { id: 'sealed',    label: 'Sealed & picked up',  desc: 'Order sealed with QR. Rider has it.',            icon: 'shield-checkmark' },
  { id: 'enroute',   label: 'Rider en route',      desc: 'Rajan · Quickrons rider · 🏍 KL-55-AB-2421',     icon: 'bicycle' },
  { id: 'delivered', label: 'Delivered',           desc: 'Tap the QR sticker to verify the seal.',         icon: 'home' },
];

export default function TrackingScreen({ route, navigation }) {
  const { orderId = 'QR-30421' } = route?.params || {};
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (stage >= STAGES.length - 1) return;
    const t = setTimeout(() => setStage(s => s + 1), 5000);
    return () => clearTimeout(t);
  }, [stage]);

  const etaMins = Math.max(2, 30 - stage * 6);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Tracking order</Text>
          <Text style={styles.headerSub}>{orderId}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* ETA card */}
        <View style={styles.etaCard}>
          <Text style={styles.etaLabel}>ESTIMATED ARRIVAL</Text>
          <Text style={styles.etaValue}>{etaMins} min</Text>
          <Text style={styles.etaStage}>{STAGES[stage].label}</Text>
        </View>

        {/* Timeline */}
        <Text style={styles.sectionTitle}>PROGRESS</Text>
        <View style={styles.timeline}>
          {STAGES.map((s, i) => {
            const done    = i < stage;
            const current = i === stage;
            const future  = i > stage;
            return (
              <View key={s.id} style={styles.row}>
                {/* Rail (dot + connector line) */}
                <View style={styles.rail}>
                  <View
                    style={[
                      styles.dot,
                      done    && styles.dotDone,
                      current && styles.dotCurrent,
                    ]}>
                    {done ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : current ? (
                      <View style={styles.dotPulse} />
                    ) : null}
                  </View>
                  {i < STAGES.length - 1 ? (
                    <View style={[styles.line, (done || current) && styles.lineActive]} />
                  ) : null}
                </View>

                {/* Content */}
                <View style={styles.body}>
                  <View style={styles.bodyHead}>
                    <Ionicons
                      name={s.icon}
                      size={16}
                      color={future ? colors.inkMuted : colors.ink}
                    />
                    <Text style={[styles.bodyTitle, future && { color: colors.inkMuted }]}>
                      {s.label}
                    </Text>
                  </View>
                  <Text style={[styles.bodyDesc, future && { color: colors.inkMuted }]}>
                    {s.desc}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Tamper seal panel */}
        <View style={styles.sealPanel}>
          <Ionicons name="shield-checkmark" size={20} color={colors.brand} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.sealTitle}>Tamper-seal protected</Text>
            <Text style={styles.sealDesc}>
              At delivery, scan the QR on the bag to confirm the seal is intact.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        {stage < STAGES.length - 1 ? (
          <Pressable style={[styles.cta, { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }]}>
            <Ionicons name="call-outline" size={16} color={colors.ink} />
            <Text style={[styles.ctaTxt, { color: colors.ink }]}>Contact support</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => navigation.popToTop()}
            style={styles.cta}>
            <Text style={[styles.ctaTxt, { color: '#fff' }]}>Done</Text>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgAlt },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md,
    backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  headerSub:   { fontSize: 12, color: colors.inkSoft, fontVariant: ['tabular-nums'] },

  etaCard: {
    margin: space.lg, padding: space.lg, borderRadius: radii.lg,
    backgroundColor: colors.ink,
  },
  etaLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  etaValue: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 6, fontVariant: ['tabular-nums'] },
  etaStage: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 4 },

  sectionTitle: {
    paddingHorizontal: space.lg, paddingBottom: space.sm,
    fontSize: 12, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.6,
  },

  timeline: { paddingHorizontal: space.lg },
  row: { flexDirection: 'row', minHeight: 70 },

  rail: { width: 28, alignItems: 'center' },
  dot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.bgAlt,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  dotDone:    { backgroundColor: colors.brand, borderColor: colors.brand },
  dotCurrent: { backgroundColor: '#fff',       borderColor: colors.brand },
  dotPulse:   { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: -2 },
  lineActive: { backgroundColor: colors.brand },

  body: { flex: 1, paddingLeft: 12, paddingBottom: 18 },
  bodyHead:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bodyTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  bodyDesc:  { marginTop: 4, fontSize: 12, color: colors.inkSoft, lineHeight: 17 },

  sealPanel: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginHorizontal: space.lg, marginTop: space.sm,
    padding: space.md, borderRadius: radii.md,
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: colors.brand + '55',
  },
  sealTitle: { fontSize: 13, fontWeight: '800', color: colors.ink },
  sealDesc:  { marginTop: 3, fontSize: 12, color: colors.inkSoft, lineHeight: 17 },

  footer: {
    paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 18,
    backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.brand, borderRadius: radii.lg, paddingVertical: 14,
  },
  ctaTxt: { fontWeight: '800', fontSize: 15 },
});
