import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';
import { applyAsPartner } from '../lib/api';

const CATEGORIES = [
  { id: 'HOME_COOK',         label: 'Home cook',             icon: 'home' },
  { id: 'RESTAURANT',        label: 'Restaurant',            icon: 'restaurant' },
  { id: 'CATERING',          label: 'Catering',              icon: 'people' },
  { id: 'FORRA_SUPPLIER',    label: 'Forra Foods supplier',  icon: 'leaf' },
];

const INFO_CARDS = [
  {
    icon: 'notifications-outline',
    title: 'Accept orders',
    desc: 'Live order alerts. Accept or pause anytime from the partner app.',
  },
  {
    icon: 'list-outline',
    title: 'Manage menu',
    desc: 'Add dishes, set daily quantity caps, mark items unavailable.',
  },
  {
    icon: 'wallet-outline',
    title: 'Partner wallet',
    desc: 'Order earnings, commission breakdown, weekly NEFT settlement.',
  },
];

export default function PartnerOnboardingScreen({ navigation }) {
  const [brand,    setBrand]    = useState('');
  const [owner,    setOwner]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [category, setCategory] = useState('HOME_COOK');
  const [location, setLocation] = useState('');
  const [submitted,  setSubmitted] = useState(false);
  const [submitting, setBusy]      = useState(false);
  const [error,      setError]     = useState(null);

  const canSubmit =
    brand.trim().length    >= 2 &&
    owner.trim().length    >= 2 &&
    /^\d{10}$/.test(phone)       &&
    location.trim().length >= 2  &&
    !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await applyAsPartner({
        brand:     brand.trim(),
        ownerName: owner.trim(),
        phone,
        category,
        location:  location.trim(),
      });
      setSubmitted(true);
    } catch (e) {
      setError(e.message || 'Could not submit application');
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Partner application submitted</Text>
          <Text style={styles.successDesc}>
            Thanks, {owner.split(' ')[0]}. Our onboarding team will visit "{brand}"
            for the kitchen audit and call you on +91 {phone} within 48 hours.
          </Text>
          <Pressable onPress={() => navigation.popToTop()} style={styles.successCta}>
            <Text style={styles.successCtaTxt}>Back to home</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Sell on Quickrons</Text>
            <Text style={styles.headerSub}>Home cooks · Restaurants · Caterers</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="storefront" size={26} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>List your kitchen on Quickrons</Text>
            <Text style={styles.heroSub}>
              Reach Perinthalmanna & Malappuram customers. Home-cook commission capped at 10%
              — restaurants 15%, catering 12%.
            </Text>
          </View>

          <View style={styles.infoCol}>
            {INFO_CARDS.map(c => (
              <View key={c.title} style={styles.infoCard}>
                <View style={styles.infoIcon}>
                  <Ionicons name={c.icon} size={18} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle}>{c.title}</Text>
                  <Text style={styles.infoDesc}>{c.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>YOUR DETAILS</Text>

          <Field label="Kitchen / brand name" value={brand} onChange={setBrand} placeholder="Fathima's Kitchen" />
          <Field label="Owner name"           value={owner} onChange={setOwner} placeholder="Fathima Abdul Razzaq" />
          <Field
            label="Phone"
            value={phone}
            onChange={v => setPhone(v.replace(/\D/g, '').slice(0, 10))}
            placeholder="9876543211"
            keyboardType="number-pad"
            prefix="🇮🇳  +91"
          />

          <Text style={styles.fieldLabel}>CATEGORY</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map(c => {
              const active = category === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Ionicons
                    name={c.icon}
                    size={16}
                    color={active ? '#fff' : colors.inkSoft}
                  />
                  <Text style={[styles.chipTxt, active && { color: '#fff' }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Field
            label="Location (city / area)"
            value={location}
            onChange={setLocation}
            placeholder="Perinthalmanna"
          />
        </ScrollView>

        <View style={styles.footer}>
          {error ? <Text style={styles.errorTxt}>{error}</Text> : null}
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={[styles.submit, !canSubmit && styles.submitDisabled]}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.submitTxt}>Submit application</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, prefix }) {
  return (
    <View style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <View style={styles.inputRow}>
        {prefix ? (
          <View style={styles.prefix}>
            <Text style={styles.prefixTxt}>{prefix}</Text>
          </View>
        ) : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.inkMuted}
          keyboardType={keyboardType}
        />
      </View>
    </View>
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
  headerSub:   { fontSize: 12, color: colors.inkSoft },

  hero: { alignItems: 'flex-start', paddingHorizontal: space.lg, paddingTop: 20, paddingBottom: 12 },
  heroIcon: {
    width: 52, height: 52, borderRadius: 18, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 12 },
  heroSub:   { fontSize: 13, color: colors.inkSoft, marginTop: 4, lineHeight: 19 },

  infoCol: { paddingHorizontal: space.lg, gap: 8, marginTop: 12 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: space.md, borderRadius: radii.md,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  infoIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  infoTitle: { fontSize: 13, fontWeight: '800', color: colors.ink },
  infoDesc:  { marginTop: 2, fontSize: 12, color: colors.inkSoft, lineHeight: 17 },

  sectionTitle: {
    paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm,
    fontSize: 12, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.6,
  },

  fieldLabel: {
    fontSize: 11, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.5,
    paddingHorizontal: space.lg, marginBottom: 6,
  },
  inputRow: {
    marginHorizontal: space.lg,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md,
    overflow: 'hidden', backgroundColor: colors.bg,
  },
  prefix: {
    paddingHorizontal: 12, paddingVertical: 12,
    borderRightWidth: 1, borderRightColor: colors.border,
    backgroundColor: colors.bgAlt,
  },
  prefixTxt: { fontSize: 14, fontWeight: '700', color: colors.ink },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink },

  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: space.lg, marginBottom: space.md, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt:    { fontSize: 13, fontWeight: '700', color: colors.inkSoft },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 18,
    backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  submit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.brand, borderRadius: radii.lg, paddingVertical: 14,
  },
  submitDisabled: { opacity: 0.45 },
  submitTxt:      { color: '#fff', fontWeight: '800', fontSize: 15 },
  errorTxt:       { color: colors.danger, fontSize: 12, fontWeight: '700', marginBottom: 8, textAlign: 'center' },

  successWrap: { flex: 1, padding: space.xl, alignItems: 'center', justifyContent: 'center' },
  successCircle: {
    width: 86, height: 86, borderRadius: 43, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.brand, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  successTitle: { marginTop: 18, fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  successDesc:  { marginTop: 8,  fontSize: 13, color: colors.inkSoft, textAlign: 'center', lineHeight: 19 },
  successCta: {
    marginTop: 28, backgroundColor: colors.brand, borderRadius: radii.lg,
    paddingHorizontal: 22, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  successCtaTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
