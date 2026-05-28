import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';
import { useI18n, SUPPORTED_LANGS } from '../i18n';

// Re-use the wordmark styling from LoginScreen so onboarding feels cohesive.
function QuickronsWordmark() {
  return (
    <View style={wmStyles.row}>
      <View style={wmStyles.barGroup}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={[wmStyles.bar, { marginBottom: i < 2 ? 3 : 0 }]}
          />
        ))}
      </View>
      <Text style={wmStyles.word}>quickrons</Text>
    </View>
  );
}

const wmStyles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center' },
  barGroup: { justifyContent: 'center', marginRight: 3 },
  bar:      { width: 9, height: 5, borderRadius: 3, backgroundColor: colors.brand },
  word:     { fontSize: 36, fontWeight: '800', color: colors.brand, letterSpacing: -0.5 },
});

export default function LanguageSelectScreen() {
  const { t, lang, setLang } = useI18n();
  const [selected, setSelected] = useState(lang || 'en');

  const handleContinue = () => {
    // setLang persists to storage and flips `hasChosen` in the I18n provider,
    // which causes App.js to drop this screen and render AuthStack instead.
    setLang(selected);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <QuickronsWordmark />
          <View style={styles.keralaBadge}>
            <Text style={styles.keralaTxt}>🌴 Kerala's own food delivery</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{t('language.title')}</Text>
          <Text style={styles.subtitle}>{t('language.subtitle')}</Text>

          <View style={styles.options}>
            {SUPPORTED_LANGS.map(opt => {
              const isActive = selected === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => setSelected(opt.code)}
                  style={[styles.option, isActive && styles.optionActive]}>
                  <View style={styles.optionLeft}>
                    <Text style={[styles.optionNative, isActive && styles.optionTextActive]}>
                      {opt.native}
                    </Text>
                    {opt.label !== opt.native && (
                      <Text style={styles.optionLabel}>{opt.label}</Text>
                    )}
                  </View>
                  <View style={[styles.radio, isActive && styles.radioActive]}>
                    {isActive && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={handleContinue} style={styles.cta}>
            <Text style={styles.ctaTxt}>{t('language.continue')}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll:    { flexGrow: 1, paddingBottom: space.xl },

  hero: { alignItems: 'center', paddingTop: 64, paddingBottom: 28 },
  keralaBadge: {
    marginTop: 14, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: colors.brandTint, borderRadius: 999,
    borderWidth: 1, borderColor: colors.brand + '30',
  },
  keralaTxt: { fontSize: 12, fontWeight: '700', color: colors.brand },

  card: {
    marginHorizontal: space.lg, padding: space.xl,
    backgroundColor: colors.bg, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  title:    { fontSize: 22, fontWeight: '800', color: colors.ink },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.inkSoft, lineHeight: 20 },

  options: { marginTop: 22, gap: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.bgAlt,
  },
  optionActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  optionLeft:   { flex: 1 },
  optionNative: { fontSize: 17, fontWeight: '700', color: colors.ink },
  optionTextActive: { color: colors.brand },
  optionLabel:  { marginTop: 2, fontSize: 12, color: colors.inkMuted, fontWeight: '600' },

  radio: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  radioActive: { backgroundColor: colors.brand, borderColor: colors.brand },

  cta: {
    marginTop: 22, backgroundColor: colors.brand, borderRadius: radii.lg,
    paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: colors.brand, shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
});
