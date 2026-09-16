import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { useSettingsStore } from '../../lib/store/settingsStore';
import { initDatabase } from '../../lib/db/init';
import { getYearWrapped, type YearWrapped } from '../../lib/db/stats';
import { getAllCategories } from '../../lib/db/categories';
import { PAPER } from '../../lib/paper';
import { TITLE_FONT_FAMILY } from '../../lib/fonts';
import type { Category } from '../../lib/db/types';

interface WrappedPage {
  key: string;
  backgroundColor: string;
  content: React.ReactNode;
}

export default function WrappedYearScreen() {
  const { year: yearParam } = useLocalSearchParams<{ year: string }>();
  const year = Number(yearParam);
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const paper = PAPER[scheme];

  const [loaded, setLoaded] = useState(false);
  const [wrapped, setWrapped] = useState<YearWrapped | null>(null);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const fade = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      await initDatabase();
      const [result, categoryRows] = await Promise.all([getYearWrapped(year), getAllCategories()]);
      setWrapped(result);
      setCategories(Object.fromEntries(categoryRows.map((c) => [c.id, c])));
    } catch (error) {
      console.error('Yıl özeti yüklenemedi:', error);
    } finally {
      setLoaded(true);
    }
  }, [year]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [currentIndex, fade]);

  const monthLabel = (month: number) => {
    const label = new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  // Sayfalar tamamen mevcut veriye göre kuruluyor — bir metrik yoksa (null/boş)
  // o sayfa listeye hiç girmiyor.
  const pages: WrappedPage[] = useMemo(() => {
    if (!wrapped) return [];
    const list: WrappedPage[] = [];

    list.push({
      key: 'opening',
      backgroundColor: colors.accent,
      content: (
        <>
          <Text style={[styles.eyebrow, { color: colors.accentText }]}>
            {t.wrapped.openingPrefix(year)}
          </Text>
          <Text style={[styles.bigNumber, { color: colors.accentText }]}>
            {wrapped.totalEntries}
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.accentText }]}>
            {t.wrapped.openingEntriesLabel}
          </Text>
        </>
      ),
    });

    if (wrapped.mostActiveMonth) {
      list.push({
        key: 'month',
        backgroundColor: colors.bg,
        content: (
          <>
            <Ionicons name="calendar" size={40} color={colors.accent} />
            <Text style={[styles.pageLabel, { color: colors.subtext }]}>
              {t.wrapped.mostActiveMonth}
            </Text>
            <Text style={[styles.bigTitle, { color: colors.text }]}>
              {monthLabel(wrapped.mostActiveMonth.month)}
            </Text>
            <Text style={[styles.pageSubtitle, { color: colors.subtext }]}>
              {t.wrapped.monthEntriesLabel(wrapped.mostActiveMonth.count)}
            </Text>
          </>
        ),
      });
    }

    if (wrapped.topMood) {
      list.push({
        key: 'mood',
        backgroundColor: colors.accentSecondary,
        content: (
          <>
            <Text style={[styles.pageLabel, { color: colors.accentText }]}>
              {t.wrapped.topMood}
            </Text>
            <Text style={styles.bigEmoji}>{wrapped.topMood.mood}</Text>
            <Text style={[styles.pageSubtitle, { color: colors.accentText }]}>
              {t.wrapped.topMoodLabel(wrapped.topMood.count)}
            </Text>
          </>
        ),
      });
    }

    if (wrapped.categoryBreakdown.length > 0) {
      list.push({
        key: 'categories',
        backgroundColor: colors.bg,
        content: (
          <>
            <Text style={[styles.pageLabel, { color: colors.subtext }]}>
              {t.wrapped.categoryBreakdown}
            </Text>
            <View style={styles.categoryList}>
              {wrapped.categoryBreakdown.slice(0, 5).map(({ categoryId, count }) => {
                const category = categories[categoryId];
                if (!category) return null;
                return (
                  <View key={categoryId} style={styles.categoryRow}>
                    <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                    <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={1}>
                      {category.name}
                    </Text>
                    <Text style={[styles.categoryCount, { color: colors.subtext }]}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ),
      });
    }

    list.push({
      key: 'streak',
      backgroundColor: colors.accent,
      content: (
        <>
          <Ionicons name="flame" size={40} color={colors.accentText} />
          <Text style={[styles.bigNumber, { color: colors.accentText }]}>
            {wrapped.longestStreakInYear}
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.accentText }]}>
            {t.stats.days} · {t.wrapped.longestStreak}
          </Text>
        </>
      ),
    });

    list.push({
      key: 'numbers',
      backgroundColor: colors.accentSecondary,
      content: (
        <>
          <Text style={[styles.pageLabel, { color: colors.accentText }]}>
            {t.wrapped.photosWordsTitle}
          </Text>
          <View style={styles.numbersGrid}>
            {wrapped.totalPhotos > 0 && (
              <View style={styles.numberItem}>
                <Text style={[styles.mediumNumber, { color: colors.accentText }]}>
                  {wrapped.totalPhotos}
                </Text>
                <Text style={[styles.numberLabel, { color: colors.accentText }]}>
                  {t.wrapped.totalPhotosLabel}
                </Text>
              </View>
            )}
            <View style={styles.numberItem}>
              <Text style={[styles.mediumNumber, { color: colors.accentText }]}>
                {wrapped.totalWords}
              </Text>
              <Text style={[styles.numberLabel, { color: colors.accentText }]}>
                {t.wrapped.totalWordsLabel}
              </Text>
            </View>
            {wrapped.longestSingleEntry && (
              <View style={styles.numberItem}>
                <Text style={[styles.mediumNumber, { color: colors.accentText }]}>
                  {wrapped.longestSingleEntry.length}
                </Text>
                <Text style={[styles.numberLabel, { color: colors.accentText }]}>
                  {t.wrapped.longestEntryLabel}
                </Text>
              </View>
            )}
          </View>
        </>
      ),
    });

    if (wrapped.previousYearComparison) {
      const { diff, previousYear } = wrapped.previousYearComparison;
      list.push({
        key: 'comparison',
        backgroundColor: colors.bg,
        content: (
          <>
            <Ionicons
              name={diff > 0 ? 'trending-up' : diff < 0 ? 'trending-down' : 'remove'}
              size={40}
              color={colors.accent}
            />
            <Text style={[styles.pageLabel, { color: colors.subtext }]}>
              {t.wrapped.comparisonTitle}
            </Text>
            <Text style={[styles.bigTitle, { color: colors.text, textAlign: 'center' }]}>
              {diff > 0
                ? t.wrapped.comparisonMore(diff)
                : diff < 0
                  ? t.wrapped.comparisonLess(Math.abs(diff))
                  : t.wrapped.comparisonSame}
            </Text>
            <Text style={[styles.pageSubtitle, { color: colors.subtext }]}>{previousYear}</Text>
          </>
        ),
      });
    }

    if (wrapped.yearWord) {
      list.push({
        key: 'yearWord',
        backgroundColor: colors.accent,
        content: (
          <>
            <Text style={[styles.pageLabel, { color: colors.accentText }]}>
              {t.wrapped.yearWordTitle}
            </Text>
            <Text style={[styles.yearWordText, { color: colors.accentText }]}>
              {wrapped.yearWord}
            </Text>
          </>
        ),
      });
    }

    if (wrapped.capsuleText) {
      list.push({
        key: 'capsule',
        backgroundColor: paper.bg,
        content: (
          <>
            <Text style={[styles.pageLabel, { color: colors.text }]}>
              {t.wrapped.capsuleTitle}
            </Text>
            <View style={[styles.paperCard]}>
              <View style={[styles.paperMargin, { backgroundColor: paper.margin }]} />
              <Text style={[styles.paperText, { color: colors.text }]}>{wrapped.capsuleText}</Text>
            </View>
          </>
        ),
      });
    }

    list.push({
      key: 'closing',
      backgroundColor: colors.accent,
      content: (
        <>
          <Ionicons name="sparkles" size={40} color={colors.accentText} />
          <Text style={[styles.bigTitle, { color: colors.accentText, textAlign: 'center' }]}>
            {t.wrapped.closingTitle(year)}
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.accentText, textAlign: 'center' }]}>
            {t.wrapped.closingSubtitle}
          </Text>
        </>
      ),
    });

    return list;
  }, [wrapped, categories, colors, paper, t, year, locale]);

  const goToIndex = (index: number) => {
    if (index < 0 || index >= pages.length) {
      if (index >= pages.length) router.back();
      return;
    }
    scrollRef.current?.scrollTo({ x: index * pageWidth, animated: true });
    setCurrentIndex(index);
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setCurrentIndex(index);
  };

  if (!loaded || !wrapped) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View
      style={[styles.flex, { backgroundColor: colors.bg }]}
      onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
    >
      {pageWidth > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleMomentumEnd}
        >
          {pages.map((page) => (
            <View key={page.key} style={{ width: pageWidth, backgroundColor: page.backgroundColor }}>
              <SafeAreaView edges={['top', 'bottom']} style={styles.pageInner}>
                <Animated.View style={[styles.pageContent, { opacity: fade }]}>
                  {page.content}
                </Animated.View>
              </SafeAreaView>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Story tarzı sol/sağ dokunma alanları: sol %35 önceki, sağ %65 sonraki sayfaya
          geçer — son sayfada sağa dokunmak hikayeyi kapatır (goToIndex zaten bunu yapıyor). */}
      <View style={styles.tapZones} pointerEvents="box-none">
        <Pressable style={styles.tapZoneLeft} onPress={() => goToIndex(currentIndex - 1)} />
        <Pressable style={styles.tapZoneRight} onPress={() => goToIndex(currentIndex + 1)} />
      </View>

      <SafeAreaView edges={['top']} style={styles.chrome} pointerEvents="box-none">
        <View style={styles.progressRow}>
          {pages.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { opacity: i <= currentIndex ? 1 : 0.3 },
                ]}
              />
            </View>
          ))}
        </View>
        <Pressable hitSlop={12} style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageInner: {
    flex: 1,
  },
  pageContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  eyebrow: {
    fontSize: 20,
    fontWeight: '700',
  },
  bigNumber: {
    fontSize: 72,
    fontWeight: '800',
  },
  bigTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  bigEmoji: {
    fontSize: 88,
  },
  pageLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pageSubtitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  categoryList: {
    alignSelf: 'stretch',
    gap: 14,
    marginTop: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  categoryCount: {
    fontSize: 15,
    fontWeight: '700',
  },
  numbersGrid: {
    alignSelf: 'stretch',
    marginTop: 10,
    gap: 20,
  },
  numberItem: {
    alignItems: 'center',
    gap: 2,
  },
  mediumNumber: {
    fontSize: 40,
    fontWeight: '800',
  },
  numberLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  yearWordText: {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 48,
    textAlign: 'center',
  },
  paperCard: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  paperMargin: {
    width: 2,
    marginRight: 14,
    borderRadius: 1,
  },
  paperText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  tapZones: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  tapZoneLeft: {
    width: '35%',
  },
  tapZoneRight: {
    width: '65%',
  },
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Sayfa arka planı ne renk olursa olsun (açık ya da koyu), beyaz ilerleme
    // çubuğu/kapatma ikonu okunur kalsın diye sabit, yarı saydam bir karartma şeridi —
    // Instagram/Snapchat story arayüzlerindeki aynı teknik.
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  progressFill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
