import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../state/CartContext';
import { colors, radii, space } from '../theme';

export default function ProfileScreen({ navigation }) {
  const { role, setRole, isPlus } = useCart();

  const ROLES = [
    { id: 'customer', label: 'Customer', icon: 'restaurant', desc: 'Order food' },
    { id: 'rider', label: 'Rider', icon: 'bicycle', desc: 'Earn deliveries' },
    { id: 'partner', label: 'Partner', icon: 'storefront', desc: 'Sell on Quickrons' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgAlt }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#fff" />
          </View>
          <Text style={styles.name}>Shakeeb Ali</Text>
          <Text style={styles.email}>shakeeb.ap@gmail.com</Text>
          {isPlus && (
            <View style={styles.plusPill}>
              <Ionicons name="diamond" size={12} color={colors.accent} />
              <Text style={styles.plusTxt}>Quickrons Plus</Text>
            </View>
          )}
        </View>

        <Text style={styles.section}>Switch role</Text>
        <View style={styles.roleGrid}>
          {ROLES.map(r => (
            <Pressable
              key={r.id}
              onPress={() => setRole(r.id)}
              style={[styles.roleCard, role === r.id && styles.roleCardActive]}>
              <Ionicons
                name={r.icon}
                size={24}
                color={role === r.id ? '#fff' : colors.brand}
              />
              <Text style={[styles.roleLabel, role === r.id && { color: '#fff' }]}>{r.label}</Text>
              <Text style={[styles.roleDesc, role === r.id && { color: '#FECDD3' }]}>{r.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Quick actions</Text>
        <Action
          icon="diamond"
          color={colors.accent}
          title={isPlus ? 'Manage Plus membership' : 'Try Quickrons Plus'}
          onPress={() => navigation.navigate('Premium')}
        />
        <Action
          icon="storefront"
          color={colors.premium}
          title="Become a partner"
          desc="Home maker, hotel, or caterer"
          onPress={() => navigation.navigate('PartnerOnboarding')}
        />
        <Action icon="receipt" color={colors.inkSoft} title="Past orders" />
        <Action icon="heart" color={colors.brand} title="Saved kitchens" />
        <Action icon="help-circle" color={colors.inkSoft} title="Help & support" />
        <Action icon="log-out" color={colors.danger} title="Sign out" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ icon, color, title, desc, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.actionRow}>
      <View style={[styles.actionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        {desc && <Text style={styles.actionDesc}>{desc}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    backgroundColor: colors.bg, borderRadius: radii.lg, padding: space.lg,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  name: { fontSize: 19, fontWeight: '800', color: colors.ink },
  email: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  plusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.ink, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, marginTop: 10,
  },
  plusTxt: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  section: { fontSize: 13, fontWeight: '800', color: colors.inkSoft, marginTop: space.lg, marginBottom: 8, textTransform: 'uppercase' },
  roleGrid: { flexDirection: 'row', gap: 8 },
  roleCard: {
    flex: 1, backgroundColor: colors.bg, borderRadius: radii.md, padding: space.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'flex-start',
  },
  roleCardActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  roleLabel: { fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 8 },
  roleDesc: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bg, padding: space.md, borderRadius: radii.md, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  actionDesc: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
});
