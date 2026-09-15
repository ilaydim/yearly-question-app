import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BackupFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

export const FREQUENCY_MS: Record<BackupFrequency, number | null> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  manual: null,
};

interface BackupState {
  enabled: boolean;
  frequency: BackupFrequency;
  // Kullanıcıya gösterilen "son yedekleme" zamanı (her denemede güncellenir, kısmi
  // başarıda da) — otomatik yedeklemenin sıklık kontrolü için kullanılır.
  lastBackupAt: string | null;
  // WHERE updated_at > syncCursor sorgusunun kesme noktası — sadece gerçekten bulutta
  // onaylanan satırlar kadar ilerler (runBackup'taki newCursor mantığına bkz.).
  syncCursor: string | null;
  hasPromptedRestore: boolean;
  setEnabled: (enabled: boolean) => void;
  setFrequency: (frequency: BackupFrequency) => void;
  recordBackupAttempt: (syncCursor: string) => void;
  setHasPromptedRestore: (value: boolean) => void;
}

export const useBackupStore = create<BackupState>()(
  persist(
    (set) => ({
      enabled: false,
      frequency: 'weekly',
      lastBackupAt: null,
      syncCursor: null,
      hasPromptedRestore: false,
      setEnabled: (enabled) => set({ enabled }),
      setFrequency: (frequency) => set({ frequency }),
      recordBackupAttempt: (syncCursor) =>
        set({ syncCursor, lastBackupAt: new Date().toISOString() }),
      setHasPromptedRestore: (hasPromptedRestore) => set({ hasPromptedRestore }),
    }),
    {
      name: 'backup-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
