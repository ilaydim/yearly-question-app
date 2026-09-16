import type { Session } from '@supabase/supabase-js';
import { usePendingProfileStore } from './store/pendingProfileStore';
import { updateProfile } from './supabase/profiles';

// signUpWithEmail sırasında toplanan ad/doğum tarihi/cinsiyet bilgisi, e-posta
// doğrulaması bekleniyorsa (kayıt anında hemen bir session oluşmuyorsa) henüz bir
// user id olmadığından profiles'a yazılamıyor — bu yüzden geçici olarak
// pendingProfileStore'da (AsyncStorage, kalıcı) bekliyor.
//
// Bu fonksiyon authStore'daki HER session değişiminde (açılıştaki ilk kontrol +
// onAuthStateChange'in her tetiklenişi) çağrılıyor: session varsa ve bekleyen bir
// kayıt varsa profiles'a yazıp local'den temizliyor. Böylece kullanıcı e-postasını
// doğrulayıp ilk kez gerçekten giriş yaptığı an (session oluştuğu an) bu bilgi
// otomatik işleniyor — hangi ekrandan/hangi akıştan giriş yaptığı önemli değil.
export async function applyPendingProfileIfNeeded(session: Session | null): Promise<void> {
  if (!session) return;
  const pending = usePendingProfileStore.getState().pending;
  if (!pending) return;

  try {
    await updateProfile(session.user.id, {
      name: pending.name,
      birth_date: pending.birthDate,
      gender: pending.gender,
    });
    usePendingProfileStore.getState().setPending(null);
  } catch (error) {
    // Kasıtlı olarak temizlemiyoruz: sessizce kaybolmasın, bir sonraki session
    // değişiminde (bir sonraki açılış ya da giriş) otomatik tekrar denenecek.
    console.error(
      'Bekleyen profil bilgisi uygulanamadı, bir sonraki girişte tekrar denenecek:',
      error
    );
  }
}
