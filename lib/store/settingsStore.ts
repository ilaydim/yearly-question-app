import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Language = 'tr' | 'en';

// Açık/koyu tema için ayrı ayrı seçilebilen renk paleti anahtarları — bkz. lib/theme.ts'teki
// PALETTE_VARIANTS. Oturum varsa Ayarlar ekranı bu değeri her değiştiğinde profiles'a da
// yazar (lib/paletteSync.ts), böylece hesaba bağlı kalır ve cihaz değiştirince korunur.
export type PaletteKey = 'default' | 'sunset' | 'forest' | 'ocean';
export const PALETTE_KEYS: PaletteKey[] = ['default', 'sunset', 'forest', 'ocean'];

function getDeviceLanguage(): Language {
  return Localization.getLocales()[0]?.languageCode === 'en' ? 'en' : 'tr';
}

interface SettingsState {
  themeMode: ThemeMode;
  language: Language;
  lightPalette: PaletteKey;
  darkPalette: PaletteKey;
  hasOnboarded: boolean;
  hasHydrated: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (language: Language) => void;
  setLightPalette: (key: PaletteKey) => void;
  setDarkPalette: (key: PaletteKey) => void;
  completeOnboarding: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      language: getDeviceLanguage(),
      lightPalette: 'default',
      darkPalette: 'default',
      hasOnboarded: false,
      hasHydrated: false,
      setThemeMode: (themeMode) => set({ themeMode }),
      setLanguage: (language) => set({ language }),
      setLightPalette: (lightPalette) => set({ lightPalette }),
      setDarkPalette: (darkPalette) => set({ darkPalette }),
      completeOnboarding: () => set({ hasOnboarded: true }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        language: state.language,
        lightPalette: state.lightPalette,
        darkPalette: state.darkPalette,
        hasOnboarded: state.hasOnboarded,
      }),
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ hasHydrated: true });
      },
    }
  )
);
