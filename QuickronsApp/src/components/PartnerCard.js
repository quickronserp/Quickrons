import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SegmentBadge from './SegmentBadge';
import { colors, radii, space } from '../theme';

export default function PartnerCard({ partner, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <Image source={{ uri: partner.image }} style={styles.image} />
      <View style={{ padding: space.md }}>
        <SegmentBadge segment={partner.segment} size="sm" />
        <Text style={styles.name} numberOfLines={1}>{partner.name}</Text>
        <Text style={styles.tag} numberOfLines={1}>{partner.tagline}</Text>
        <View style={styles.row}>
          <View style={styles.metaPill}>
            <Ionicons name="star" size={12} color={colors.accent} />
            <Text style={styles.metaTxt}>{partner.rating.toFixed(1)}</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="time-outline" size={12} color={colors.inkSoft} />
            <Text style={styles.metaTxt}>{partner.etaMins} min</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="location-outline" size={12} color={colors.inkSoft} />
            <Text style={styles.metaTxt} numberOfLines={1}>{partner.location.split(',')[0]}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg, borderRadius: radii.lg, marginBottom: space.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
  },
  image: { width: '100%', height: 150, backgroundColor: colors.bgAlt },
  name: { marginTop: 6, fontSize: 17, fontWeight: '700', color: colors.ink },
  tag: { marginTop: 2, fontSize: 13, color: colors.inkSoft },
  row: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.bgAlt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  metaTxt: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
});
