import { useColorScheme } from 'react-native';
import { useSettingsStore } from './store/settingsStore';

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  bg: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  accent: string;
  accentSecondary: string;
  accentText: string;
  danger: string;
  dangerSoft: string;
}

const PALETTES: Record<ColorScheme, Palette> = {
  light: {
    bg: '#EBF7F6',
    card: '#2EC4B6',
    text: '#1A1A1A',
    subtext: '#3D474D',
    border: '#DCEEEC',
    accent: '#FF9F1C',
    accentSecondary: '#FFBF69',
    accentText: '#00487C',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
  },
  dark: {
    bg: '#00487C',
    card: '#3E6680',
    text: '#F2F2F5',
    subtext: '#A8C4D8',
    border: '#2A5478',
    accent: '#0496FF',
    accentSecondary: '#4BB3FD',
    accentText: '#FFFFFF',
    danger: '#F87171',
    dangerSoft: '#3F1D1D',
  },
};

export function getPalette(scheme: ColorScheme): Palette {
  return PALETTES[scheme];
}

export function useTheme(): { scheme: ColorScheme; colors: Palette } {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const scheme: ColorScheme =
    themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;
  return { scheme, colors: getPalette(scheme) };
}
