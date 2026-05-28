// Tiny i18n helper. No external lib — keep bundle small.
// Usage:
//   const { t, lang, setLang } = useI18n();
//   t('home.greeting_evening')
//   t('home.section_kitchens', { count: 8 })

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as storage from '../lib/storage.js';
import en from './en.json';
import ml from './ml.json';
import hi from './hi.json';

const DICTS = { en, ml, hi };
export const SUPPORTED_LANGS = [
  { code: 'en', label: 'English',    native: 'English'   },
  { code: 'ml', label: 'Malayalam',  native: 'മലയാളം'   },
  { code: 'hi', label: 'Hindi',      native: 'हिन्दी'     },
];

const LANG_STORAGE_KEY = 'quickrons.lang';

function getValue(dict, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

function interpolate(template, vars) {
  if (!template || !vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

const I18nContext = createContext(null);

export function I18nProvider({ children, defaultLang = 'en' }) {
  const [lang, setLangState]         = useState(defaultLang);
  const [hasChosen, setHasChosen]    = useState(false);
  const [bootstrapping, setBoot]     = useState(true);

  // Restore saved preference on mount. `hasChosen` gates the first-launch
  // language selection screen — false means the app should prompt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await storage.getItem(LANG_STORAGE_KEY);
      if (cancelled) return;
      if (saved && DICTS[saved]) {
        setLangState(saved);
        setHasChosen(true);
      }
      setBoot(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const setLang = (code) => {
    if (!DICTS[code]) return;
    setLangState(code);
    setHasChosen(true);
    storage.setItem(LANG_STORAGE_KEY, code);
  };

  const t = useMemo(() => {
    return (key, vars) => {
      const dict = DICTS[lang] || DICTS.en;
      const fallback = DICTS.en;
      const val = getValue(dict, key) ?? getValue(fallback, key) ?? key;
      return typeof val === 'string' ? interpolate(val, vars) : val;
    };
  }, [lang]);

  const value = useMemo(
    () => ({ t, lang, setLang, hasChosen, bootstrapping }),
    [t, lang, hasChosen, bootstrapping],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
