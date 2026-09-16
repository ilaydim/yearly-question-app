import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Screen from '../../components/Screen';
import { getEntriesForQuestion, getQuestionForDate } from '../../lib/db/questions';
import { createEntry, updateEntry } from '../../lib/db/entries';
import { initDatabase } from '../../lib/db/init';
import { generateId } from '../../lib/db/id';
import { toDateString } from '../../lib/date';
import { useTheme } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { useSettingsStore } from '../../lib/store/settingsStore';
import { useScrollHeader } from '../../lib/useScrollHeader';
import { PAPER } from '../../lib/paper';
import type { Entry, Question } from '../../lib/db/types';

const SCRATCH_LEAP_YEAR = 2024;

function localizedQuestionText(question: Question, language: 'tr' | 'en'): string {
  return language === 'en' ? question.text_en ?? question.text : question.text;
}

function shiftMonthDay(month: number, day: number, delta: number): { month: number; day: number } {
  const d = new Date(SCRATCH_LEAP_YEAR, month - 1, day);
  d.setDate(d.getDate() + delta);
  return { month: d.getMonth() + 1, day: d.getDate() };
}

function dayOfYear(month: number, day: number): number {
  const start = Date.UTC(SCRATCH_LEAP_YEAR, 0, 1);
  const target = Date.UTC(SCRATCH_LEAP_YEAR, month - 1, day);
  return Math.round((target - start) / 86400000);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function thisYearOccurrence(month: number, day: number): Date {
  const year = new Date().getFullYear();
  const safeDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
  return new Date(year, month - 1, safeDay);
}

export default function QuestionScreen() {
  const { colors, scheme } = useTheme();
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const today = new Date();
  const [viewed, setViewed] = useState({ month: today.getMonth() + 1, day: today.getDate() });
  const [loaded, setLoaded] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [answer, setAnswer] = useState('');
  const fade = useRef(new Animated.Value(0)).current;
  const { scrollY, onScroll } = useScrollHeader();

  const load = useCallback(async (month: number, day: number) => {
    setLoaded(false);
    try {
      await initDatabase();
      const q = await getQuestionForDate(month, day);
      setQuestion(q);
      if (q) {
        const rows = await getEntriesForQuestion(q.id);
        setEntries(rows);
        const dateStr = toDateString(thisYearOccurrence(month, day));
        setAnswer(rows.find((e) => e.date === dateStr)?.content ?? '');
      } else {
        setEntries([]);
        setAnswer('');
      }
    } catch (error) {
      console.error('Soru yüklenemedi:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(viewed.month, viewed.day);
    }, [load, viewed.month, viewed.day])
  );

  useEffect(() => {
    if (loaded) {
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [loaded, viewed.month, viewed.day, fade]);

  const viewedDate = thisYearOccurrence(viewed.month, viewed.day);
  const viewedDateStr = toDateString(viewedDate);
  const isPast =
    dayOfYear(viewed.month, viewed.day) < dayOfYear(today.getMonth() + 1, today.getDate());
  const currentYearEntry = entries.find((e) => e.date === viewedDateStr) ?? null;
  const unlocked = isPast || !!currentYearEntry;
  const pastEntries = entries.filter((e) => e.date !== viewedDateStr);

  const dateLabel = viewedDate.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const goPrev = () => setViewed((v) => shiftMonthDay(v.month, v.day, -1));
  const goNext = () => setViewed((v) => shiftMonthDay(v.month, v.day, 1));

  const handleSubmit = async () => {
    if (!question || !answer.trim()) return;
    try {
      if (currentYearEntry) {
        await updateEntry(currentYearEntry.id, { content: answer.trim() });
      } else {
        const now = new Date().toISOString();
        await createEntry({
          id: generateId(),
          date: viewedDateStr,
          content: answer.trim(),
          mood: null,
          category_id: null,
          question_id: question.id,
          created_at: now,
          updated_at: now,
          latitude: null,
          longitude: null,
          location_name: null,
          country: null,
          capsule_year: null,
        });
      }
      const rows = await getEntriesForQuestion(question.id);
      setEntries(rows);
    } catch (error) {
      console.error('Cevap kaydedilemedi:', error);
    }
  };

  const paper = PAPER[scheme];

  return (
    <Screen colors={colors} title={t.tabs.question} scrollY={scrollY}>
      <View style={styles.header}>
        <Pressable onPress={goPrev} hitSlop={10} style={styles.navButton}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </Pressable>
        <Text style={[styles.dateLabel, { color: colors.text }]} numberOfLines={1}>
          {dateLabel}
        </Text>
        <Pressable onPress={goNext} hitSlop={10} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={22} color={colors.accent} />
        </Pressable>
      </View>

      {!loaded ? null : !question ? (
        <Text style={[styles.empty, { color: colors.subtext }]}>{t.question.notFound}</Text>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <Animated.View style={{ opacity: fade, gap: 14 }}>
            <Text style={[styles.question, { color: colors.text }]}>
              {localizedQuestionText(question, language)}
            </Text>

            <View style={[styles.paperCard, { backgroundColor: paper.bg }]}>
              <View style={[styles.paperMargin, { backgroundColor: paper.margin }]} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                multiline
                placeholder={t.question.placeholder}
                placeholderTextColor={colors.subtext}
                value={answer}
                onChangeText={setAnswer}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleSubmit}
            >
              <Text style={[styles.submitText, { color: colors.accentText }]}>
                {currentYearEntry ? t.question.update : t.question.save}
              </Text>
            </Pressable>

            <View style={styles.pastSection}>
              <Text style={[styles.pastTitle, { color: colors.subtext }]}>
                {t.question.pastTitle}
              </Text>
              {!unlocked ? (
                <View
                  style={[styles.lockedBox, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Ionicons name="lock-closed-outline" size={18} color={colors.subtext} />
                  <Text style={[styles.lockedText, { color: colors.subtext }]}>
                    {t.question.locked}
                  </Text>
                </View>
              ) : pastEntries.length === 0 ? (
                <Text style={[styles.empty, { color: colors.subtext }]}>{t.question.firstTime}</Text>
              ) : (
                pastEntries.map((entry) => (
                  <View key={entry.id} style={styles.yearRow}>
                    <Text style={[styles.yearLabel, { color: colors.accent }]}>
                      {entry.date.slice(0, 4)}
                    </Text>
                    <Text
                      style={[styles.yearContent, { color: colors.text, borderColor: colors.border }]}
                    >
                      {entry.content}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </Animated.View>
        </Animated.ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  navButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 16,
    flexGrow: 1,
  },
  question: {
    fontSize: 22,
    fontWeight: '800',
  },
  paperCard: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    minHeight: 160,
  },
  paperMargin: {
    width: 2,
    marginRight: 14,
    borderRadius: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
  pastSection: {
    marginTop: 8,
    gap: 12,
  },
  pastTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lockedText: {
    flex: 1,
    fontSize: 14,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  yearLabel: {
    width: 44,
    fontSize: 14,
    fontWeight: '800',
  },
  yearContent: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
});
