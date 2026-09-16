import { useCallback, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import PenWritingAnimation from '../../components/PenWritingAnimation';
import EntryRow from '../../components/EntryRow';
import OnThisDayCarousel from '../../components/OnThisDayCarousel';
import EntryPreviewModal from '../../components/EntryPreviewModal';
import { getAllEntries, getEntriesForMonthDay } from '../../lib/db/entries';
import { getAllCategories } from '../../lib/db/categories';
import { getPhotoMap } from '../../lib/db/photos';
import { getQuestionForDate } from '../../lib/db/questions';
import { initDatabase } from '../../lib/db/init';
import { toDateString } from '../../lib/date';
import { useTheme } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { useSettingsStore } from '../../lib/store/settingsStore';
import { useAuthStore } from '../../lib/store/authStore';
import { useProfileStore } from '../../lib/store/profileStore';
import { useCloudProfileStore, useSyncCloudProfile } from '../../lib/store/cloudProfileStore';
import { useScrollHeader } from '../../lib/useScrollHeader';
import { PAPER } from '../../lib/paper';
import type { Category, Entry, Question } from '../../lib/db/types';

function NotebookCard({
  scheme,
  accent,
  label,
  onPress,
}: {
  scheme: 'light' | 'dark';
  accent: string;
  label: string;
  onPress: () => void;
}) {
  const paper = PAPER[scheme];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.notebookCard,
        { backgroundColor: paper.bg, opacity: pressed ? 0.9 : 1 },
      ]}
      onPress={onPress}
    >
      <PenWritingAnimation scheme={scheme} style={styles.penAnimation} />
      <Text style={[styles.notebookLabel, { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const session = useAuthStore((s) => s.session);
  const displayName = useProfileStore((s) => s.displayName);
  const cloudProfile = useCloudProfileStore((s) => s.profile);
  useSyncCloudProfile();
  const { scrollY, onScroll } = useScrollHeader();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [todayQuestion, setTodayQuestion] = useState<Question | null>(null);
  const [onThisDayEntries, setOnThisDayEntries] = useState<Entry[]>([]);
  const [previewEntry, setPreviewEntry] = useState<Entry | null>(null);

  const load = useCallback(async () => {
    try {
      await initDatabase();
      const now = new Date();
      const [entryRows, categoryRows, photoMap, question, onThisDayRows] = await Promise.all([
        getAllEntries(),
        getAllCategories(),
        getPhotoMap(),
        getQuestionForDate(now.getMonth() + 1, now.getDate()),
        getEntriesForMonthDay(now.getMonth() + 1, now.getDate(), now.getFullYear()),
      ]);
      setEntries(entryRows);
      setCategories(Object.fromEntries(categoryRows.map((c) => [c.id, c])));
      setPhotos(photoMap);
      setTodayQuestion(question);
      setOnThisDayEntries(onThisDayRows);
    } catch (error) {
      console.error('Girişler yüklenemedi:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const todayStr = toDateString(new Date());
  const todaysEntries = useMemo(() => entries.filter((e) => e.date === todayStr), [entries, todayStr]);
  const questionAnsweredToday =
    !!todayQuestion && entries.some((e) => e.question_id === todayQuestion.id && e.date === todayStr);

  const name = (session ? cloudProfile?.name : displayName) || null;
  const greetingTitle = name ? t.home.greeting(name) : t.home.greetingGeneric;

  return (
    <Screen
      colors={colors}
      title={greetingTitle}
      scrollY={scrollY}
      headerRight={
        <Pressable
          hitSlop={8}
          onPress={() => router.push('/search')}
          accessibilityLabel={t.search.title}
        >
          <Ionicons name="search" size={22} color={colors.text} />
        </Pressable>
      }
    >
      <Animated.FlatList
        data={todaysEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={styles.cards}>
            <NotebookCard
              scheme={scheme}
              accent={colors.accent}
              label={t.home.newEntryCard}
              onPress={() => router.push('/entry/new')}
            />

            <Pressable
              style={({ pressed }) => [
                styles.questionCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              onPress={() => router.push('/question')}
            >
              <View style={styles.questionCardHeader}>
                <Text style={[styles.questionCardBadge, { color: colors.accentSecondary }]}>
                  {t.tabs.question}
                </Text>
                {questionAnsweredToday && (
                  <Text style={[styles.answeredBadge, { color: colors.accentSecondary }]}>
                    ✓ {t.home.answered}
                  </Text>
                )}
              </View>
              <Text
                style={[styles.questionCardText, { color: colors.text }]}
                numberOfLines={2}
              >
                {todayQuestion
                  ? language === 'en'
                    ? todayQuestion.text_en ?? todayQuestion.text
                    : todayQuestion.text
                  : t.question.notFound}
              </Text>
            </Pressable>

            <OnThisDayCarousel
              title={t.home.onThisDayTitle}
              entries={onThisDayEntries}
              categories={categories}
              photos={photos}
              colors={colors}
              onPressEntry={(id) =>
                setPreviewEntry(onThisDayEntries.find((e) => e.id === id) ?? null)
              }
            />

            <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
              {t.home.recentEntries}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.subtext }]}>{t.home.empty}</Text>
        }
        renderItem={({ item }) => (
          <EntryRow
            item={item}
            category={item.category_id ? categories[item.category_id] : undefined}
            photoUri={photos[item.id]}
            colors={colors}
            onPress={() => router.push(`/entry/${item.id}`)}
          />
        )}
      />

      <EntryPreviewModal
        entry={previewEntry}
        category={
          previewEntry?.category_id ? categories[previewEntry.category_id] : undefined
        }
        photoUri={previewEntry ? photos[previewEntry.id] : undefined}
        onClose={() => setPreviewEntry(null)}
        onEdit={() => {
          if (!previewEntry) return;
          const id = previewEntry.id;
          setPreviewEntry(null);
          router.push(`/entry/${id}`);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cards: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 12,
  },
  notebookCard: {
    borderRadius: 16,
    padding: 16,
    gap: 4,
    alignItems: 'center',
  },
  penAnimation: {
    width: 210,
    height: 140,
  },
  notebookLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  questionCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  questionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionCardBadge: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  answeredBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  questionCardText: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexGrow: 1,
    gap: 12,
  },
  empty: {
    flex: 1,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
});
