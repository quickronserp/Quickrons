import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { segmentMeta } from '../theme';

export default function SegmentBadge({ segment, size = 'md' }) {
  const meta = segmentMeta[segment];
  if (!meta) return null;
  const small = size === 'sm';
  return (
    <View style={[styles.row, { backgroundColor: meta.color + '15', borderColor: meta.color + '55' }]}>
      <Ionicons name={meta.icon} size={small ? 11 : 13} color={meta.color} />
      <Text style={[styles.label, { color: meta.color, fontSize: small ? 10 : 12 }]}>
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    borderWidth: 1, alignSelf: 'flex-start',
  },
  label: { fontWeight: '700' },
});
