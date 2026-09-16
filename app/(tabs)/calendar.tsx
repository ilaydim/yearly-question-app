import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Screen from '../../components/Screen';
import EntryRow from '../../components/EntryRow';
import { getAllEntries } from '../../lib/db/entries';
import { getAllCategories } from '../../lib/db/categories';
import { initDatabase } from '../../lib/db/init';
import { toDateString } from '../../lib/date';
import { useTheme } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { useSettingsStore } from '../../lib/store/settingsStore';
import { useScrollHeader } from '../../lib/useScrollHeader';
import type { Category, Entry } from '../../lib/db/types';

type ViewMode = 'calendar' | 'categories';

function getMonthMatrix(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(startWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function groupByMonth(
  entries: Entry[],
  locale: string
): { key: string; title: string; data: Entry[] }[] {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return Array.from(map.keys())
    .sort()
    .reverse()
    .map((key) => {
      const [year, month] = key.split('-').map(Number);
      const label = new Date(year, month - 1, 1).toLocaleDateString(locale, {
        month: 'long',
        year: 'numeric',
      });
      return { key, title: label.charAt(0).toUpperCase() + label.slice(1), data: map.get(key)! };
    });
}

export default function CalendarScreen() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const language = useSettingsStore((s) => s.language);
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';

  const [mode, setMode] = useState<ViewMode>('calendar');
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { scrollY, onScroll } = useScrollHeader();

  const load = useCallback(async () => {
    try {
      await initDatabase();
      const [entryRows, categoryRows] = await Promise.all([getAllEntries(), getAllCategories()]);
      setEntries(entryRows);
      setCategories(categoryRows);
    } catch (error) {
      console.error('Takvim yüklenemedi:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const categoriesMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  );

  const entriesByDate = useMemo(() => {
    const grouped: Record<string, Entry[]> = {};
    for (const entry of entries) {
      (grouped[entry.date] ??= []).push(entry);
    }
    return grouped;
  }, [entries]);

  const categoryColorsByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const entry of entries) {
      const color = entry.category_id ? categoriesMap[entry.category_id]?.color : undefined;
      if (!color) continue;
      const list = (map[entry.date] ??= []);
      if (!list.includes(color)) list.push(color);
    }
    return map;
  }, [entries, categoriesMap]);

  const weeks = useMemo(
    () => getMonthMatrix(monthCursor.getFullYear(), monthCursor.getMonth()),
    [monthCursor]
  );

  const monthLabel = monthCursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const todayStr = toDateString(new Date());
  const hasSelection = selectedDate !== null;
  const selectedEntries = selectedDate ? entriesByDate[selectedDate] ?? [] : [];

  const changeMonth = (delta: number) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const lastTapRef = useRef<{ date: string; time: number } | null>(null);

  const selectDay = (dateStr: string) => {
    const now = Date.now();
    const lastTap = lastTapRef.current;
    lastTapRef.current = { date: dateStr, time: now };

    if (lastTap && lastTap.date === dateStr && now - lastTap.time < 300) {
      lastTapRef.current = null;
      router.push(`/entry/new?date=${dateStr}`);
      return;
    }

    if (selectedDate === null) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setSelectedDate(dateStr);
  };

  const selectCategory = (categoryId: string | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCategoryId(categoryId);
  };

  const filteredEntries = useMemo(
    () =>
      selectedCategoryId
        ? entries.filter((e) => e.category_id === selectedCategoryId)
        : entries,
    [entries, selectedCategoryId]
  );

  const sections = useMemo(
    () => groupByMonth(filteredEntries, locale),
    [filteredEntries, locale]
  );

  return (
    <Screen colors={colors} title={t.calendar.title} scrollY={scrollY}>
      <View style={[styles.modeSwitch, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          style={[styles.modeItem, mode === 'calendar' && { backgroundColor: colors.accent }]}
          onPress={() => setMode('calendar')}
        >
          <Text
            style={[
              styles.modeText,
              { color: mode === 'calendar' ? colors.accentText : colors.subtext },
            ]}
          >
            {t.calendar.viewCalendar}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeItem, mode === 'categories' && { backgroundColor: colors.accent }]}
          onPress={() => setMode('categories')}
        >
          <Text
            style={[
              styles.modeText,
              { color: mode === 'categories' ? colors.accentText : colors.subtext },
            ]}
          >
            {t.calendar.viewCategories}
          </Text>
        </Pressable>
      </View>

      {mode === 'calendar' ? (
        <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.header}>
            <Pressable onPress={() => changeMonth(-1)} style={styles.navButton}>
              <Text style={[styles.navText, { color: colors.accent }]}>‹</Text>
            </Pressable>
            <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
            <Pressable onPress={() => changeMonth(1)} style={styles.navButton}>
              <Text style={[styles.navText, { color: colors.accent }]}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {t.calendar.weekdays.map((day) => (
              <Text key={day} style={[styles.weekdayLabel, { color: colors.subtext }]}>
                {day}
              </Text>
            ))}
          </View>

          {weeks.map((week, i) => (
            <View key={i} style={styles.weekRow}>
              {week.map((date, j) => {
                if (!date) return <View key={j} style={styles.dayCell} />;
                const dateStr = toDateString(date);
                const dayColors = categoryColorsByDate[dateStr] ?? [];
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;
                const filled = isSelected || isToday;
                const circleSize = hasSelection ? 28 : 32;
                return (
                  <Pressable key={j} style={styles.dayCell} onPress={() => selectDay(dateStr)}>
                    <View
                      collapsable={false}
                      style={[
                        styles.dayCircle,
                        {
                          width: circleSize,
                          height: circleSize,
                          borderRadius: circleSize / 2,
                        },
                        !isSelected && isToday && { backgroundColor: colors.accentSecondary },
                        isSelected && { backgroundColor: colors.accent },
                      ]}
                    >
                      <Text style={[styles.dayText, { color: filled ? colors.accentText : colors.text }]}>
                        {date.getDate()}
                      </Text>
                    </View>
                    {dayColors.length > 0 && (
                      <View style={styles.dotsRow}>
                        {dayColors.slice(0, 4).map((color) => (
                          <View key={color} style={[styles.dot, { backgroundColor: color }]} />
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {hasSelection && (
          <View style={styles.entriesSection}>
            <Text style={[styles.entriesTitle, { color: colors.subtext }]}>
              {selectedDate} · {t.calendar.entriesOn}
            </Text>
            {selectedEntries.length === 0 ? (
              <Text style={[styles.empty, { color: colors.subtext }]}>{t.calendar.noEntries}</Text>
            ) : (
              selectedEntries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  item={entry}
                  category={entry.category_id ? categoriesMap[entry.category_id] : undefined}
                  colors={colors}
                  animate={false}
                  onPress={() => router.push(`/entry/${entry.id}`)}
                />
              ))
            )}
          </View>
          )}
        </Animated.ScrollView>
      ) : (
        <>
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
          >
            <Pressable
              style={[
                styles.chip,
                { borderColor: colors.border },
                selectedCategoryId === null && { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
              onPress={() => selectCategory(null)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selectedCategoryId === null ? colors.accentText : colors.text },
                ]}
              >
                {t.calendar.allCategories}
              </Text>
            </Pressable>
            {categories.map((category) => {
              const selected = selectedCategoryId === category.id;
              return (
                <Pressable
                  key={category.id}
                  style={[
                    styles.chip,
                    { borderColor: category.color },
                    selected && { backgroundColor: category.color },
                  ]}
                  onPress={() => selectCategory(category.id)}
                >
                  <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.text }]}>
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.ScrollView>

          <Animated.SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            style={styles.scroll}
            contentContainerStyle={styles.diaryList}
            stickySectionHeadersEnabled={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            renderSectionHeader={({ section }) => (
              <Text style={[styles.monthHeader, { color: colors.text }]}>{section.title}</Text>
            )}
            renderItem={({ item }) => (
              <EntryRow
                item={item}
                category={item.category_id ? categoriesMap[item.category_id] : undefined}
                colors={colors}
                animate={false}
                onPress={() => router.push(`/entry/${item.id}`)}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            SectionSeparatorComponent={() => <View style={{ height: 18 }} />}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.subtext }]}>
                {t.calendar.noEntriesInCategory}
              </Text>
            }
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  modeItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingTop: 0,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 22,
    fontWeight: '700',
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    height: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  entriesSection: {
    marginTop: 20,
    gap: 10,
  },
  entriesTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: {
    fontSize: 14,
    marginTop: 4,
  },
  chipsScroll: {
    flexGrow: 0,
    height: 36,
    marginBottom: 8,
  },
  chipsRow: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1.2,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  diaryList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  monthHeader: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    textTransform: 'capitalize',
  },
});
