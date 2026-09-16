import { tr } from './tr';
import { en } from './en';
import { useSettingsStore } from '../store/settingsStore';

export type Dictionary = typeof tr;

const dictionaries = { tr, en };

export function useT(): Dictionary {
  const language = useSettingsStore((s) => s.language);
  return dictionaries[language];
}

// useT() bir hook — React render'ı dışında (lib/db/futureLetters.ts'in bildirim
// metni için, lib/supabase/backup.ts'in arka plan senkronu için) dictionary'e
// erişmek gerektiğinde bunun yerine kullanılır.
export function getDictionary(): Dictionary {
  return dictionaries[useSettingsStore.getState().language];
}
