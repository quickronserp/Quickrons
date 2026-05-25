import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';
import { applyAsRider } from '../lib/api';

const VEHICLES = [
  { id: 'BIKE',    label: 'Bike',    icon: 'bicycle' },
  { id: 'SCOOTER', label: 'Scooter', icon: 'flash' },
  { id: 'BICYCLE', label: 'Cycle',   icon: 'walk' },
];

const INFO_CARDS = [
  {
    icon: 'cash-outline',
    title: 'Weekly earnings',
    desc: 'Per-delivery payouts + weekly NEFT settlement to your bank.',
  },
  {
    icon: 'navigate-outline',
    title: 'Local delivery only',
    desc: 'Branded fleet across Perinthalmanna · Malappuram corridor.',
  },
  {
    icon: 'wallet-outline',
    title: 'Quickrons wallet',
    desc: 'Live earnings, tips, and weekly statement in your wallet.',
  },
];

export default function RiderOnboardingScreen({ navigation }) {
  const [fullName,    setFullName]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [vehicleType, setVehicleType] = useState('BIKE');
  const [location,    setLocation]    = useState('');
  const [submitted,   setSubmitted]   = useState(false);
  const [submitting,  setBusy]        = useState(false);
  const [error,       setError]       = useState(null);

  const canSubmit =
    fullName.trim().length >= 2 &&
    /^\d{10}$/.test(phone) &&
    location.trim().length >= 2 &&
    !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await applyAsRider({
        fullName: fullName.trim(),
        phone,
        vehicleType,
        location: location.trim(),
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
          <Text style={styles.successTitle}>Rider application submitted</Text>
          <Text style={styles.successDesc}>
            Thanks, {fullName.split(' ')[0]}. Our ops team will verify your details
            and call you on +91 {phone} within 24 hours to schedule your kit handoff.
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
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Become a Quickrons Rider</Text>
            <Text style={styles.headerSub}>Perinthalmanna · Malappuram</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="bicycle" size={26} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>Join the Quickrons fleet</Text>
            <Text style={styles.heroSub}>
              Branded, KYC-verified, paid weekly. Tell us a bit about yourself and we'll get
              your kit ready.
            </Text>
          </View>

          {/* Info cards */}
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

          {/* Form */}
          <Text style={styles.sectionTitle}>YOUR DETAILS</Text>

          <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Ravi Kumar" />

          <Field
            label="Phone"
            value={phone}
            onChange={v => setPhone(v.replace(/\D/g, '').slice(0, 10))}
            placeholder="9876543210"
            keyboardType="number-pad"
            prefix="🇮🇳  +91"
          />

          <Text style={styles.fieldLabel}>VEHICLE TYPE</Text>
          <View style={styles.chipRow}>
            {VEHICLES.map(v => {
              const active = vehicleType === v.id;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setVehicleType(v.id)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Ionicons
                    name={v.icon}
                    size={16}
                    color={active ? '#fff' : colors.inkSoft}
                  />
                  <Text style={[styles.chipTxt, active && { color: '#fff' }]}>{v.label}</Text>
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

        {/* Sticky submit */}
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
    shadowColor: colors.brand, shadowOpacity: 0.30, shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 }, elevation: 5,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 12, letterSpacing: -0.3 },
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
    shadowColor: colors.brand, shadowOpacity: 0.28, shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 }, elevation: 5,
  },
  submitDisabled: { opacity: 0.45, shadowOpacity: 0 },
  submitTxt:      { color: '#fff', fontWeight: '800', fontSize: 15 },
  errorTxt:       { color: colors.danger, fontSize: 12, fontWeight: '700', marginBottom: 8, textAlign: 'center' },

  // success
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
