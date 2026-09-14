import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import EntryForm from '../../components/EntryForm';
import { deleteEntry, getEntryById, updateEntry } from '../../lib/db/entries';
import { getAllCategories } from '../../lib/db/categories';
import { addPhoto, deletePhoto, getPhotosByEntryId } from '../../lib/db/photos';
import { initDatabase } from '../../lib/db/init';
import { toDateString } from '../../lib/date';
import type { Category } from '../../lib/db/types';

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [date, setDate] = useState(new Date());
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [originalPhotoId, setOriginalPhotoId] = useState<string | null>(null);
  const [originalPhotoPath, setOriginalPhotoPath] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          await initDatabase();
          const [entry, categoryRows, photos] = await Promise.all([
            getEntryById(id),
            getAllCategories(),
            getPhotosByEntryId(id),
          ]);
          setCategories(categoryRows);
          if (entry) {
            setDate(new Date(entry.date));
            setContent(entry.content);
            setMood(entry.mood);
            setCategoryId(entry.category_id);
          }
          setPhotoPath(photos[0]?.file_path ?? null);
          setOriginalPhotoId(photos[0]?.id ?? null);
          setOriginalPhotoPath(photos[0]?.file_path ?? null);
        } catch (error) {
          console.error('Giriş yüklenemedi:', error);
        } finally {
          setLoaded(true);
        }
      })();
    }, [id])
  );

  const handleSubmit = async () => {
    if (!content.trim() || !categoryId) return;
    try {
      await updateEntry(id, {
        date: toDateString(date),
        content: content.trim(),
        mood,
        category_id: categoryId,
      });
      if (photoPath !== originalPhotoPath) {
        if (originalPhotoId) await deletePhoto(originalPhotoId);
        if (photoPath) await addPhoto(id, photoPath);
      }
      router.back();
    } catch (error) {
      console.error('Giriş güncellenemedi:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert('Girişi Sil', 'Bu girişi silmek istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEntry(id);
            router.back();
          } catch (error) {
            console.error('Giriş silinemedi:', error);
          }
        },
      },
    ]);
  };

  if (!loaded) return null;

  return (
    <View style={styles.container}>
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
        onSubmit={handleSubmit}
        submitLabel="Güncelle"
      />
      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteText}>Sil</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  deleteButton: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
  },
  deleteText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '700',
  },
});
