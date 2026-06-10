// PartnerBrandingScreen — partner storefront branding manager.
//
// Lets a partner set the imagery customers see on the Home feed and kitchen
// page: a wide cover/banner, a square profile photo, a short tagline, and a
// gallery of kitchen photos.
//
// Routes used (all server-scoped to the authenticated partner):
//   GET   /api/v1/partner/me                 → current branding
//   PATCH /api/v1/partner/me                 → save { tagline, profileImageUrl,
//                                               bannerImageUrl, galleryUrls }
//   POST  /api/v1/partner/menu/upload (file) → { url } (reused for all images)
//
// Upload pattern mirrors PartnerMenuScreen: pick → upload → get url → PATCH.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  TextInput, Alert, Image, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../state/AuthContext';
import { partnerApi, partnerMenuApi, API_BASE } from '../lib/api';
import { pickImage, imagePickerAvailable, IMAGE_TARGETS } from '../lib/imagePick';
import { colors, radii, space } from '../theme';

const GALLERY_MAX = 12;

// Relative /uploads/… (local-disk) → absolute so <Image> can fetch it.
function resolveImageUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return url;
}

export default function PartnerBrandingScreen({ navigation }) {
  const { accessToken } = useAuth();

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const [saving, setSaving]         = useState(false);
  // which slot is currently uploading: 'profile' | 'banner' | 'gallery' | null
  const [uploadingSlot, setUploadingSlot] = useState(null);

  const [profileImageUrl, setProfileImageUrl] = useState(null);
  const [bannerImageUrl,  setBannerImageUrl]  = useState(null);
  const [galleryUrls,     setGalleryUrls]     = useState([]);
  const [tagline,         setTagline]         = useState('');
  // Snapshot of the last server-confirmed state — drives the dirty check.
  const [saved, setSaved] = useState({ profileImageUrl: null, bannerImageUrl: null, galleryUrls: [], tagline: '' });

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const { partner } = await partnerApi.me(accessToken);
      setProfileImageUrl(partner.profileImageUrl || null);
      setBannerImageUrl(partner.bannerImageUrl || null);
      setGalleryUrls(partner.galleryUrls || []);
      setTagline(partner.tagline || '');
      setSaved({
        profileImageUrl: partner.profileImageUrl || null,
        bannerImageUrl:  partner.bannerImageUrl || null,
        galleryUrls:     partner.galleryUrls || [],
        tagline:         partner.tagline || '',
      });
    } catch (e) {
      setError(e.message || 'Failed to load storefront');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const dirty =
    profileImageUrl !== saved.profileImageUrl ||
    bannerImageUrl  !== saved.bannerImageUrl ||
    tagline.trim()  !== (saved.tagline || '') ||
    JSON.stringify(galleryUrls) !== JSON.stringify(saved.galleryUrls);

  // ── Pick + upload one image; returns the stored url (or null on cancel) ────
  // Uses the shared picker: a real <input type="file"> + canvas resize on web,
  // expo-image-picker (+ optional resize) on native.
  async function pickAndUpload(slot) {
    if (!imagePickerAvailable) {
      Alert.alert(
        'Setup required',
        'The image picker is not available.\n\nRun this in the QuickronsApp folder:\n\n  npx expo install expo-image-picker',
      );
      return null;
    }
    let payload;
    try {
      payload = await pickImage(slot);            // resized + JPEG-normalised
    } catch (err) {
      if (err?.setup) {
        Alert.alert('Setup required', 'Run: npx expo install expo-image-picker');
      } else if (err?.permission) {
        Alert.alert('Permission needed', 'Grant photo/camera access from system settings to add an image.');
      } else {
        Alert.alert('Could not open picker', err?.message || String(err));
      }
      return null;
    }
    if (!payload) return null;                     // user cancelled

    setUploadingSlot(slot);
    try {
      const { url } = await partnerMenuApi.upload(payload, accessToken);
      return url;
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Could not upload image');
      return null;
    } finally {
      setUploadingSlot(null);
    }
  }

  async function uploadProfile() {
    const url = await pickAndUpload('profile');
    if (url) setProfileImageUrl(url);
  }
  async function uploadBanner() {
    const url = await pickAndUpload('banner');
    if (url) setBannerImageUrl(url);
  }
  async function addGalleryImage() {
    if (galleryUrls.length >= GALLERY_MAX) {
      Alert.alert('Gallery full', `You can add up to ${GALLERY_MAX} photos.`);
      return;
    }
    const url = await pickAndUpload('gallery');
    if (url) setGalleryUrls(prev => [...prev, url]);
  }
  function removeGalleryImage(idx) {
    setGalleryUrls(prev => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        tagline:         tagline.trim() || null,
        profileImageUrl: profileImageUrl || null,
        bannerImageUrl:  bannerImageUrl || null,
        galleryUrls,
      };
      const { partner } = await partnerApi.updateProfile(body, accessToken);
      setSaved({
        profileImageUrl: partner.profileImageUrl || null,
        bannerImageUrl:  partner.bannerImageUrl || null,
        galleryUrls:     partner.galleryUrls || [],
        tagline:         partner.tagline || '',
      });
      Alert.alert('Saved', 'Your storefront has been updated.');
    } catch (e) {
      Alert.alert('Could not save', e.message || 'Server error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.muted}>Loading storefront…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const busy = uploadingSlot !== null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Storefront</Text>
          <Text style={styles.subtitle}>How customers see your kitchen</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={colors.brand}
          />
        }
      >
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        )}

        {/* Cover / banner */}
        <Text style={styles.label}>Cover photo</Text>
        <Text style={styles.hint}>Wide banner at the top of your kitchen page. Recommended {IMAGE_TARGETS.cover.recommend} · JPG/PNG/WebP.</Text>
        <View style={styles.bannerWrap}>
          {bannerImageUrl ? (
            <Image source={{ uri: resolveImageUrl(bannerImageUrl) }} style={styles.banner} resizeMode="cover" />
          ) : (
            <View style={[styles.banner, styles.empty]}>
              <Ionicons name="image-outline" size={30} color={colors.inkMuted} />
              <Text style={styles.emptyTxt}>No cover yet</Text>
            </View>
          )}
          {uploadingSlot === 'banner' && <UploadingOverlay />}
        </View>
        <View style={styles.btnRow}>
          <Pressable onPress={uploadBanner} disabled={busy} style={[styles.btn, styles.btnPrimary, busy && styles.dim]}>
            <Ionicons name={bannerImageUrl ? 'sync' : 'cloud-upload'} size={16} color="#fff" />
            <Text style={styles.btnPrimaryTxt}>{bannerImageUrl ? 'Change cover' : 'Add cover'}</Text>
          </Pressable>
          {bannerImageUrl ? (
            <Pressable onPress={() => setBannerImageUrl(null)} disabled={busy} style={[styles.btn, styles.btnGhost]}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={[styles.btnGhostTxt, { color: colors.danger }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Profile photo */}
        <Text style={[styles.label, { marginTop: space.lg }]}>Profile photo</Text>
        <Text style={styles.hint}>Square logo or kitchen photo on the Home feed card. Recommended {IMAGE_TARGETS.profile.recommend}.</Text>
        <View style={styles.profileRow}>
          <View style={styles.profileWrap}>
            {profileImageUrl ? (
              <Image source={{ uri: resolveImageUrl(profileImageUrl) }} style={styles.profileImg} resizeMode="cover" />
            ) : (
              <View style={[styles.profileImg, styles.empty]}>
                <Ionicons name="restaurant" size={26} color={colors.inkMuted} />
              </View>
            )}
            {uploadingSlot === 'profile' && <UploadingOverlay round />}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Pressable onPress={uploadProfile} disabled={busy} style={[styles.btn, styles.btnPrimary, busy && styles.dim]}>
              <Ionicons name={profileImageUrl ? 'sync' : 'cloud-upload'} size={16} color="#fff" />
              <Text style={styles.btnPrimaryTxt}>{profileImageUrl ? 'Change photo' : 'Add photo'}</Text>
            </Pressable>
            {profileImageUrl ? (
              <Pressable onPress={() => setProfileImageUrl(null)} disabled={busy} style={[styles.btn, styles.btnGhost]}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={[styles.btnGhostTxt, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Tagline */}
        <Text style={[styles.label, { marginTop: space.lg }]}>Tagline</Text>
        <Text style={styles.hint}>One short line customers see under your name (max 140).</Text>
        <TextInput
          style={styles.input}
          value={tagline}
          onChangeText={t => setTagline(t.slice(0, 140))}
          placeholder="e.g. Authentic Malabar home cooking"
          placeholderTextColor={colors.inkMuted}
          maxLength={140}
        />

        {/* Gallery */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.lg }}>
          <Text style={[styles.label, { flex: 1, marginBottom: 0 }]}>Gallery</Text>
          <Text style={styles.counter}>{galleryUrls.length}/{GALLERY_MAX}</Text>
        </View>
        <Text style={styles.hint}>Show off your kitchen, packaging, and signature dishes.</Text>
        <View style={styles.galleryGrid}>
          {galleryUrls.map((url, idx) => (
            <View key={`${url}-${idx}`} style={styles.galleryCell}>
              <Image source={{ uri: resolveImageUrl(url) }} style={styles.galleryImg} resizeMode="cover" />
              <Pressable onPress={() => removeGalleryImage(idx)} style={styles.galleryRemove}>
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
          {galleryUrls.length < GALLERY_MAX && (
            <Pressable onPress={addGalleryImage} disabled={busy} style={[styles.galleryCell, styles.galleryAdd, busy && styles.dim]}>
              {uploadingSlot === 'gallery' ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <>
                  <Ionicons name="add" size={26} color={colors.brand} />
                  <Text style={styles.galleryAddTxt}>Add</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Save bar */}
      <View style={styles.saveBar}>
        <Pressable
          onPress={save}
          disabled={saving || busy || !dirty}
          style={[styles.saveBtn, (saving || busy || !dirty) && styles.saveBtnDisabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnTxt}>{dirty ? 'Save storefront' : 'All changes saved'}</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function UploadingOverlay({ round }) {
  return (
    <View style={[styles.overlay, round && { borderRadius: 999 }]}>
      <ActivityIndicator color="#fff" />
      <Text style={styles.overlayTxt}>Uploading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgAlt },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconBtn: { padding: 4 },
  title:    { fontSize: 17, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 12, color: colors.inkSoft, marginTop: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted:  { fontSize: 14, color: colors.inkSoft },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.danger + '12', borderRadius: radii.sm,
    padding: 10, marginBottom: space.md,
  },
  errorTxt: { flex: 1, color: colors.danger, fontSize: 12, fontWeight: '700' },

  label: {
    fontSize: 11, fontWeight: '800', color: colors.inkSoft,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4,
  },
  hint: { fontSize: 12, color: colors.inkMuted, marginBottom: 8 },
  counter: { fontSize: 12, color: colors.inkMuted, fontWeight: '700' },

  bannerWrap: { marginBottom: 8 },
  banner: { width: '100%', height: 160, borderRadius: radii.md, backgroundColor: colors.bg },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  emptyTxt: { color: colors.inkMuted, fontSize: 12, fontWeight: '600' },

  profileRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  profileWrap: {},
  profileImg: { width: 96, height: 96, borderRadius: radii.md, backgroundColor: colors.bg },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink,
    backgroundColor: colors.bg,
  },

  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  galleryCell: { width: 96, height: 96, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.bg },
  galleryImg: { width: '100%', height: '100%' },
  galleryRemove: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(15,23,42,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  galleryAdd: {
    alignItems: 'center', justifyContent: 'center', gap: 2,
    borderWidth: 1, borderColor: colors.brand, borderStyle: 'dashed',
  },
  galleryAddTxt: { fontSize: 11, fontWeight: '800', color: colors.brand },

  btnRow: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 11, borderRadius: radii.sm,
  },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  btnGhost: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  btnGhostTxt: { fontWeight: '800', fontSize: 13 },
  dim: { opacity: 0.6 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)', borderRadius: radii.md,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  overlayTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },

  saveBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg,
    backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.brand, paddingVertical: 14, borderRadius: radii.md,
  },
  saveBtnDisabled: { backgroundColor: colors.inkMuted, opacity: 0.85 },
  saveBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
