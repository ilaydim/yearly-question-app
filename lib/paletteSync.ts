import type { Session } from '@supabase/supabase-js';
import { useSettingsStore, PALETTE_KEYS, type PaletteKey } from './store/settingsStore';
import { getProfile } from './supabase/profiles';

function isPaletteKey(value: string | null): value is PaletteKey {
  return value !== null && (PALETTE_KEYS as string[]).includes(value);
}

// authStore'daki her session değişiminde (açılış + onAuthStateChange) çağrılır — bir
// hesap başka bir cihazda renk paleti seçmişse, bu cihaza girildiğinde de aynı palet
// uygulansın diye. profiles'ta light_palette/dark_palette NULL ise (hiç seçim
// yapılmamışsa) yerel varsayılana dokunmuyoruz.
export async function applyCloudPaletteIfNeeded(session: Session | null): Promise<void> {
  if (!session) return;
  try {
    const profile = await getProfile(session.user.id);
    if (!profile) return;
    const { setLightPalette, setDarkPalette } = useSettingsStore.getState();
    if (isPaletteKey(profile.light_palette)) setLightPalette(profile.light_palette);
    if (isPaletteKey(profile.dark_palette)) setDarkPalette(profile.dark_palette);
  } catch (error) {
    console.error('Bulut renk paleti uygulanamadı:', error);
  }
}
