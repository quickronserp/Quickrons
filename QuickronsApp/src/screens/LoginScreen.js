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

// ─── Quickrons wordmark component ─────────────────────────────────────────────
// Renders the "≡quickrons" logotype in the brand orange.
function QuickronsWordmark({ size = 'lg' }) {
  const isLg   = size === 'lg';
  const prefix = isLg ? 38 : 22;
  const word   = isLg ? 36 : 20;
  return (
    <View style={wmStyles.row}>
      {/* Three-bar prefix that matches the logo mark */}
      <View style={[wmStyles.barGroup, { marginRight: isLg ? 3 : 2 }]}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={[
              wmStyles.bar,
              {
                width:  isLg ? 9 : 5,
                height: isLg ? 5 : 3,
                marginBottom: i < 2 ? (isLg ? 3 : 2) : 0,
                borderRadius: isLg ? 3 : 2,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[wmStyles.word, { fontSize: word }]}>quickrons</Text>
    </View>
  );
}

const wmStyles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center' },
  barGroup: { justifyContent: 'center' },
  bar:      { backgroundColor: colors.brand },
  word:     { fontWeight: '800', color: colors.brand, letterSpacing: -0.5 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LoginScreen({ navigation }) {
  const { t, lang, setLang } = useI18n();
  const [phone, setPhone]    = useState('');
  const [loading, setLoad]   = useState(false);
  const [error, setError]    = useState(null);

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

        {/* Language toggle — top right */}
        <Pressable
          onPress={() => setLang(lang === 'ml' ? 'en' : 'ml')}
          style={styles.langPill}>
          <Ionicons name="language" size={13} color={colors.inkSoft} />
          <Text style={styles.langTxt}>{lang === 'ml' ? 'മലയാളം' : 'English'}</Text>
        </Pressable>

        {/* Hero — wordmark + tagline */}
        <View style={styles.hero}>
          <QuickronsWordmark size="lg" />
          <Text style={styles.tagline}>{t('app.tagline')}</Text>

          {/* Kerala identity strip */}
          <View style={styles.keralaBadge}>
            <Text style={styles.keralaTxt}>🌴 Kerala's own food delivery</Text>
          </View>
        </View>

        {/* Login card */}
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
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
            {isValid && (
              <View style={styles.validMark}>
                <Ionicons name="checkmark-circle" size={20} color={colors.brand} />
              </View>
            )}
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

        {/* Bottom trust signals */}
        <View style={styles.trust}>
          {['Tamper-sealed orders', 'Live tracking', 'Kerala kitchens only'].map(item => (
            <View key={item} style={styles.trustItem}>
              <Ionicons name="shield-checkmark" size={12} color={colors.brand} />
              <Text style={styles.trustTxt}>{item}</Text>
            </View>
          ))}
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  langPill: {
    position: 'absolute', top: 12, right: 16, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border,
  },
  langTxt: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center', paddingTop: 56, paddingBottom: 28,
  },
  tagline: { marginTop: 10, fontSize: 14, color: colors.inkSoft, fontWeight: '500' },
  keralaBadge: {
    marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: colors.brandTint,
    borderRadius: 999, borderWidth: 1, borderColor: colors.brand + '30',
  },
  keralaTxt: { fontSize: 12, fontWeight: '700', color: colors.brand },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    marginHorizontal: space.lg,
    padding: space.xl,
    backgroundColor: colors.bg,
    borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  title:    { fontSize: 22, fontWeight: '800', color: colors.ink },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
  label: {
    marginTop: 22, fontSize: 11, fontWeight: '700',
    color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.8,
  },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 8,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md,
    overflow: 'hidden', backgroundColor: colors.bgAlt,
  },
  inputRowActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  prefix: {
    paddingHorizontal: 14, paddingVertical: 14,
    borderRightWidth: 1, borderRightColor: colors.border,
    backgroundColor: colors.bg,
  },
  prefixTxt: { fontSize: 15, fontWeight: '700', color: colors.ink },
  input: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 17, color: colors.ink, letterSpacing: 1.5,
  },
  validMark: { paddingRight: 12 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    padding: 10, borderRadius: radii.sm, backgroundColor: '#FEE2E2',
  },
  errorTxt: { flex: 1, fontSize: 12, color: colors.danger, fontWeight: '600' },

  cta: {
    marginTop: 20, backgroundColor: colors.brand, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.brand, shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  ctaDisabled: { opacity: 0.45, shadowOpacity: 0 },
  ctaInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaTxt:   { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
  terms:    { marginTop: 16, fontSize: 11, color: colors.inkMuted, textAlign: 'center', lineHeight: 16 },

  // ── Trust strip ───────────────────────────────────────────────────────────
  trust: {
    flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap',
    gap: 16, paddingVertical: 20, paddingHorizontal: space.lg,
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustTxt:  { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
});
