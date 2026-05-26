import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../state/CartContext';
import { useAuth } from '../state/AuthContext';
import { colors, radii, space } from '../theme';

export default function ProfileScreen({ navigation }) {
  const { isPlus } = useCart();
  const { user, signOut } = useAuth();

  const displayName = user?.name  || user?.fullName || '';
  const phone       = user?.phone || '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgAlt }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#fff" />
          </View>
          {displayName ? <Text style={styles.name}>{displayName}</Text> : null}
          <Text style={styles.email}>{phone}</Text>
          {isPlus && (
            <View style={styles.plusPill}>
              <Ionicons name="diamond" size={12} color={colors.accent} />
              <Text style={styles.plusTxt}>Quickrons Plus</Text>
            </View>
          )}
        </View>

        <Text style={styles.section}>Quick actions</Text>
        <Action
          icon="receipt"
          color={colors.inkSoft}
          title="My orders"
          onPress={() => navigation.navigate('MyOrders')}
        />
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
        <Action icon="heart" color={colors.brand} title="Saved kitchens" />
        <Action icon="help-circle" color={colors.inkSoft} title="Help & support" />
        <Action icon="log-out" color={colors.danger} title="Sign out" onPress={signOut} />
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
