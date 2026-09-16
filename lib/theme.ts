import { useColorScheme } from 'react-native';
import { useSettingsStore, type PaletteKey } from './store/settingsStore';

export type ColorScheme = 'light' | 'dark';
export type { PaletteKey };

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

type PaletteVariant = Omit<Palette, 'danger' | 'dangerSoft'>;

// danger/dangerSoft paletten bağımsız: hata rengi her zaman aynı semantiği taşımalı,
// hangi renk paleti seçili olursa olsun kullanıcı onu "hata" olarak tanımalı.
const DANGER: Record<ColorScheme, Pick<Palette, 'danger' | 'dangerSoft'>> = {
  light: { danger: '#DC2626', dangerSoft: '#FEE2E2' },
  dark: { danger: '#F87171', dangerSoft: '#3F1D1D' },
};

const PALETTE_VARIANTS: Record<ColorScheme, Record<PaletteKey, PaletteVariant>> = {
  light: {
    default: {
      // Eskiden canlı bir turkuaz (#2EC4B6) idi — çok göze batıyordu; kartlar artık
      // sade, temiz bir yüzey (neredeyse beyaz), marka rengini accent taşıyor.
      bg: '#EBF7F6',
      card: '#F7FBFB',
      text: '#1A1A1A',
      subtext: '#3D474D',
      border: '#DCEEEC',
      accent: '#FF9F1C',
      accentSecondary: '#FFBF69',
      accentText: '#00487C',
    },
    sunset: {
      bg: '#FFF1EC',
      card: '#FFF8F5',
      text: '#2B1A17',
      subtext: '#7A5750',
      border: '#FAD9CE',
      accent: '#FF6B6B',
      accentSecondary: '#FFA3A3',
      accentText: '#6E1E1E',
    },
    forest: {
      bg: '#F1F7EC',
      card: '#F8FBF5',
      text: '#1E2A17',
      subtext: '#4F6942',
      border: '#DCEACB',
      accent: '#5C9A34',
      accentSecondary: '#96C96A',
      accentText: '#1F3D0F',
    },
    ocean: {
      bg: '#EEF3FB',
      card: '#F7FAFF',
      text: '#161C2E',
      subtext: '#4C577A',
      border: '#DCE4F7',
      accent: '#5B7FDE',
      accentSecondary: '#93ACEE',
      accentText: '#1B2A55',
    },
  },
  dark: {
    default: {
      bg: '#00487C',
      card: '#3E6680',
      text: '#F2F2F5',
      subtext: '#A8C4D8',
      border: '#2A5478',
      accent: '#0496FF',
      accentSecondary: '#4BB3FD',
      accentText: '#FFFFFF',
    },
    sunset: {
      bg: '#3D1F2B',
      card: '#5A2E3F',
      text: '#F7ECEE',
      subtext: '#E0B4C0',
      border: '#6E3A4C',
      accent: '#FF6B6B',
      accentSecondary: '#FF9A9A',
      accentText: '#FFFFFF',
    },
    forest: {
      bg: '#16301B',
      card: '#274A2C',
      text: '#EAF3E7',
      subtext: '#B7D4B0',
      border: '#37603C',
      accent: '#6BC24A',
      accentSecondary: '#9BDD7F',
      accentText: '#0C1F0E',
    },
    ocean: {
      bg: '#171B2E',
      card: '#262C4A',
      text: '#EAEDFB',
      subtext: '#AEB6DE',
      border: '#383F66',
      accent: '#7A93F0',
      accentSecondary: '#A9BAF7',
      accentText: '#12162A',
    },
  },
};

export function getPalette(scheme: ColorScheme, paletteKey: PaletteKey = 'default'): Palette {
  const variant = PALETTE_VARIANTS[scheme][paletteKey] ?? PALETTE_VARIANTS[scheme].default;
  return { ...variant, ...DANGER[scheme] };
}

export function useTheme(): { scheme: ColorScheme; colors: Palette; paletteKey: PaletteKey } {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const lightPalette = useSettingsStore((s) => s.lightPalette);
  const darkPalette = useSettingsStore((s) => s.darkPalette);
  const systemScheme = useColorScheme();
  const scheme: ColorScheme =
    themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const paletteKey = scheme === 'dark' ? darkPalette : lightPalette;
  return { scheme, colors: getPalette(scheme, paletteKey), paletteKey };
}
