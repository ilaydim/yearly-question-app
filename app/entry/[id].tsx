import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import EntryForm from '../../components/EntryForm';
import type { LocationValue } from '../../components/LocationPicker';
import { deleteEntry, getEntryById, updateEntry } from '../../lib/db/entries';
import { getAllCategories } from '../../lib/db/categories';
import { addPhoto, deletePhoto, getPhotosByEntryId } from '../../lib/db/photos';
import { initDatabase, TRIP_CATEGORY_ID } from '../../lib/db/init';
import { toDateString } from '../../lib/date';
import { useTheme } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { useAuthStore } from '../../lib/store/authStore';
import { deleteEntryFromCloud } from '../../lib/supabase/backup';
import type { Category } from '../../lib/db/types';

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const session = useAuthStore((s) => s.session);
  const [categories, setCategories] = useState<Category[]>([]);
  const [date, setDate] = useState(new Date());
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [originalPhotoId, setOriginalPhotoId] = useState<string | null>(null);
  const [originalPhotoPath, setOriginalPhotoPath] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationValue | null>(null);
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
            setLocation(
              entry.latitude != null && entry.longitude != null
                ? {
                    latitude: entry.latitude,
                    longitude: entry.longitude,
                    locationName: entry.location_name,
                    country: entry.country,
                  }
                : null
            );
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
    const isTrip = categoryId === TRIP_CATEGORY_ID;
    try {
      await updateEntry(id, {
        date: toDateString(date),
        content: content.trim(),
        mood,
        category_id: categoryId,
        latitude: isTrip ? (location?.latitude ?? null) : null,
        longitude: isTrip ? (location?.longitude ?? null) : null,
        location_name: isTrip ? (location?.locationName ?? null) : null,
        country: isTrip ? (location?.country ?? null) : null,
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
    Alert.alert(t.entryDetail.deleteConfirmTitle, t.entryDetail.deleteConfirmMessage, [
      { text: t.entryDetail.cancel, style: 'cancel' },
      {
        text: t.entryDetail.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEntry(id);
            router.back();
          } catch (error) {
            console.error('Giriş silinemedi:', error);
            return;
          }
          // Local silme zaten tamamlandı ve ekran kapandı; bulut senkronu arkada,
          // beklenmeden (best-effort) tetikleniyor — deleteEntryFromCloud kendi
          // içinde tüm hataları yutuyor, burada UI'yi bloklamamak için await edilmiyor.
          if (session) {
            void deleteEntryFromCloud(session.user.id, id);
          }
        },
      },
    ]);
  };

  if (!loaded) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
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
        submitLabel={t.entryDetail.update}
      />
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push(`/share-entry?id=${id}`)}
        >
          <Text style={[styles.actionText, { color: colors.text }]}>{t.entryDetail.share}</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.dangerSoft }]}
          onPress={handleDelete}
        >
          <Text style={[styles.actionText, { color: colors.danger }]}>{t.entryDetail.delete}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    margin: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
