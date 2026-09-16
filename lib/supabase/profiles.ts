import { File } from 'expo-file-system';
import { supabase, isSupabaseConfigured } from './client';

export const PROFILES_NOT_CONFIGURED = 'PROFILES_NOT_CONFIGURED';
const AVATAR_BUCKET = 'avatars';

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  gender: string | null;
  light_palette: string | null;
  dark_palette: string | null;
  updated_at: string;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) throw new Error(PROFILES_NOT_CONFIGURED);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Sign-up trigger'ı satırı zaten oluşturuyor; upsert sadece o satır bir şekilde
// yoksa (ör. trigger migration'dan önce açılmış hesap) diye bir güvenlik ağı.
export async function updateProfile(
  userId: string,
  updates: {
    name?: string | null;
    avatar_url?: string | null;
    birth_date?: string | null;
    gender?: string | null;
    light_palette?: string | null;
    dark_palette?: string | null;
  }
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(PROFILES_NOT_CONFIGURED);
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

// Sabit dosya adı ({user_id}/avatar.jpg) kasıtlı: storage RLS policy'si klasör adının
// auth.uid() ile eşleşmesini kontrol ediyor, dosya adı önemli değil. Aynı yola upsert
// yapıldığı için public URL değişmez; istemci tarafında eski görseli önbellekten
// göstermemesi için dönen URL'e bir cache-busting query param ekliyoruz.
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  if (!isSupabaseConfigured) throw new Error(PROFILES_NOT_CONFIGURED);
  const file = new File(localUri);
  const arrayBuffer = await file.arrayBuffer();
  const path = `${userId}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
