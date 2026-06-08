// SmartImage — a resilient <Image> wrapper for partner/dish photos.
//
// Why this exists: image URLs come back from the backend either absolute
// (Cloudinary) or server-relative (/uploads/…). On a bad/missing/unreachable
// URL a bare <Image> renders a blank box with no hint. SmartImage:
//   • resolves relative paths against API_BASE (centralised in lib/api),
//   • shows `fallback` when there is no URL, and
//   • falls back again if the image fails to load (404, offline, etc.)
//
// Usage:
//   <SmartImage uri={item.imageUrl} style={s.thumb} fallback={<Placeholder/>} />

import React, { useState, useEffect } from 'react';
import { Image } from 'react-native';
import { resolveImageUrl } from '../lib/api';

export default function SmartImage({ uri, style, resizeMode = 'cover', fallback = null }) {
  const resolved = resolveImageUrl(uri);
  const [failed, setFailed] = useState(false);

  // Reset the error flag when the source changes (e.g. after a new upload).
  useEffect(() => { setFailed(false); }, [resolved]);

  if (!resolved || failed) return fallback;

  return (
    <Image
      source={{ uri: resolved }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setFailed(true)}
    />
  );
}
