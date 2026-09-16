import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { initDatabase } from '../lib/db/init';
import { getAllCategories } from '../lib/db/categories';
import { searchEntries } from '../lib/db/entries';
import { buildSearchSnippet } from '../lib/search';
import type { Category, Entry } from '../lib/db/types';

const DEBOUNCE_MS = 300;

export default function SearchScreen() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, Category>>({});
  const [results, setResults] = useState<Entry[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        const rows = await getAllCategories();
        setCategories(rows);
        setCategoryMap(Object.fromEntries(rows.map((c) => [c.id, c])));
      } catch (error) {
        console.error('Kategoriler yüklenemedi:', error);
      }
    })();
  }, []);

  // Metin girişi 300ms debounce edilir; kategori seçimi debouncedQuery'ye değil doğrudan
  // query'nin kendisine bağlı olmayan ayrı bir state olduğu için aşağıdaki arama effect'i
  // kategori değiştiğinde beklemeden hemen tetiklenir.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    (async () => {
      if (!debouncedQuery.trim() && selectedCategoryIds.length === 0) {
        setResults([]);
        setSearched(false);
        return;
      }
      try {
        const rows = await searchEntries(debouncedQuery, selectedCategoryIds);
        setResults(rows);
        setSearched(true);
      } catch (error) {
        console.error('Arama başarısız:', error);
      }
    })();
  }, [debouncedQuery, selectedCategoryIds]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <Screen colors={colors} edges={['bottom']}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.subtext} style={styles.searchIcon} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={t.search.placeholder}
          placeholderTextColor={colors.subtext}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
      </View>

      {categories.length > 0 && (
        <View style={styles.chipsRow}>
          {categories.map((category) => {
            const selected = selectedCategoryIds.includes(category.id);
            return (
              <Pressable
                key={category.id}
                style={[
                  styles.chip,
                  { borderColor: category.color },
                  selected && { backgroundColor: category.color },
                ]}
                onPress={() => toggleCategory(category.id)}
              >
                <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.text }]}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          searched ? (
            <Text style={[styles.empty, { color: colors.subtext }]}>{t.search.noResults}</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const category = item.category_id ? categoryMap[item.category_id] : undefined;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={() => router.push(`/entry/${item.id}`)}
            >
              <View style={styles.rowHeader}>
                <Text style={[styles.date, { color: colors.subtext }]}>{item.date}</Text>
                {category && (
                  <View style={[styles.badge, { backgroundColor: category.color }]}>
                    <Text style={styles.badgeText}>{category.name}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.snippet, { color: colors.text }]} numberOfLines={2}>
                {buildSearchSnippet(item.content, debouncedQuery)}
              </Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#00000010',
    gap: 8,
  },
  searchIcon: {
    marginTop: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  row: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  snippet: {
    fontSize: 14,
    lineHeight: 19,
  },
  empty: {
    flex: 1,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
});
