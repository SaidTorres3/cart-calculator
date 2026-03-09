import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';

const getInitialLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem('user-language');
    if (savedLanguage) {
      return savedLanguage;
    }
  } catch (error) {
    console.log('Error reading language from AsyncStorage:', error);
  }
  return Localization.getLocales()[0]?.languageCode || 'en';
};

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    zh: { translation: zh },
    ja: { translation: ja }
  },
  lng: 'en', // default, will be updated
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

// Initialize with saved or device language
getInitialLanguage().then((lang) => {
  i18n.changeLanguage(lang.split('-')[0]);
});

export default i18n;
