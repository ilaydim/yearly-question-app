import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import EntryForm from '../../components/EntryForm';
import type { LocationValue } from '../../components/LocationPicker';
import { createEntry } from '../../lib/db/entries';
import { getAllCategories } from '../../lib/db/categories';
import { initDatabase } from '../../lib/db/init';
import { generateId } from '../../lib/db/id';
import { addPhoto } from '../../lib/db/photos';
import { toDateString } from '../../lib/date';
import { useT } from '../../lib/i18n';
import type { Category } from '../../lib/db/types';

function parseDateParam(value?: string): Date {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

export default function NewEntryScreen() {
  const router = useRouter();
  const t = useT();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [date, setDate] = useState(() => parseDateParam(dateParam));
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
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        location_name: location?.locationName ?? null,
        country: location?.country ?? null,
        capsule_year: null,
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
