import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';
import { useI18n } from '../i18n';
import { sendOtp } from '../lib/api';

export default function LoginScreen({ navigation }) {
  const { t, lang, setLang } = useI18n();
  const [phone, setPhone]   = useState('');
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState(null);

  const isValid = /^\d{10}$/.test(phone);

  const handleContinue = async () => {
    if (!isValid || loading) return;
    setError(null);
    setLoad(true);
    try {
      await sendOtp(phone);
      navigation.navigate('OtpVerify', { phone });
    } catch (e) {
      setError(e.message || 'Could not send OTP');
    } finally {
      setLoad(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>

        {/* Language toggle */}
        <Pressable
          onPress={() => setLang(lang === 'ml' ? 'en' : 'ml')}
          style={styles.langPill}>
          <Ionicons name="language" size={14} color={colors.ink} />
          <Text style={styles.langTxt}>{lang === 'ml' ? 'മലയാളം' : 'English'}</Text>
        </Pressable>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Text style={styles.logoLetter}>Q</Text>
          </View>
          <Text style={styles.brandName}>Quickrons</Text>
          <Text style={styles.tagline}>{t('app.tagline')}</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>{t('auth.login_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.login_subtitle')}</Text>

          <Text style={styles.label}>{t('auth.phone_label')}</Text>
          <View style={[styles.inputRow, isValid && styles.inputRowActive]}>
            <View style={styles.prefix}>
              <Text style={styles.prefixTxt}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={v => setPhone(v.replace(/\D/g, '').slice(0, 10))}
              placeholder="98765 43210"
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
              maxLength={10}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={handleContinue}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.errorTxt}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleContinue}
            disabled={!isValid || loading}
            style={[styles.cta, (!isValid || loading) && styles.ctaDisabled]}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.ctaInner}>
                <Text style={styles.ctaTxt}>{t('auth.continue')}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </View>
            )}
          </Pressable>

          <Text style={styles.terms}>{t('auth.terms')}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  langPill: {
    position: 'absolute', top: 16, right: 16, zIndex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border,
  },
  langTxt: { fontSize: 12, fontWeight: '700', color: colors.ink },

  hero: { alignItems: 'center', paddingTop: 60, paddingBottom: 32 },
  logo: {
    width: 72, height: 72, borderRadius: 22, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.brand, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  logoLetter: { color: '#fff', fontSize: 36, fontWeight: '800' },
  brandName: { marginTop: 14, fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: 0.3 },
  tagline:   { marginTop: 4, fontSize: 14, color: colors.inkSoft },

  card: {
    marginHorizontal: space.lg,
    padding: space.lg,
    backgroundColor: colors.bg,
    borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  title:    { fontSize: 22, fontWeight: '800', color: colors.ink },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.inkSoft },
  label:    { marginTop: 22, fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 },

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
    shadowColor: colors.brand, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ctaDisabled: { opacity: 0.45, shadowOpacity: 0 },
  ctaInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaTxt:   { color: '#fff', fontWeight: '800', fontSize: 15 },
  terms:    { marginTop: 16, fontSize: 11, color: colors.inkMuted, textAlign: 'center', lineHeight: 16 },
});
