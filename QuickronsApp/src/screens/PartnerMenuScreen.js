// PartnerMenuScreen — partner-owned menu CRUD.
// Lets a partner add / edit / hide their own menu items end-to-end,
// including direct photo upload (camera / gallery / computer file).
//
// Routes used (all server-scoped to the authenticated partner):
//   GET    /api/v1/partner/menu
//   POST   /api/v1/partner/menu
//   PATCH  /api/v1/partner/menu/:id
//   DELETE /api/v1/partner/menu/:id   (soft delete → active:false)
//   POST   /api/v1/partner/menu/upload (multipart "file") → { url, ... }

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  TextInput, RefreshControl, Alert, Image, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../state/AuthContext';
import { partnerMenuApi, API_BASE } from '../lib/api';
import { pickImage, imagePickerAvailable, IMAGE_TARGETS } from '../lib/imagePick';
import { confirmAction } from '../lib/confirm';
import { goHomeOrBack } from '../lib/nav';
import { colors, radii, space } from '../theme';

// Backend may return a relative path (/uploads/menu/<id>/<file>.jpg) for
// local-disk storage, or an absolute https://res.cloudinary.com/... URL.
// Convert relative to absolute so <Image source={{uri}}/> can fetch it.
function resolveImageUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return url;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['mains', 'biryani', 'breakfast', 'snacks', 'healthy', 'wellness', 'catering'];

function rupees(paise) {
  const n = Number(paise);
  if (!n) return '₹0';
  return `₹${(n / 100).toFixed(0)}`;
}

function blank() {
  return {
    id:          null,           // null = create mode
    name:        '',
    description: '',
    pricePaise:  '',             // string while editing — converted on save
    category:    'mains',
    imageUrl:    '',
    isVeg:       true,
    signature:   false,
    active:      true,
    dailyQuantityLimit: '',
    sortOrder:   '',
  };
}

