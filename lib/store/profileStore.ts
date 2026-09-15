import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ProfileState {
  displayName: string | null;
  avatarUri: string | null;
  setDisplayName: (name: string | null) => void;
  setAvatarUri: (uri: string | null) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      displayName: null,
      avatarUri: null,
      setDisplayName: (displayName) => set({ displayName }),
      setAvatarUri: (avatarUri) => set({ avatarUri }),
    }),
    {
      name: 'profile-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
