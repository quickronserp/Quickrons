import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SegmentBadge from './SegmentBadge';
import SmartImage from './SmartImage';
import { colors, radii, space } from '../theme';

export default function PartnerCard({ partner, onPress }) {
  const rating   = typeof partner.rating === 'number' ? partner.rating : null;
  const reviews  = partner.reviews ?? partner.reviewCount ?? 0;
  const etaMins  = partner.etaMins  || partner.avgDeliveryMinutes || null;
  const location = partner.location || partner.city || '';
  const locLabel = location ? location.split(',')[0] : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>

      {/* Hero image */}
      <SmartImage
        uri={partner.image}
        style={styles.image}
        fallback={
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="restaurant" size={32} color={colors.inkMuted} />
          </View>
        }
      />

      {/* Content */}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <SegmentBadge segment={partner.segment} size="sm" />
          {rating != null && rating > 0 && (
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={11} color={colors.accent} />
              <Text style={styles.ratingTxt}>
                {rating.toFixed(1)}
                {reviews > 0 ? ` (${reviews})` : ''}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.name} numberOfLines={1}>{partner.name}</Text>
        {partner.tagline ? (
          <Text style={styles.tag} numberOfLines={1}>{partner.tagline}</Text>
        ) : null}

        <View style={styles.metaRow}>
          {etaMins != null && (
            <MetaPill icon="time-outline" label={`${etaMins} min`} />
          )}
          {locLabel ? (
            <MetaPill icon="location-outline" label={locLabel} />
          ) : null}
        </View>
      </View>

      {/* "Order" CTA hint */}
      <View style={styles.orderHint}>
        <Text style={styles.orderHintTxt}>Order</Text>
        <Ionicons name="arrow-forward" size={12} color={colors.brand} />
      </View>
    </Pressable>
  );
}

function MetaPill({ icon, label }) {
  return (
    <View style={pillStyles.pill}>
      <Ionicons name={icon} size={11} color={colors.inkSoft} />
      <Text style={pillStyles.txt} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.bgAlt, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
  },
  txt: { fontSize: 11, color: colors.inkSoft, fontWeight: '600', maxWidth: 90 },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg, borderRadius: radii.lg, marginBottom: space.md,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },

  image: { width: '100%', height: 148, backgroundColor: colors.bgAlt },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },

  body: { padding: space.md, paddingBottom: 8 },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.accent + '18',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
  },
  ratingTxt: { fontSize: 11, fontWeight: '800', color: colors.inkSoft },

  name: { marginTop: 6, fontSize: 16, fontWeight: '800', color: colors.ink },
  tag:  { marginTop: 2, fontSize: 12, color: colors.inkSoft },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },

  orderHint: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: space.md, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  orderHintTxt: { fontSize: 12, fontWeight: '700', color: colors.brand },
});
