import { getDatabase } from './init';
import { generateId } from './id';
import { getCurrentPeriodKey, type GoalListType } from '../goalPeriods';

export interface GoalItem {
  id: string;
  list_type: GoalListType;
  period_key: string;
  title: string;
  is_completed: 0 | 1;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface ArchivedPeriodSummary {
  period_key: string;
  completed_count: number;
  missed_count: number;
}

// Tamamlanmamışlar üstte (eklenme sırasına göre), tamamlananlar altta (en son
// tamamlanan en üstte) — someday_list'teki aynı desen (bkz. lib/db/somedayList.ts).
export async function getItemsForPeriod(listType: GoalListType, periodKey: string): Promise<GoalItem[]> {
  const database = await getDatabase();
  const [incomplete, completed] = await Promise.all([
    database.getAllAsync<GoalItem>(
      'SELECT * FROM goal_items WHERE list_type = ? AND period_key = ? AND is_completed = 0 ORDER BY created_at ASC',
      listType,
      periodKey
    ),
    database.getAllAsync<GoalItem>(
      'SELECT * FROM goal_items WHERE list_type = ? AND period_key = ? AND is_completed = 1 ORDER BY completed_at DESC',
      listType,
      periodKey
    ),
  ]);
  return [...incomplete, ...completed];
}

export async function getCurrentItems(listType: GoalListType): Promise<GoalItem[]> {
  return getItemsForPeriod(listType, getCurrentPeriodKey(listType));
}

// Geçmiş periyotların özeti: GÜNCEL periyot hariç, her period_key için tek bir satır
// (tamamlanan/kaçırılan sayısı). Ayrı bir "rollover" adımı yok — bir periyot, period_key'i
// artık getCurrentPeriodKey ile eşleşmediği an kendiliğinden burada "geçmiş" sayılır.
export async function getArchivedPeriods(listType: GoalListType): Promise<ArchivedPeriodSummary[]> {
  const database = await getDatabase();
  const currentPeriodKey = getCurrentPeriodKey(listType);
  return database.getAllAsync<ArchivedPeriodSummary>(
    `SELECT period_key,
            SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_count,
            SUM(CASE WHEN is_completed = 0 THEN 1 ELSE 0 END) as missed_count
     FROM goal_items
     WHERE list_type = ? AND period_key != ?
     GROUP BY period_key
     ORDER BY period_key DESC`,
    listType,
    currentPeriodKey
  );
}

export async function addItem(listType: GoalListType, title: string): Promise<GoalItem> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Başlık boş olamaz.');

  const now = new Date().toISOString();
  const item: GoalItem = {
    id: generateId(),
    list_type: listType,
    period_key: getCurrentPeriodKey(listType),
    title: trimmed,
    is_completed: 0,
    created_at: now,
    completed_at: null,
    updated_at: now,
  };

  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO goal_items (id, list_type, period_key, title, is_completed, created_at, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.list_type,
    item.period_key,
    item.title,
    item.is_completed,
    item.created_at,
    item.completed_at,
    item.updated_at
  );
  return item;
}

// Sadece GÜNCEL periyottaki bir madde işaretlenebilir/işareti kaldırılabilir — geçmiş
// periyotlar (bkz. getArchivedPeriods) salt okunur bir arşiv, oradaki "Kaçırıldı"/
// "Tamamlandı" durumu donmuş kalmalı.
export async function toggleItem(id: string): Promise<void> {
  const database = await getDatabase();
  const item = await database.getFirstAsync<GoalItem>('SELECT * FROM goal_items WHERE id = ?', id);
  if (!item || item.period_key !== getCurrentPeriodKey(item.list_type)) return;

  const now = new Date().toISOString();
  if (item.is_completed === 1) {
    await database.runAsync(
      'UPDATE goal_items SET is_completed = 0, completed_at = NULL, updated_at = ? WHERE id = ?',
      now,
      id
    );
  } else {
    await database.runAsync(
      'UPDATE goal_items SET is_completed = 1, completed_at = ?, updated_at = ? WHERE id = ?',
      now,
      now,
      id
    );
  }
}

// Sadece GÜNCEL periyottaki bir madde silinebilir — geçmiş periyotlar kalıcı bir
// kayıt, silinerek bozulmamalı (kullanıcının istediği kısıtlama budur).
export async function deleteItem(id: string): Promise<void> {
  const database = await getDatabase();
  const item = await database.getFirstAsync<GoalItem>('SELECT * FROM goal_items WHERE id = ?', id);
  if (!item || item.period_key !== getCurrentPeriodKey(item.list_type)) return;
  await database.runAsync('DELETE FROM goal_items WHERE id = ?', id);
}

// lib/supabase/backup.ts'in syncGoals'u için: TÜM periyotlardaki (güncel + arşiv)
// maddeler — cursor'suz tam karşılaştırma yapıyor (bkz. syncYearWords ile aynı desen),
// sadece güncel periyodu değil geçmişi de senkronlamak gerekiyor.
export async function getAllItems(): Promise<GoalItem[]> {
  const database = await getDatabase();
  return database.getAllAsync<GoalItem>('SELECT * FROM goal_items ORDER BY created_at ASC');
}

// syncGoals, hangi tarafın (yerel/bulut) daha yeni olduğuna updated_at'e bakarak KENDİSİ
// karar veriyor (year_words'teki gibi) — bu fonksiyon sadece "pull" tarafı için, kararı
// verilmiş bir satırı yerele koşulsuz yazan bir upsert.
export async function upsertFromCloud(row: GoalItem): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO goal_items (id, list_type, period_key, title, is_completed, created_at, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       list_type = excluded.list_type,
       period_key = excluded.period_key,
       title = excluded.title,
       is_completed = excluded.is_completed,
       completed_at = excluded.completed_at,
       updated_at = excluded.updated_at`,
    row.id,
    row.list_type,
    row.period_key,
    row.title,
    row.is_completed,
    row.created_at,
    row.completed_at,
    row.updated_at
  );
}
