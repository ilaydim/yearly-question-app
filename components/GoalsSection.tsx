import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { initDatabase } from '../lib/db/init';
import { getCurrentItems } from '../lib/db/goals';

// Profile'daki giriş noktası — Bir Gün Listesi/seviye sistemiyle HİÇ ilgisi yok,
// tamamen bağımsız bir özellik (bkz. app/goals.tsx). Kısa bir özet kartı (üç liste
// türündeki güncel periyotların toplam açık madde sayısı), gerçek liste + ekleme/
// işaretleme akışı ayrı bir ekranda.
export default function GoalsSection() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [openCount, setOpenCount] = useState(0);

  const load = useCallback(async () => {
    try {
      await initDatabase();
      const [daily, weekly, yearly] = await Promise.all([
        getCurrentItems('daily'),
        getCurrentItems('weekly'),
        getCurrentItems('yearly'),
      ]);
      const count = [...daily, ...weekly, ...yearly].filter((item) => item.is_completed === 0).length;
      setOpenCount(count);
    } catch (error) {
      console.error('Hedefler özeti yüklenemedi:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!loaded) return null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
      onPress={() => router.push('/goals')}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
        <Ionicons name="flag-outline" size={22} color={colors.accentText} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.text }]}>{t.goals.title}</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]} numberOfLines={1}>
          {t.goals.openGoalsSummary(openCount)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
});
