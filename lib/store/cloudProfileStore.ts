import { create } from 'zustand';

export interface CloudProfile {
  name: string | null;
  avatarUrl: string | null;
}

interface CloudProfileState {
  profile: CloudProfile | null;
  loading: boolean;
  setProfile: (profile: CloudProfile | null) => void;
  setLoading: (loading: boolean) => void;
}

// Bilerek persist edilmiyor: hesap bazlı veri, cihazda kalıcı önbelleklenirse
// çıkış yapıp başka bir hesapla giriş yapan biri önceki kullanıcının adını/fotoğrafını
// görebilir. Oturum değiştikçe Profile ekranı bu store'u Supabase'den yeniden doldurur.
export const useCloudProfileStore = create<CloudProfileState>((set) => ({
  profile: null,
  loading: false,
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
}));
