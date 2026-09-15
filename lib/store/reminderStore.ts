import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ReminderState {
  enabled: boolean;
  hour: number;
  minute: number;
  hasPromptedPermission: boolean;
  setEnabled: (enabled: boolean) => void;
  setTime: (hour: number, minute: number) => void;
  setHasPromptedPermission: (value: boolean) => void;
}

export const useReminderStore = create<ReminderState>()(
  persist(
    (set) => ({
      enabled: false,
      hour: 21,
      minute: 0,
      hasPromptedPermission: false,
      setEnabled: (enabled) => set({ enabled }),
      setTime: (hour, minute) => set({ hour, minute }),
      setHasPromptedPermission: (hasPromptedPermission) => set({ hasPromptedPermission }),
    }),
    {
      name: 'reminder-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
