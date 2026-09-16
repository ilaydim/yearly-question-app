import { supabase, isSupabaseConfigured } from './client';
import { deleteAllLocalData } from '../db/init';
import { cancelAllLetterNotifications } from '../db/futureLetters';
import { usePinLockStore } from '../store/pinLockStore';
import { useCloudProfileStore } from '../store/cloudProfileStore';
import { useBackupStore } from '../store/backupStore';
import { clearPin } from '../security/pin';

export const ACCOUNT_NOT_CONFIGURED = 'ACCOUNT_NOT_CONFIGURED';

// Storage bucket'larında delete_own_account() RPC'sinin ERİŞEMEDİĞİ dosyalar var
// (o fonksiyon sadece veritabanı satırlarından sorumlu) — bu yüzden RPC'den ÖNCE,
// istemci tarafında, kullanıcının kendi klasöründeki (userId/) tüm dosyaları temizliyoruz.
async function removeAllUserFiles(bucket: string, userId: string): Promise<void> {
  const { data, error } = await supabase.storage.from(bucket).list(userId);
  if (error) throw error;
  if (!data || data.length === 0) return;

  const paths = data.map((file) => `${userId}/${file.name}`);
  const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
  if (removeError) throw removeError;
}

// Sıra kasıtlı: önce storage dosyaları (RPC'nin sorumluluğu dışında), sonra
// veritabanı satırları + auth kullanıcısı (RPC), sonra yerel SQLite verisi, en son
// da bu cihazdaki hesap-bazlı yerel durum (PIN, bulut profili önbelleği, yedekleme
// sayaçları) — herhangi bir adım yarıda kesilirse (network hatası vb.) kullanıcı hâlâ
// giriş yapabilir durumda kalır, hiçbir şey sessizce "yarım silinmiş" bir halde asılı kalmaz.
export async function deleteOwnAccount(userId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(ACCOUNT_NOT_CONFIGURED);

  await removeAllUserFiles('avatars', userId);
  await removeAllUserFiles('journal-photos', userId);

  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;

  await cancelAllLetterNotifications();
  await deleteAllLocalData();

  if (usePinLockStore.getState().pinEnabled) {
    await clearPin();
    usePinLockStore.getState().setPinEnabled(false);
    usePinLockStore.getState().setLocked(false);
  }
  useCloudProfileStore.getState().setProfile(null);
  useBackupStore.setState({
    enabled: false,
    lastBackupAt: null,
    syncCursor: null,
    hasPromptedRestore: false,
  });

  // auth.users satırı RPC içinde zaten silindi; signOut burada sadece yerel
  // session/token'ı temizlemek için — sunucu tarafı best-effort, başarısız olsa da
  // yerel oturum zaten geçersiz bir hesaba ait olduğu için sorun teşkil etmez.
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Hesap silindikten sonra oturum kapatılamadı (göz ardı edildi):', error);
  }
}