function paiseFromRupeesString(rupeesStr) {
  const trimmed = String(rupeesStr).trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

// Build the JSON body for create / update. Strips empty optional fields.
function buildPayload(form, isCreate) {
  const out = {
    name:        form.name.trim(),
    description: form.description.trim(),
    pricePaise:  paiseFromRupeesString(form.pricePaise),
    category:    form.category || null,
    imageUrl:    form.imageUrl.trim() || null,
    isVeg:       !!form.isVeg,
    signature:   !!form.signature,
    active:      !!form.active,
  };
  // sortOrder: blank string → omit so server keeps existing value (or 0 on create)
  if (String(form.sortOrder).trim() !== '') {
    out.sortOrder = Number(form.sortOrder);
  } else if (isCreate) {
    out.sortOrder = 0;
  }
  // dailyQuantityLimit: blank → null (unlimited)
  out.dailyQuantityLimit =
    String(form.dailyQuantityLimit).trim() === ''
      ? null
      : Number(form.dailyQuantityLimit);
  return out;
}

// Returns null when the form is saveable, otherwise a short error string.
// Used both for the inline hint and to gate the primary CTA.
function validate(form) {
  const name = (form.name || '').trim();
  const desc = (form.description || '').trim();
  if (!name)          return 'Enter the item name to continue';
  if (name.length < 2) return 'Item name is too short';
  if (!desc)          return 'Add a short description so customers know what they\'re ordering';
  const paise = paiseFromRupeesString(form.pricePaise);
  if (paise == null)  return 'Enter a price in ₹';
  if (paise < 100)    return 'Price must be at least ₹1';
  if (paise > 1_000_000_00) return 'Price exceeds the maximum (₹1,00,00,000)';
  if (!form.category) return 'Pick a category';
  const imgRaw = (form.imageUrl || '').trim();
  // Accept absolute http(s) URLs (Cloudinary) OR a server-relative /uploads/…
  // path (local-disk storage). Previously this rejected the relative path the
  // upload endpoint returns when Cloudinary isn't configured, silently gating
  // the Save button after a successful upload.
  if (imgRaw && !/^https?:\/\/\S+$/i.test(imgRaw) && !imgRaw.startsWith('/uploads/')) {
    return 'Image URL must start with http:// or https:// (or be an uploaded image)';
  }
  if (String(form.dailyQuantityLimit).trim() !== '') {
    const q = Number(form.dailyQuantityLimit);
    if (!Number.isFinite(q) || q < 0) return 'Daily limit must be 0 or more (blank = unlimited)';
  }
  return null;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function PartnerMenuScreen({ navigation }) {
  const { accessToken } = useAuth();

  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const [editing, setEditing]       = useState(null);  // null = list view; object = editor
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [showUrlPaste, setShowUrlPaste] = useState(false); // advanced fallback

  // ── Photo upload ─────────────────────────────────────────────────────────
  //
  // Tries native image-picker if available. On web, expo-image-picker uses
  // the browser file input under the hood — same API for both platforms.
  //
  // Camera vs gallery: native shows a system sheet via launchCameraAsync /
  // launchImageLibraryAsync. On web only the file picker is supported, so we
  // skip the source choice and go straight to the library picker.

  async function pickAndUpload(source /* 'camera' | 'library' */) {
    if (!imagePickerAvailable) {
      Alert.alert(
        'Setup required',
        'The image picker is not available.\n\nRun this in the QuickronsApp folder:\n\n  npx expo install expo-image-picker',
      );
      return;
    }
    let payload;
    try {
      payload = await pickImage('dish', { source });   // resized + JPEG-normalised
    } catch (err) {
      if (err?.setup) {
        Alert.alert('Setup required', 'Run: npx expo install expo-image-picker');
      } else if (err?.permission) {
        Alert.alert('Permission needed', 'Grant photo/camera access from system settings to add a photo.');
      } else {
        Alert.alert('Could not open picker', err?.message || String(err));
      }
      return;
    }
    if (!payload) return;                               // user cancelled

    setUploading(true);
    try {
      const { url } = await partnerMenuApi.upload(payload, accessToken);
      setEditing(e => ({ ...e, imageUrl: url }));
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Could not upload image');
    } finally {
      setUploading(false);
    }
  }

  function clearPhoto() {
    setEditing(e => ({ ...e, imageUrl: '' }));
  }

  // On native we offer a small chooser; on web there is no camera path so
  // we go straight to the file picker.
  function startUpload() {
    if (Platform.OS === 'web') return pickAndUpload('library');
    Alert.alert(
      'Add photo',
      'Choose where to get the photo from.',
      [
        { text: 'Take photo',       onPress: () => pickAndUpload('camera') },
        { text: 'Choose from gallery', onPress: () => pickAndUpload('library') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  const fetchItems = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await partnerMenuApi.list(accessToken);
      setItems(res.items || []);
    } catch (e) {
      setError(e.message || 'Failed to load menu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const onRefresh = () => { setRefreshing(true); fetchItems(); };

  const openCreate = () => setEditing(blank());
  const openEdit   = (item) => setEditing({
    id:                 item.id,
    name:               item.name || '',
    description:        item.description || '',
    pricePaise:         item.pricePaise ? String(item.pricePaise / 100) : '',
    category:           item.category || 'mains',
    imageUrl:           item.imageUrl || '',
    isVeg:              !!item.isVeg,
    signature:          !!item.signature,
    active:             !!item.active,
    dailyQuantityLimit: item.dailyQuantityLimit == null ? '' : String(item.dailyQuantityLimit),
    sortOrder:          item.sortOrder == null ? '' : String(item.sortOrder),
  });
  const cancelEdit = () => setEditing(null);

  async function save() {
    if (!editing) return;
    const err = validate(editing);
    if (err) { Alert.alert('Check your inputs', err); return; }

    setSaving(true);
    try {
      const isCreate = !editing.id;
      const payload  = buildPayload(editing, isCreate);
      if (isCreate) {
        await partnerMenuApi.create(payload, accessToken);
      } else {
        await partnerMenuApi.update(editing.id, payload, accessToken);
      }
      setEditing(null);
      await fetchItems(true);
    } catch (e) {
      Alert.alert('Could not save', e.message || 'Server error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    try {
      await partnerMenuApi.update(item.id, { active: !item.active }, accessToken);
      await fetchItems(true);
    } catch (e) {
      Alert.alert('Could not update', e.message);
    }
  }

  // Remove = soft delete on the server (active:false). Historical orders keep
  // their own snapshot of the item, so this never breaks past orders. The item
  // disappears from the customer storefront and from this list immediately.
  //
  // Uses confirmAction (window.confirm on web) because Alert.alert button
  // callbacks don't fire on React Native Web — previously the DELETE never ran.
  async function removeItem(item) {
    const confirmed = await confirmAction({
      title: 'Remove this item?',
      message: `"${item.name}" will be removed from your menu and hidden from customers. Past orders are kept. This can't be undone from the app.`,
      confirmLabel: 'Remove',
    });
    if (!confirmed) return;

    try {
      await partnerMenuApi.remove(item.id, accessToken);
      // Optimistically drop it from the list so it vanishes right away…
      setItems(prev => prev.filter(i => i.id !== item.id));
      // …then reconcile with the server (also drops any now-inactive rows).
      await fetchItems(true);
    } catch (e) {
      Alert.alert('Could not remove', e.message || 'Server error');
      await fetchItems(true); // resync if the optimistic drop was wrong
    }
  }

  // ── Editor view ──────────────────────────────────────────────────────────
  //
  // Layout contract (avoids previous bugs):
  //   SafeAreaView (flex:1)
  //   ├─ Header
  //   └─ KeyboardAvoidingView (flex:1)
  //       ├─ ScrollView (flex:1)   ← consumes remaining height
  //       │   └─ Form (maxWidth:640, centered on web)
  //       └─ BottomBar  (NOT absolute; sibling so it never overlaps fields)
  //
  // Validation is live-computed so the primary CTA disables when invalid.

  if (editing) {
    const isCreate    = !editing.id;
    const validationError = validate(editing);
    const isValid     = validationError === null;

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={cancelEdit} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{isCreate ? 'New Item' : 'Edit Item'}</Text>
            <Text style={styles.subtitle}>
              {isCreate ? 'Add a dish to your menu' : editing.name || 'Untitled'}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.editorScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            {/* maxWidth wrapper — keeps the form readable on desktop web */}
            <View style={styles.formCol}>

              {/* 1. Item name */}
              <Field
                label="Item name"
                required
                value={editing.name}
                onChangeText={t => setEditing(e => ({ ...e, name: t }))}
                placeholder="e.g. Malabar Chicken Biryani"
                maxLength={120}
                autoFocus
                returnKeyType="next"
              />

              {/* 2. Description */}
              <Field
                label="Description"
                required
                value={editing.description}
                onChangeText={t => setEditing(e => ({ ...e, description: t }))}
                placeholder="Short, appetising description shown on the customer card"
                multiline
                maxLength={500}
                hint={`${editing.description.length}/500`}
              />

              {/* 3. Price + 4. Daily limit (side-by-side on wider screens) */}
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Price (₹)"
                    required
                    value={editing.pricePaise}
                    onChangeText={t => setEditing(e => ({ ...e, pricePaise: t.replace(/[^0-9.]/g, '') }))}
                    placeholder="199"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Daily limit"
                    value={editing.dailyQuantityLimit}
                    onChangeText={t => setEditing(e => ({ ...e, dailyQuantityLimit: t.replace(/[^0-9]/g, '') }))}
                    placeholder="Unlimited"
                    keyboardType="number-pad"
                    hint="Blank = unlimited"
                  />
                </View>
              </View>

              {/* 5. Category */}
              <Text style={styles.label}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: space.md, flexGrow: 0 }}
                contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                {CATEGORIES.map(c => {
                  const active = editing.category === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setEditing(e => ({ ...e, category: c }))}
                      style={[styles.chip, active && styles.chipActive]}>
                      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* 6. Photo — upload-first, with URL paste as an advanced fallback */}
              <Text style={styles.label}>Photo</Text>

              {/* Live preview (always rendered; placeholder when empty) */}
              <View style={styles.previewWrap}>
                {editing.imageUrl ? (
                  <Image
                    source={{ uri: resolveImageUrl(editing.imageUrl) }}
                    style={styles.previewImg}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.previewImg, styles.previewEmpty]}>
                    <Ionicons name="image-outline" size={30} color={colors.inkMuted} />
                    <Text style={styles.previewEmptyTxt}>No photo yet</Text>
                  </View>
                )}

                {uploading && (
                  <View style={styles.previewLoading}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.previewLoadingTxt}>Uploading…</Text>
                  </View>
                )}
              </View>

              {/* Upload / Change / Remove buttons */}
              <View style={styles.photoActions}>
                <Pressable
                  onPress={startUpload}
                  disabled={uploading}
                  style={[styles.photoBtn, styles.photoBtnPrimary, uploading && { opacity: 0.6 }]}>
                  <Ionicons
                    name={editing.imageUrl ? 'sync' : 'cloud-upload'}
                    size={16}
                    color="#fff"
                  />
                  <Text style={styles.photoBtnPrimaryTxt}>
                    {editing.imageUrl
                      ? (Platform.OS === 'web' ? 'Change photo' : 'Change')
                      : (Platform.OS === 'web' ? 'Upload photo' : 'Add photo')}
                  </Text>
                </Pressable>

                {editing.imageUrl ? (
                  <Pressable
                    onPress={clearPhoto}
                    disabled={uploading}
                    style={[styles.photoBtn, styles.photoBtnGhost]}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={[styles.photoBtnGhostTxt, { color: colors.danger }]}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.hint}>
                {Platform.OS === 'web'
                  ? `JPG, PNG or WebP. Recommended ${IMAGE_TARGETS.dish.recommend}. Large photos are resized automatically.`
                  : `JPG, PNG or WebP. Recommended ${IMAGE_TARGETS.dish.recommend}. Take a fresh photo or pick from your gallery.`}
              </Text>

              {/* Advanced: paste a URL instead of uploading */}
              <Pressable
                onPress={() => setShowUrlPaste(v => !v)}
                style={styles.advancedToggle}>
                <Ionicons
                  name={showUrlPaste ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={colors.inkSoft}
                />
                <Text style={styles.advancedToggleTxt}>
                  {showUrlPaste ? 'Hide URL paste option' : 'Or paste an image URL (advanced)'}
                </Text>
              </Pressable>

              {showUrlPaste && (
                <View style={{ marginTop: 6, marginBottom: space.md }}>
                  <TextInput
                    style={styles.input}
                    value={editing.imageUrl}
                    onChangeText={t => setEditing(e => ({ ...e, imageUrl: t }))}
                    placeholder="https://… (Cloudinary, S3, Unsplash, etc.)"
                    placeholderTextColor={colors.inkMuted}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.hint}>Must start with http:// or https://</Text>
                </View>
              )}

              {/* 8-10. Toggles */}
              <ToggleRow
                label="Vegetarian"
                icon="leaf"
                value={editing.isVeg}
                onValueChange={v => setEditing(e => ({ ...e, isVeg: v }))}
              />
              <ToggleRow
                label="Signature dish (highlighted on storefront)"
                icon="star"
                value={editing.signature}
                onValueChange={v => setEditing(e => ({ ...e, signature: v }))}
              />
              <ToggleRow
                label="Available now"
                icon="checkmark-circle"
                value={editing.active}
                onValueChange={v => setEditing(e => ({ ...e, active: v }))}
              />

              {/* Inline validation — visible whenever the form is incomplete */}
              {validationError && (
                <View style={styles.inlineError}>
                  <Ionicons name="information-circle" size={14} color={colors.brand} />
                  <Text style={styles.inlineErrorTxt}>{validationError}</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom bar — sibling, NOT absolute. Never overlaps fields. */}
          <View style={styles.bottomBar}>
            <Pressable onPress={cancelEdit} style={[styles.btn, styles.btnGhost]}>
              <Text style={styles.btnGhostTxt}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={saving || !isValid}
              style={[
                styles.btn,
                styles.btnPrimary,
                (saving || !isValid) && styles.btnPrimaryDisabled,
              ]}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="save" size={16} color="#fff" />
                  <Text style={styles.btnPrimaryTxt}>
                    {isCreate ? 'Add item' : 'Save changes'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => goHomeOrBack(navigation, 'PartnerOps')} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Menu Manager</Text>
          <Text style={styles.subtitle}>
            {items.length} item{items.length !== 1 ? 's' : ''} · {items.filter(i => i.active).length} live
          </Text>
        </View>
        <Pressable onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnTxt}>New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.muted}>Loading menu…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
          <Text style={[styles.muted, { color: colors.danger }]}>{error}</Text>
          <Pressable onPress={fetchItems} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="restaurant-outline" size={48} color={colors.inkMuted} />
          <Text style={styles.emptyTitle}>No items yet</Text>
          <Text style={styles.muted}>Add your first dish to start selling</Text>
          <Pressable onPress={openCreate} style={styles.emptyCta}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={styles.emptyCtaTxt}>Add first item</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.md, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          {items.map(item => (
            <View key={item.id} style={[styles.itemCard, !item.active && styles.itemCardInactive]}>
              {/* Thumbnail */}
              {item.imageUrl ? (
                <Image
                  source={{ uri: resolveImageUrl(item.imageUrl) }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Ionicons name="restaurant" size={22} color={colors.inkMuted} />
                </View>
              )}

              {/* Info */}
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  {item.signature && (
                    <View style={styles.sigPill}><Text style={styles.sigPillTxt}>Signature</Text></View>
                  )}
                </View>
                <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.itemPrice}>{rupees(item.pricePaise)}</Text>
                  <Text style={styles.itemMeta}>
                    {item.category || 'uncategorised'} · {item.isVeg ? 'Veg' : 'Non-veg'}
                    {item.dailyQuantityLimit != null && ` · ${item.dailyQuantityLimit}/day`}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  <Pressable onPress={() => openEdit(item)} style={styles.actBtn}>
                    <Ionicons name="create-outline" size={14} color={colors.brand} />
                    <Text style={styles.actBtnTxt}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => toggleActive(item)} style={styles.actBtn}>
                    <Ionicons
                      name={item.active ? 'eye-off-outline' : 'eye-outline'}
                      size={14}
                      color={item.active ? colors.accent : colors.success}
                    />
                    <Text style={[styles.actBtnTxt, { color: item.active ? colors.accent : colors.success }]}>
                      {item.active ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                  {item.active && (
                    <Pressable onPress={() => removeItem(item)} style={styles.actBtn}>
                      <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      <Text style={[styles.actBtnTxt, { color: colors.danger }]}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Field({ label, required, hint, multiline, ...rest }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={styles.label}>
        {label}{required ? <Text style={{ color: colors.brand }}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        placeholderTextColor={colors.inkMuted}
        multiline={multiline}
        {...rest}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function ToggleRow({ label, icon, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      <Ionicons name={icon} size={18} color={value ? colors.brand : colors.inkMuted} />
      <Text style={[styles.toggleLabel, value && { color: colors.ink }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.brand + '80' }}
        thumbColor={value ? colors.brand : '#fff'}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radii.sm,
  },
  addBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: space.xl },
  muted:  { fontSize: 14, color: colors.inkSoft },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radii.md, marginTop: 6,
  },
  emptyCtaTxt: { color: '#fff', fontWeight: '800' },
  retryBtn: {
    backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radii.md,
  },
  retryTxt: { color: '#fff', fontWeight: '800' },

  itemCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: colors.bg, borderRadius: radii.md, padding: space.md,
    marginBottom: space.sm, borderWidth: 1, borderColor: colors.border,
  },
  itemCardInactive: { opacity: 0.55, borderStyle: 'dashed' },
  thumb: {
    width: 84, height: 84, borderRadius: radii.sm, backgroundColor: colors.bgAlt,
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemName:  { flex: 1, fontSize: 15, fontWeight: '800', color: colors.ink },
  sigPill:   {
    backgroundColor: colors.brand + '20', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999,
  },
  sigPillTxt:{ fontSize: 10, fontWeight: '800', color: colors.brand },
  itemDesc:  { fontSize: 12, color: colors.inkSoft, lineHeight: 16 },
  metaRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '800', color: colors.ink },
  itemMeta:  { fontSize: 11, color: colors.inkMuted, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  actionsRow:{ flexDirection: 'row', gap: 14, marginTop: 4 },
  actBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actBtnTxt: { fontSize: 12, fontWeight: '800', color: colors.brand },

  // ── Editor ────────────────────────────────────────────────────────────────
  editorScroll: {
    // Loose padding so the form breathes; flexGrow ensures the content area
    // stretches even when fields are sparse.
    padding: space.lg,
    paddingBottom: space.xl,
    flexGrow: 1,
  },
  formCol: {
    // Cap width on desktop web — keeps the form readable instead of a
    // ridiculous 1200px-wide input. alignSelf centers it inside the ScrollView.
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  previewWrap: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: space.lg,
  },
  previewImg:  {
    // Fixed height (not aspectRatio) so this block can NEVER eat the viewport
    // on a wide browser. 200 px fits comfortably above the fold on mobile too.
    width: '100%',
    height: 200,
    borderRadius: radii.md,
    backgroundColor: colors.bgAlt,
  },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  previewEmptyTxt: { color: colors.inkMuted, fontSize: 12, fontWeight: '600' },

  // Overlay shown while an upload is in flight — sits on top of the preview.
  previewLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: radii.md,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  previewLoadingTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

  photoActions: {
    flexDirection: 'row', gap: 8, marginBottom: 6,
  },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: radii.sm,
  },
  photoBtnPrimary:   { backgroundColor: colors.brand },
  photoBtnPrimaryTxt:{ color: '#fff', fontWeight: '800', fontSize: 14 },
  photoBtnGhost:     { backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border },
  photoBtnGhostTxt:  { color: colors.inkSoft, fontWeight: '800', fontSize: 14 },

  advancedToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 10, marginBottom: 4,
    alignSelf: 'flex-start',
  },
  advancedToggleTxt: { fontSize: 12, color: colors.inkSoft, fontWeight: '700' },

  inlineError: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.brand + '10',
    borderWidth: 1, borderColor: colors.brand + '40',
    borderRadius: radii.sm,
    paddingHorizontal: 12, paddingVertical: 10,
    marginTop: space.sm, marginBottom: space.sm,
  },
  inlineErrorTxt: { flex: 1, fontSize: 12, color: colors.brand, fontWeight: '700' },

  label: {
    fontSize: 11, fontWeight: '800', color: colors.inkSoft,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink,
    backgroundColor: colors.bg,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  hint: { marginTop: 4, fontSize: 11, color: colors.inkMuted },

  row2: { flexDirection: 'row', gap: 10 },

  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt:    { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  chipTxtActive: { color: '#fff' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  toggleLabel: { flex: 1, fontSize: 14, color: colors.inkSoft, fontWeight: '600' },

  // Bottom bar is now a flex sibling of the ScrollView — no absolute positioning.
  // ScrollView consumes remaining height; this row pins to the bottom naturally.
  bottomBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: radii.md,
  },
  btnGhost:    { backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border },
  btnGhostTxt: { color: colors.inkSoft, fontWeight: '800', fontSize: 14 },
  btnPrimary:  { backgroundColor: colors.brand },
  // Distinct disabled style so the user can SEE the button is gated on validation
  btnPrimaryDisabled: { backgroundColor: colors.inkMuted, opacity: 0.85 },
  btnPrimaryTxt:{ color: '#fff', fontWeight: '800', fontSize: 14 },
});
