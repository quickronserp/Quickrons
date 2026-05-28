import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, space } from '../theme';

const SEGMENTS = [
  { id: 'homeMaker', label: 'Home maker', icon: 'home', color: colors.homeMaker,
    desc: 'I cook from a home kitchen, want to sell limited daily quantity.' },
  { id: 'restaurant', label: 'Restaurant', icon: 'business', color: colors.premium,
    desc: 'I run a restaurant offering delivery SKUs and packaged meals.' },
  { id: 'caterer', label: 'Caterer', icon: 'people', color: colors.caterer,
    desc: 'I run a tiffin / catering service with daily orders.' },
];

export default function PartnerOnboardingScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const [segment, setSegment] = useState(null);
  const [name, setName] = useState('');
  const [fssai, setFssai] = useState('');
  const [phone, setPhone] = useState('');

  const total = 3;
  const next = () => setStep(s => Math.min(s + 1, total));
  const back = () => step === 0 ? navigation.goBack() : setStep(s => s - 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={back} style={{ padding: 8 }}>
          <Ionicons name={step === 0 ? 'close' : 'arrow-back'} size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Become a partner</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.progress}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressBar, i <= step && { backgroundColor: colors.brand }]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 140 }}>
        {step === 0 && (
          <>
            <Text style={styles.heading}>What kind of kitchen do you run?</Text>
            <Text style={styles.subhead}>We onboard each segment with a different audit and pricing model.</Text>
            {SEGMENTS.map(s => (
              <Pressable
                key={s.id}
                onPress={() => setSegment(s.id)}
                style={[styles.segCard, segment === s.id && { borderColor: s.color, backgroundColor: s.color + '10' }]}>
                <View style={[styles.segIcon, { backgroundColor: s.color + '20' }]}>
                  <Ionicons name={s.icon} size={22} color={s.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.segTitle}>{s.label}</Text>
                  <Text style={styles.segDesc}>{s.desc}</Text>
                </View>
                {segment === s.id && (
                  <Ionicons name="checkmark-circle" size={22} color={s.color} />
                )}
              </Pressable>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.heading}>Tell us about your kitchen</Text>
            <Field label="Kitchen / brand name" value={name} onChange={setName} placeholder="e.g. Amma's Andhra Kitchen" />
            <Field label="FSSAI license number" value={fssai} onChange={setFssai} placeholder="14-digit FSSAI ID" />
            <Field label="Phone (WhatsApp)" value={phone} onChange={setPhone} placeholder="+91 ..." />
            <View style={styles.helpBox}>
              <Ionicons name="information-circle" size={18} color={colors.brand} />
              <Text style={styles.helpTxt}>
                Don't have FSSAI? We help you get one for free during onboarding.
              </Text>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.heading}>What happens next</Text>
            <NextStep n="1" title="Kitchen visit" desc="Our ops team visits within 48 hours for hygiene & process audit." />
            <NextStep n="2" title="Cooking & taste panel" desc="3-person blind tasting on your signature dishes." />
            <NextStep n="3" title="Menu & pricing setup" desc="We build your storefront and pricing slabs together." />
            <NextStep n="4" title="Go live" desc="You start receiving orders within 7 days of the audit." />
            <View style={[styles.helpBox, { backgroundColor: colors.success + '10' }]}>
              <Ionicons name="cash-outline" size={18} color={colors.success} />
              <Text style={[styles.helpTxt, { color: colors.success }]}>
                Home makers: 12% commission. Caterers: 15%. Restaurants: 18–22%.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <Pressable
        onPress={step === total - 1 ? () => navigation.goBack() : next}
        disabled={step === 0 && !segment}
        style={[styles.cta, step === 0 && !segment && { opacity: 0.4 }]}>
        <Text style={styles.ctaTxt}>{step === total - 1 ? 'Submit application' : 'Continue'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
      />
    </View>
  );
}

function NextStep({ n, title, desc }) {
  return (
    <View style={styles.nsRow}>
      <View style={styles.nsBubble}><Text style={styles.nsBubbleTxt}>{n}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nsTitle}>{title}</Text>
        <Text style={styles.nsDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink },
  progress: {
    flexDirection: 'row', gap: 6, padding: space.lg, paddingBottom: 0,
  },
  progressBar: { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2 },
  heading: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  subhead: { fontSize: 14, color: colors.inkSoft, marginBottom: space.lg },
  segCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: space.md, borderRadius: radii.md,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: 10,
  },
  segIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  segTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  segDesc: { fontSize: 12, color: colors.inkSoft, marginTop: 2, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink,
  },
  helpBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.brand + '10', padding: 12, borderRadius: radii.md, marginTop: 16,
  },
  helpTxt: { flex: 1, fontSize: 12, color: colors.brand, fontWeight: '600', lineHeight: 18 },
  nsRow: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  nsBubble: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  nsBubbleTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  nsTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  nsDesc: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  cta: {
    position: 'absolute', bottom: 18, left: 18, right: 18,
    backgroundColor: colors.brand, borderRadius: radii.lg, padding: 16, alignItems: 'center',
  },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
