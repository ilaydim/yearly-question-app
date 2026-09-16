import { useEffect } from 'react';
import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { getProfile } from '../supabase/profiles';

export interface CloudProfile {
  name: string | null;
  avatarUrl: string | null;
  birthDate: string | null;
  gender: string | null;
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

// Ana Sayfa (kişiselleştirilmiş başlık için) ve Profil ekranı ikisi de bu store'u
// dolduruyor — tek bir yerde tutmazsak biri diğerinden önce mount olduğunda isim
// eksik/eski kalır. Her ikisi de bu hook'u çağırıyor; oturum aynıysa ikinci çağrı
// zararsız bir no-op'a yakın (aynı satırı tekrar çeker).
export function useSyncCloudProfile(): void {
  const session = useAuthStore((s) => s.session);
  const setProfile = useCloudProfileStore((s) => s.setProfile);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    getProfile(session.user.id)
      .then((profile) =>
        setProfile({
          name: profile?.name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          birthDate: profile?.birth_date ?? null,
          gender: profile?.gender ?? null,
        })
      )
      .catch((error) => console.error('Profil yüklenemedi:', error));
  }, [session, setProfile]);
}
