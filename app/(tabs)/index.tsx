import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getAllEntries } from '../../lib/db/entries';
import { getAllCategories } from '../../lib/db/categories';
import { getPhotoMap } from '../../lib/db/photos';
import { initDatabase } from '../../lib/db/init';
import type { Category, Entry } from '../../lib/db/types';

export default function HomeScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      await initDatabase();
      const [entryRows, categoryRows, photoMap] = await Promise.all([
        getAllEntries(),
        getAllCategories(),
        getPhotoMap(),
      ]);
      setEntries(entryRows);
      setCategories(Object.fromEntries(categoryRows.map((c) => [c.id, c])));
      setPhotos(photoMap);
    } catch (error) {
      console.error('Girişler yüklenemedi:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Henüz bir kaydın yok</Text>}
        renderItem={({ item }) => {
          const category = categories[item.category_id];
          const photoUri = photos[item.id];
          return (
            <Pressable style={styles.row} onPress={() => router.push(`/entry/${item.id}`)}>
              {photoUri && <Image source={{ uri: photoUri }} style={styles.thumbnail} />}
              <View style={styles.rowBody}>
                <View style={styles.rowHeader}>
                  <Text style={styles.date}>{item.date}</Text>
                  {item.mood && <Text style={styles.mood}>{item.mood}</Text>}
                </View>
                <Text style={styles.preview} numberOfLines={2}>
                  {item.content.slice(0, 60)}
                </Text>
                {category && (
                  <View style={styles.categoryTag}>
                    <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                    <Text style={styles.categoryName}>{category.name}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />
      <Pressable style={styles.fab} onPress={() => router.push('/entry/new')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  list: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    textAlign: 'center',
    marginTop: 80,
    color: '#888',
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F7F7FA',
    gap: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  rowBody: {
    flex: 1,
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  mood: {
    fontSize: 18,
  },
  preview: {
    fontSize: 15,
    color: '#222',
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    fontSize: 12,
    color: '#666',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: {
    color: '#FFF',
    fontSize: 28,
    lineHeight: 30,
  },
});
