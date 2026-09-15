import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import EntryForm from '../../components/EntryForm';
import type { LocationValue } from '../../components/LocationPicker';
import { createEntry } from '../../lib/db/entries';
import { getAllCategories } from '../../lib/db/categories';
import { initDatabase, TRIP_CATEGORY_ID } from '../../lib/db/init';
import { generateId } from '../../lib/db/id';
import { addPhoto } from '../../lib/db/photos';
import { toDateString } from '../../lib/date';
import { useT } from '../../lib/i18n';
import type { Category } from '../../lib/db/types';

export default function NewEntryScreen() {
  const router = useRouter();
  const t = useT();
  const [categories, setCategories] = useState<Category[]>([]);
  const [date, setDate] = useState(new Date());
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationValue | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        const rows = await getAllCategories();
        setCategories(rows);
        if (rows.length > 0) setCategoryId(rows[0].id);
      } catch (error) {
        console.error('Kategoriler yüklenemedi:', error);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!content.trim() || !categoryId) return;
    const now = new Date().toISOString();
    const entryId = generateId();
    // Konum sadece "trip" kategorisinde anlamlı — kullanıcı konum ekleyip sonra
    // kategoriyi değiştirirse eski konum burada kaydedilmesin diye kategoriye göre süzüyoruz.
    const isTrip = categoryId === TRIP_CATEGORY_ID;
    try {
      await createEntry({
        id: entryId,
        date: toDateString(date),
        content: content.trim(),
        mood,
        category_id: categoryId,
        question_id: null,
        created_at: now,
        updated_at: now,
        latitude: isTrip ? (location?.latitude ?? null) : null,
        longitude: isTrip ? (location?.longitude ?? null) : null,
        location_name: isTrip ? (location?.locationName ?? null) : null,
        country: isTrip ? (location?.country ?? null) : null,
      });
      if (photoPath) await addPhoto(entryId, photoPath);
      router.back();
    } catch (error) {
      console.error('Giriş kaydedilemedi:', error);
    }
  };

  return (
    <EntryForm
      date={date}
      onChangeDate={setDate}
      content={content}
      onChangeContent={setContent}
      mood={mood}
      onChangeMood={setMood}
      categories={categories}
      categoryId={categoryId}
      onChangeCategoryId={setCategoryId}
      photoPath={photoPath}
      onChangePhotoPath={setPhotoPath}
      location={location}
      onChangeLocation={setLocation}
      onSubmit={handleSubmit}
      submitLabel={t.entryNew.save}
    />
  );
}
