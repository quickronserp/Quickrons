import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';
import { useI18n } from '../i18n';
import { sendOtp, verifyOtp } from '../lib/api';
import { useAuth } from '../state/AuthContext';

const OTP_LEN = 6;
const RESEND_SECONDS = 60;

export default function OtpVerifyScreen({ route, navigation }) {
  const { t } = useI18n();
  const { login } = useAuth();
  const { phone } = route.params || {};

  const [code, setCode]       = useState('');
  const [loading, setLoad]    = useState(false);
  const [error, setError]     = useState(null);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  const hiddenRef = useRef(null);

  // Countdown.
  useEffect(() => {
    if (seconds <= 0) return;
    const tid = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(tid);
  }, [seconds]);

  // Auto-verify when 6 digits entered.
  useEffect(() => {
    if (code.length === OTP_LEN && !loading) handleVerify(code);
  }, [code]);

  const handleVerify = async value => {
    if (loading) return;
    setError(null);
    setLoad(true);
    try {
      const data = await verifyOtp(phone, value);
      await login(data);            // persists session via AuthContext
      // No navigation.navigate — RootNavigator swaps to MainTabs on isAuthenticated.
    } catch (e) {
      setError(e.message || 'Verification failed');
      setCode('');
      hiddenRef.current?.focus();
    } finally {
      setLoad(false);
    }
  };

  const handleResend = async () => {
    if (seconds > 0 || loading) return;
    setError(null);
    setLoad(true);
    try {
      await sendOtp(phone);
      setSeconds(RESEND_SECONDS);
    } catch (e) {
      setError(e.message || 'Could not resend OTP');
    } finally {
      setLoad(false);
    }
  };

  const digits = Array.from({ length: OTP_LEN }).map((_, i) => code[i] || '');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>

        {/* Back */}
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>

        <View style={styles.body}>
          <Text style={styles.title}>{t('auth.otp_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.otp_subtitle', { phone })}</Text>

          <Pressable onPress={() => navigation.goBack()} style={styles.editRow}>
            <Ionicons name="pencil" size={12} color={colors.brand} />
            <Text style={styles.editTxt}>{t('auth.edit')}</Text>
          </Pressable>

          {/* OTP boxes */}
          <Pressable onPress={() => hiddenRef.current?.focus()} style={styles.otpRow}>
            <TextInput
              ref={hiddenRef}
              value={code}
              onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, OTP_LEN))}
              keyboardType="number-pad"
              maxLength={OTP_LEN}
              autoFocus
              style={styles.hiddenInput}
            />
            {digits.map((d, i) => {
              const active = code.length === i;
              return (
                <View key={i} style={[styles.otpBox, active && styles.otpBoxActive, d && styles.otpBoxFilled]}>
                  <Text style={styles.otpDigit}>{d}</Text>
                </View>
              );
            })}
          </Pressable>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.errorTxt}>{error}</Text>
            </View>
          ) : null}

          {/* Verify button */}
          <Pressable
            onPress={() => handleVerify(code)}
            disabled={code.length !== OTP_LEN || loading}
            style={[styles.cta, (code.length !== OTP_LEN || loading) && styles.ctaDisabled]}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.ctaInner}>
                <Text style={styles.ctaTxt}>{t('auth.otp_verify')}</Text>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </View>
            )}
          </Pressable>

          {/* Resend */}
          <View style={styles.resendRow}>
            {seconds > 0 ? (
              <Text style={styles.resendMuted}>
                {t('auth.resend_in', { seconds })}
              </Text>
            ) : (
              <Pressable onPress={handleResend} disabled={loading}>
                <Text style={styles.resendLink}>{t('auth.otp_resend')}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  back: { padding: 14, alignSelf: 'flex-start' },
  body: { paddingHorizontal: space.lg, paddingTop: space.md },
  title:    { fontSize: 26, fontWeight: '800', color: colors.ink },
  subtitle: { marginTop: 6, fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
  editRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  editTxt:  { fontSize: 13, color: colors.brand, fontWeight: '700' },

  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28, gap: 8 },
  hiddenInput: {
    position: 'absolute', opacity: 0,
    // On web: cover the full OTP row so focus() keeps input in-viewport and keystrokes register.
    // On native: shrink to 1×1 invisible dot — keyboard attaches to the ref directly.
    height: Platform.OS === 'web' ? '100%' : 1,
    width:  Platform.OS === 'web' ? '100%' : 1,
    top: 0, left: 0,
    zIndex: Platform.OS === 'web' ? 1 : undefined,
  },
  otpBox: {
    flex: 1, height: 56, borderRadius: radii.md,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.bgAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  otpBoxFilled: { borderColor: colors.brand, backgroundColor: colors.bg },
  otpDigit:     { fontSize: 22, fontWeight: '800', color: colors.ink },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16,
    padding: 10, borderRadius: radii.sm, backgroundColor: '#FEE2E2',
  },
  errorTxt: { flex: 1, fontSize: 12, color: colors.danger, fontWeight: '600' },

  cta: {
    marginTop: 28, backgroundColor: colors.brand, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.brand, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ctaDisabled: { opacity: 0.45, shadowOpacity: 0 },
  ctaInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaTxt:   { color: '#fff', fontWeight: '800', fontSize: 15 },

  resendRow:   { marginTop: 18, alignItems: 'center' },
  resendMuted: { fontSize: 13, color: colors.inkMuted },
  resendLink:  { fontSize: 13, color: colors.brand, fontWeight: '700' },
});
