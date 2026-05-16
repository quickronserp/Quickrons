import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';

export default function DishCard({ dish, onAdd }) {
  return (
    <View style={styles.card}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <View style={styles.headerRow}>
          <View style={[styles.vegDot, { borderColor: dish.veg ? colors.success : colors.danger }]}>
            <View style={[styles.vegInner, { backgroundColor: dish.veg ? colors.success : colors.danger }]} />
          </View>
          {dish.signature && (
            <View style={styles.signature}>
              <Ionicons name="ribbon" size={11} color={colors.accent} />
              <Text style={styles.sigTxt}>Signature</Text>
            </View>
          )}
        </View>
        <Text style={styles.name}>{dish.name}</Text>
        <Text style={styles.price}>₹{dish.price}</Text>
        <Text style={styles.desc} numberOfLines={2}>{dish.desc}</Text>
      </View>
      <Pressable onPress={onAdd} style={({ pressed }) => [styles.addBtn, pressed && { transform: [{ scale: 0.96 }] }]}>
        <Text style={styles.addTxt}>ADD</Text>
        <Ionicons name="add" size={14} color={colors.brand} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', backgroundColor: colors.bg, padding: space.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'flex-start',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vegDot: {
    width: 14, height: 14, borderWidth: 1.5, borderRadius: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  vegInner: { width: 6, height: 6, borderRadius: 3 },
  signature: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.accent + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  sigTxt: { fontSize: 10, fontWeight: '700', color: colors.accent },
  name: { marginTop: 6, fontSize: 16, fontWeight: '700', color: colors.ink },
  price: { marginTop: 2, fontSize: 15, fontWeight: '700', color: colors.ink },
  desc: { marginTop: 4, fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.brand, borderRadius: radii.md,
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FEF1F4',
  },
  addTxt: { color: colors.brand, fontSize: 13, fontWeight: '800' },
});
