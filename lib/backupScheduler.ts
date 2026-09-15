import type { Session } from '@supabase/supabase-js';
import { initDatabase } from './db/init';
import { runBackup } from './supabase/backup';
import { FREQUENCY_MS, useBackupStore } from './store/backupStore';

// App açılışında/foreground'a geçince çağrılır. Sessizce çalışır — kullanıcıya sadece
// "Şimdi Yedekle" manuel tetiklemesi sonuç gösterir, bu arka plan denemesi göstermez.
export async function maybeRunBackup(session: Session | null): Promise<void> {
  if (!session) return;

  const { enabled, frequency, lastBackupAt, syncCursor, recordBackupAttempt } =
    useBackupStore.getState();
  if (!enabled) return;

  const intervalMs = FREQUENCY_MS[frequency];
  if (intervalMs === null) return; // "Sadece manuel"

  const lastAttempt = lastBackupAt ? new Date(lastBackupAt).getTime() : 0;
  if (Date.now() - lastAttempt < intervalMs) return;

  try {
    await initDatabase();
    const result = await runBackup(session.user.id, syncCursor);
    recordBackupAttempt(result.newCursor);
  } catch (error) {
    console.error('Otomatik yedekleme başarısız:', error);
  }
}
