import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useTheme, type Palette } from '../lib/theme';
import { useT } from '../lib/i18n';
import type { Dictionary } from '../lib/i18n';
import { initDatabase } from '../lib/db/init';
import { getJournalStats, type JournalStats } from '../lib/db/stats';
import { toDateString } from '../lib/date';

function StatCard({
  colors,
  value,
  label,
}: {
  colors: Palette;
  value: number;
  label: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statNumber, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.subtext }]}>{label}</Text>
    </View>
  );
}

function HeroStreak({
  colors,
  t,
  stats,
}: {
  colors: Palette;
  t: Dictionary;
  stats: JournalStats;
}) {
  return (
    <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name="flame" size={30} color={colors.accent} />
      <Text style={[styles.heroNumber, { color: colors.text }]}>{stats.currentStreak}</Text>
      <Text style={[styles.heroLabel, { color: colors.subtext }]}>
        {t.stats.days} · {t.stats.currentStreak}
      </Text>
      {!stats.wroteToday && (
        <Text style={[styles.encourage, { color: colors.accent }]}>{t.stats.encourageToday}</Text>
      )}
    </View>
  );
}

export default function StatsScreen() {
  const { colors } = useTheme();
  const t = useT();
  const [stats, setStats] = useState<JournalStats | null>(null);

  const load = useCallback(async () => {
    try {
      await initDatabase();
      const result = await getJournalStats(toDateString(new Date()));
      setStats(result);
    } catch (error) {
      console.error('İstatistikler yüklenemedi:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!stats) {
    return (
      <Screen colors={colors} edges={['bottom']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen colors={colors} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <HeroStreak colors={colors} t={t} stats={stats} />

        <View style={styles.row}>
          <StatCard colors={colors} value={stats.longestStreak} label={t.stats.longestStreak} />
          <StatCard colors={colors} value={stats.totalEntries} label={t.stats.totalEntries} />
        </View>

        {stats.longestStreak === 0 && (
          <Text style={[styles.emptyState, { color: colors.subtext }]}>{t.stats.emptyState}</Text>
        )}

        {/*
          v1 (free): sadece seri + toplam giriş. Premium genişleme (mood trendleri,
          yazma sıklığı grafiği, yıl sonu özeti) buraya yeni kart/section olarak eklenecek;
          getJournalStats bu yüzden ayrı, genişletilebilir bir modülde (lib/db/stats.ts).
        */}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: 16,
    gap: 12,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 4,
  },
  heroNumber: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  encourage: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
});
