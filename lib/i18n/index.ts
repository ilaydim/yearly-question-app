import { tr } from './tr';
import { en } from './en';
import { useSettingsStore } from '../store/settingsStore';

export type Dictionary = typeof tr;

const dictionaries = { tr, en };

export function useT(): Dictionary {
  const language = useSettingsStore((s) => s.language);
  return dictionaries[language];
}
