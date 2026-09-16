import { getDatabase } from './init';
import { generateId } from './id';
import { toDateString } from '../date';
import { getDictionary } from '../i18n';
import { scheduleFutureLetterNotification, cancelScheduledNotification } from '../notifications';

export interface FutureLetter {
  id: string;
  content: string;
  unlock_date: string; // 'YYYY-MM-DD'
  created_at: string;
  notification_id: string | null;
}

// Bildirim, günlük hatırlatıcıyla (kullanıcının kendi seçtiği bir saat) çakışmaması
// için sabit, makul bir sabah saatinde tetikleniyor.
const UNLOCK_NOTIFICATION_HOUR = 9;

function notificationTriggerFor(unlockDate: Date): Date {
  const trigger = new Date(unlockDate);
  trigger.setHours(UNLOCK_NOTIFICATION_HOUR, 0, 0, 0);
  return trigger;
}

// Kronolojik (açılış tarihine göre artan) — UI bunu aktif/açılmış diye ikiye ayırır.
export async function getAllLetters(): Promise<FutureLetter[]> {
  const database = await getDatabase();
  return database.getAllAsync<FutureLetter>('SELECT * FROM future_letters ORDER BY unlock_date ASC');
}

// "Aktif" = unlock_date bugünden büyük, yani henüz açılmamış. Free limit kontrolü
// (en fazla 1 aktif mektup) bunu kullanır.
export async function getActiveLetterCount(): Promise<number> {
  const database = await getDatabase();
  const today = toDateString(new Date());
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM future_letters WHERE unlock_date > ?',
    today
  );
  return row?.count ?? 0;
}

// unlockDate: saat kısmı önemsiz, sadece gün alınır (bkz. toDateString) — bildirim
// için ayrıca sabit bir saatte (UNLOCK_NOTIFICATION_HOUR) tetiklenecek şekilde
// zamanlanıyor. Bildirim metni getDictionary() ile o an aktif dile göre alınıyor
// (bu bir React render'ı değil, dictionary'i doğrudan store'dan okuyoruz).
export async function createLetter(content: string, unlockDate: Date): Promise<FutureLetter> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Mektup içeriği boş olamaz.');

  const t = getDictionary();
  const notificationId = await scheduleFutureLetterNotification(notificationTriggerFor(unlockDate), {
    title: t.futureLetters.notificationTitle,
    body: t.futureLetters.notificationBody,
  });

  const letter: FutureLetter = {
    id: generateId(),
    content: trimmed,
    unlock_date: toDateString(unlockDate),
    created_at: new Date().toISOString(),
    notification_id: notificationId,
  };

  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO future_letters (id, content, unlock_date, created_at, notification_id) VALUES (?, ?, ?, ?, ?)',
    letter.id,
    letter.content,
    letter.unlock_date,
    letter.created_at,
    letter.notification_id
  );
  return letter;
}

// Sadece henüz açılmamış (unlock_date > bugün) bir mektup silinebilir — açılmış bir
// mektup artık kalıcı bir kayıt, UI zaten ona silme seçeneği göstermiyor, bu sadece
// bir güvenlik ağı. Bildirimi de (varsa) iptal ediyoruz.
export async function deleteLetter(id: string): Promise<void> {
  const database = await getDatabase();
  const letter = await database.getFirstAsync<FutureLetter>(
    'SELECT * FROM future_letters WHERE id = ?',
    id
  );
  if (!letter) return;

  const today = toDateString(new Date());
  if (letter.unlock_date <= today) {
    throw new Error('Açılmış bir mektup silinemez.');
  }

  if (letter.notification_id) {
    await cancelScheduledNotification(letter.notification_id);
  }
  await database.runAsync('DELETE FROM future_letters WHERE id = ?', id);
}

// lib/supabase/backup.ts'in tam-karşılaştırmalı senkronu (syncFutureLetters) buluttan
// bu cihazda olmayan bir satır bulduğunda çağırır. Bulut şeması notification_id
// tutmuyor (bkz. migration — cihaza özgü bir alan, senkronlanmaz), bu yüzden hâlâ
// açılmamış bir mektup başka bir cihazdan geliyorsa BU cihaz için de yerel bir
// bildirim kuruyoruz; aksi halde bu cihaz o mektup açıldığında hiç haberdar olmazdı.
export async function insertLetterIfMissing(
  letter: Omit<FutureLetter, 'notification_id'>
): Promise<boolean> {
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM future_letters WHERE id = ?',
    letter.id
  );
  if (existing) return false;

  const today = toDateString(new Date());
  let notificationId: string | null = null;
  if (letter.unlock_date > today) {
    const t = getDictionary();
    notificationId = await scheduleFutureLetterNotification(
      notificationTriggerFor(new Date(`${letter.unlock_date}T00:00:00`)),
      { title: t.futureLetters.notificationTitle, body: t.futureLetters.notificationBody }
    );
  }

  await database.runAsync(
    'INSERT INTO future_letters (id, content, unlock_date, created_at, notification_id) VALUES (?, ?, ?, ?, ?)',
    letter.id,
    letter.content,
    letter.unlock_date,
    letter.created_at,
    notificationId
  );
  return true;
}

// Hesap silme akışında (lib/supabase/account.ts) yerel veri toptan silinmeden ÖNCE
// çağrılır — aksi halde bu cihazdaki zamanlanmış bildirimler, artık var olmayan bir
// mektuba işaret ederek OS'ta asılı kalırdı.
export async function cancelAllLetterNotifications(): Promise<void> {
  const database = await getDatabase();
  const letters = await database.getAllAsync<{ notification_id: string | null }>(
    'SELECT notification_id FROM future_letters WHERE notification_id IS NOT NULL'
  );
  await Promise.all(
    letters
      .map((l) => l.notification_id)
      .filter((id): id is string => !!id)
      .map((id) => cancelScheduledNotification(id))
  );
}
