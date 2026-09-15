import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import PenWritingAnimation from '../../components/PenWritingAnimation';
import EntryRow from '../../components/EntryRow';
import OnThisDayCarousel from '../../components/OnThisDayCarousel';
import { getAllEntries, getEntriesForMonthDay } from '../../lib/db/entries';
import { getAllCategories } from '../../lib/db/categories';
import { getPhotoMap } from '../../lib/db/photos';
import { getQuestionForDate } from '../../lib/db/questions';
import { initDatabase } from '../../lib/db/init';
import { toDateString } from '../../lib/date';
import { useTheme, type Palette } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { useSettingsStore } from '../../lib/store/settingsStore';
import { PAPER } from '../../lib/paper';
import type { Category, Entry, Question } from '../../lib/db/types';

const DAY_WIDTH = 48;
const DAYS_BEFORE = 30;
const DAYS_AFTER = 30;

function formatMonthLabel(date: Date, locale: string): string {
  const label = date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildDayStrip(): Date[] {
  const today = new Date();
  const days: Date[] = [];
  for (let i = -DAYS_BEFORE; i <= DAYS_AFTER; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function DayCell({
  date,
  selected,
  isToday,
  hasEntry,
  weekdayLabel,
  colors,
  onPress,
}: {
  date: Date;
  selected: boolean;
  isToday: boolean;
  hasEntry: boolean;
  weekdayLabel: string;
  colors: Palette;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.dayCell} onPress={onPress}>
      <Text style={[styles.dayWeekday, { color: colors.subtext }]}>{weekdayLabel}</Text>
      <View
        style={[
          styles.dayCircle,
          selected && { backgroundColor: colors.accent },
          !selected && isToday && { borderWidth: 1.5, borderColor: colors.accent },
        ]}
      >
        <Text style={[styles.dayNumber, { color: selected ? colors.accentText : colors.text }]}>
          {date.getDate()}
        </Text>
      </View>
      <View style={[styles.dayDot, { backgroundColor: hasEntry ? colors.accent : 'transparent' }]} />
    </Pressable>
  );
}

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
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [todayQuestion, setTodayQuestion] = useState<Question | null>(null);
  const [onThisDayEntries, setOnThisDayEntries] = useState<Entry[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => toDateString(new Date()));
  const [visibleMonthLabel, setVisibleMonthLabel] = useState(() =>
    formatMonthLabel(new Date(), locale)
  );

  const dayStrip = useMemo(buildDayStrip, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) return;
      const mid = viewableItems[Math.floor(viewableItems.length / 2)];
      if (mid?.item) setVisibleMonthLabel(formatMonthLabel(mid.item as Date, locale));
    }
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

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
  const entryDates = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);
  const todaysEntries = useMemo(() => entries.filter((e) => e.date === todayStr), [entries, todayStr]);
  const questionAnsweredToday =
    !!todayQuestion && entries.some((e) => e.question_id === todayQuestion.id && e.date === todayStr);

  return (
    <Screen
      colors={colors}
      title={t.tabs.home}
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
      <Text style={[styles.monthLabel, { color: colors.text }]}>{visibleMonthLabel}</Text>
      <FlatList
        data={dayStrip}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(d) => toDateString(d)}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
        initialScrollIndex={DAYS_BEFORE}
        getItemLayout={(_, index) => ({ length: DAY_WIDTH, offset: DAY_WIDTH * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => {
          const dateStr = toDateString(item);
          return (
            <DayCell
              date={item}
              selected={dateStr === selectedDate}
              isToday={dateStr === todayStr}
              hasEntry={entryDates.has(dateStr)}
              weekdayLabel={t.calendar.weekdays[(item.getDay() + 6) % 7]}
              colors={colors}
              onPress={() => setSelectedDate(dateStr)}
            />
          );
        }}
      />

      <FlatList
        data={todaysEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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
              onPressEntry={(id) => router.push(`/entry/${id}`)}
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
            category={categories[item.category_id]}
            photoUri={photos[item.id]}
            colors={colors}
            onPress={() => router.push(`/entry/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthLabel: {
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  strip: {
    flexGrow: 0,
    paddingVertical: 10,
  },
  stripContent: {
    paddingHorizontal: 8,
  },
  dayCell: {
    width: DAY_WIDTH,
    alignItems: 'center',
    gap: 4,
  },
  dayWeekday: {
    fontSize: 11,
    fontWeight: '600',
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
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
