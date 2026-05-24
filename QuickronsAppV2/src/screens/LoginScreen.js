import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';
import { sendOtp } from '../lib/api';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoad] = useState(false);
  const [error, setError] = useState(null);
  const isValid = /^\d{10}$/.test(phone);

  const onContinue = async () => {
    if (!isValid || loading) return;
    setError(null); setLoad(true);
    try {
      await sendOtp(phone);
      navigation.navigate('Otp', { phone });
    } catch (e) {
      setError(e.message || 'Could not send OTP');
    } finally { setLoad(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.hero}>
          <View style={styles.logo}><Text style={styles.logoLetter}>Q</Text></View>
          <Text style={styles.brandName}>Quickrons</Text>
          <Text style={styles.tagline}>Authentic Malabar food, fast</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome to Quickrons</Text>
          <Text style={styles.subtitle}>Enter your phone number to continue</Text>

          <Text style={styles.label}>PHONE NUMBER</Text>
          <View style={[styles.inputRow, isValid && styles.inputRowActive]}>
            <View style={styles.prefix}><Text style={styles.prefixTxt}>🇮🇳  +91</Text></View>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={v => setPhone(v.replace(/\D/g, '').slice(0, 10))}
              placeholder="98765 43210"
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
              maxLength={10}
              autoFocus
              onSubmitEditing={onContinue}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.errorTxt}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={onContinue}
            disabled={!isValid || loading}
            style={[styles.cta, (!isValid || loading) && styles.ctaDisabled]}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={styles.ctaInner}>
                  <Text style={styles.ctaTxt}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </View>
              )}
          </Pressable>

          <Text style={styles.terms}>By continuing you agree to our Terms & Privacy Policy</Text>
        </View>

        <Text style={styles.hint}>
          Dev: phone <Text style={styles.hintMono}>9876543210</Text>  ·  OTP <Text style={styles.hintMono}>123456</Text>
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: { alignItems: 'center', paddingTop: 60, paddingBottom: 32 },
  logo: {
    width: 72, height: 72, borderRadius: 22, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  logoLetter: { color: '#fff', fontSize: 36, fontWeight: '800' },
  brandName: { marginTop: 14, fontSize: 28, fontWeight: '800', color: colors.ink },
  tagline:   { marginTop: 4, fontSize: 14, color: colors.inkSoft },

  card: {
    marginHorizontal: space.lg, padding: space.lg,
    backgroundColor: colors.bg, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  title:    { fontSize: 22, fontWeight: '800', color: colors.ink },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.inkSoft },
  label:    { marginTop: 22, fontSize: 12, fontWeight: '700', color: colors.inkSoft, letterSpacing: 0.6 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 8,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md,
    overflow: 'hidden', backgroundColor: colors.bgAlt,
  },
  inputRowActive: { borderColor: colors.brand, backgroundColor: '#F0FDF4' },
  prefix: {
    paddingHorizontal: 14, paddingVertical: 14,
    borderRightWidth: 1, borderRightColor: colors.border,
    backgroundColor: colors.bg,
  },
  prefixTxt: { fontSize: 15, fontWeight: '700', color: colors.ink },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 17, color: colors.ink, letterSpacing: 1 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    padding: 10, borderRadius: radii.sm, backgroundColor: '#FEE2E2',
  },
  errorTxt: { flex: 1, fontSize: 12, color: colors.danger, fontWeight: '600' },

  cta: {
    marginTop: 20, backgroundColor: colors.brand, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.45 },
  ctaInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaTxt:   { color: '#fff', fontWeight: '800', fontSize: 15 },
  terms:    { marginTop: 16, fontSize: 11, color: colors.inkMuted, textAlign: 'center', lineHeight: 16 },
  hint:     { marginTop: 24, textAlign: 'center', fontSize: 11, color: colors.inkMuted },
  hintMono: { fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }), color: colors.ink, fontWeight: '700' },
});
