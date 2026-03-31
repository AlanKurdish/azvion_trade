import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import ar from './ar.json';
import ckb from './ckb.json';

const savedLang = localStorage.getItem('admin_lang') || 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    ckb: { translation: ckb },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

// RTL languages
export const RTL_LANGUAGES = ['ar', 'ckb'];

export const isRtl = (lang: string) => RTL_LANGUAGES.includes(lang);

export const LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'ckb', label: 'کوردی', dir: 'rtl' },
];

export default i18n;
