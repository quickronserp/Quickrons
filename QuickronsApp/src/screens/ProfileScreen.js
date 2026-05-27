import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../state/CartContext';
import { useAuth } from '../state/AuthContext';
import { useI18n } from '../i18n';
import { colors, radii, space, segmentMeta } from '../theme';

export default function ProfileScreen({ navigation }) {
  const { isPlus } = useCart();
  const { user, signOut } = useAuth();
  const { lang, setLang } = useI18n();

  const displayName = user?.name  || user?.fullName || '';
  const phone       = user?.phone || '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgAlt }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        {/* Profile header */}
        <View style={styles.head}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={30} color="#fff" />
            </View>
            {/* Brand ring */}
            <View style={styles.avatarRing} />
          </View>
          {displayName ? <Text style={styles.name}>{displayName}</Text> : null}
          {phone ? <Text style={styles.phone}>{phone}</Text> : null}
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
        <Action
          icon="language"
          color={colors.caterer}
          title={lang === 'en' ? 'Switch to Malayalam' : 'Switch to English'}
          desc={lang === 'en' ? 'ഭാഷ മാറ്റാം' : 'Change app language'}
          onPress={() => setLang(lang === 'en' ? 'ml' : 'en')}
        />

        {/* ── Operations Console — internal MVP testing ────────────── */}
        <Text style={styles.section}>Operations Console</Text>
        <Action
          icon="storefront-outline"
          color="#7C3AED"
          title="Partner Kitchen"
          desc="Accept orders · Prepare · Seal"
          onPress={() => navigation.navigate('PartnerOps')}
        />
        <Action
          icon="bicycle-outline"
          color={colors.rider}
          title="Rider Dispatch"
          desc="Go online · Accept · Deliver"
          onPress={() => navigation.navigate('RiderOps')}
        />
        <Action
          icon="shield-checkmark-outline"
          color={colors.ink}
          title="Admin Console"
          desc="Live orders · Analytics · Ops"
          onPress={() => navigation.navigate('AdminOps')}
        />

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
    backgroundColor: colors.bg, borderRadius: radii.lg, padding: space.xl,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.brand, shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatarRing: {
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: 44, borderWidth: 2, borderColor: colors.brand + '40',
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  name:  { fontSize: 19, fontWeight: '800', color: colors.ink },
  phone: { fontSize: 13, color: colors.inkSoft, marginTop: 3 },
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
