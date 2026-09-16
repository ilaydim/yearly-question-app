import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { initDatabase } from '../lib/db/init';
import { getWrappedAvailableYears } from '../lib/db/stats';

// Kapsül/Yılın Kelimesi'nin aksine kilitli/pencereli değil — bir yılın özeti o yıl
// bittiği an kalıcı olarak açılır, bu yüzden burada bir "canAccess" kontrolü yok.
// Hiç açılmış yıl yoksa (henüz hiçbir yıl bitmemiş ya da hiç veri yoksa) bölüm
// tamamen gizleniyor.
export default function WrappedSection() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const [years, setYears] = useState<number[] | null>(null);

  const load = useCallback(async () => {
    try {
      await initDatabase();
      setYears(await getWrappedAvailableYears());
    } catch (error) {
      console.error('Yıl özetleri yüklenemedi:', error);
      setYears([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!years || years.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t.wrapped.sectionTitle}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {years.map((year) => (
          <Pressable
            key={year}
            style={({ pressed }) => [
              styles.yearCard,
              { backgroundColor: colors.bg, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => router.push(`/wrapped/${year}`)}
          >
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <Text style={[styles.yearText, { color: colors.text }]}>{year}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  row: {
    gap: 10,
  },
  yearCard: {
    width: 84,
    height: 74,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  yearText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
