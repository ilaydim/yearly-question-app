import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Language = 'tr' | 'en';

function getDeviceLanguage(): Language {
  return Localization.getLocales()[0]?.languageCode === 'en' ? 'en' : 'tr';
}

interface SettingsState {
  themeMode: ThemeMode;
  language: Language;
  hasOnboarded: boolean;
  hasHydrated: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (language: Language) => void;
  completeOnboarding: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      language: getDeviceLanguage(),
      hasOnboarded: false,
      hasHydrated: false,
      setThemeMode: (themeMode) => set({ themeMode }),
      setLanguage: (language) => set({ language }),
      completeOnboarding: () => set({ hasOnboarded: true }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        language: state.language,
        hasOnboarded: state.hasOnboarded,
      }),
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ hasHydrated: true });
      },
    }
  )
);
