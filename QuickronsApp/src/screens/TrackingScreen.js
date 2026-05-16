import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';

const STAGES = [
  { id: 'placed', label: 'Order placed', icon: 'checkmark-circle' },
  { id: 'cooking', label: 'Kitchen is cooking', icon: 'restaurant' },
  { id: 'sealed', label: 'Sealed & picked up', icon: 'lock-closed' },
  { id: 'enroute', label: 'Rider en route', icon: 'bicycle' },
  { id: 'delivered', label: 'Delivered', icon: 'home' },
];

export default function TrackingScreen({ navigation }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (stage >= STAGES.length - 1) return;
    const t = setTimeout(() => setStage(s => s + 1), 2400);
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Order #QR-30421</Text>
        <Pressable onPress={() => navigation.navigate('HomeTab')}>
          <Ionicons name="close" size={24} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <View style={styles.etaCard}>
          <Text style={styles.etaLabel}>Estimated arrival</Text>
          <Text style={styles.etaTime}>{Math.max(2, 30 - stage * 6)}–{Math.max(5, 35 - stage * 6)} min</Text>
          <Text style={styles.etaDesc}>{STAGES[stage].label}</Text>
        </View>

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

        <View style={styles.riderCard}>
          <View style={styles.riderAvatar}>
            <Ionicons name="person" size={22} color={colors.bg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>Ravi Kumar</Text>
            <Text style={styles.riderMeta}>Quickrons rider · ⭐ 4.9 · KA-03-AB-2421</Text>
          </View>
          <Pressable style={styles.callBtn}>
            <Ionicons name="call" size={18} color={colors.brand} />
          </Pressable>
        </View>

        <View style={styles.trustCard}>
          <Ionicons name="shield-checkmark" size={20} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.trustTitle}>Tamper-evident sealed</Text>
            <Text style={styles.trustDesc}>
              Your order is sealed at the kitchen. Scan the QR on the bag at delivery to verify.
            </Text>
          </View>
        </View>

        {stage === STAGES.length - 1 && (
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
    paddingHorizontal: space.lg, paddingVertical: space.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink },
  etaCard: {
    backgroundColor: colors.ink, padding: space.lg, borderRadius: radii.lg,
  },
  etaLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  etaTime: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4 },
  etaDesc: { color: colors.accent, fontSize: 14, fontWeight: '700', marginTop: 4 },
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
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.rider,
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
  trustDesc: { fontSize: 12, color: colors.success, marginTop: 2, lineHeight: 18 },
  doneBtn: {
    backgroundColor: colors.brand, borderRadius: radii.md, padding: 14,
    alignItems: 'center', marginTop: space.xl,
  },
  doneTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
