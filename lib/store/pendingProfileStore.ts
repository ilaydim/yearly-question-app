import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Gender } from '../gender';

export interface PendingProfileInfo {
  name: string;
  birthDate: string; // 'YYYY-MM-DD'
  gender: Gender | null;
}

interface PendingProfileState {
  pending: PendingProfileInfo | null;
  setPending: (info: PendingProfileInfo | null) => void;
}

// Kayıt sırasında (signUpWithEmail) e-posta doğrulaması bekleniyorsa henüz bir
// session/user id yok, bu yüzden profiles'a hemen yazamıyoruz — toplanan bilgi
// kullanıcı e-postasını doğrulayıp ilk kez giriş yapana kadar burada bekliyor
// (bkz. lib/pendingProfile.ts). Persist edilmesi bilerek: uygulama kapanıp
// açılsa bile (e-posta doğrulaması dakikalar/saatler sürebilir) kaybolmamalı.
export const usePendingProfileStore = create<PendingProfileState>()(
  persist(
    (set) => ({
      pending: null,
      setPending: (pending) => set({ pending }),
    }),
    {
      name: 'pending-profile-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
