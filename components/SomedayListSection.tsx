import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { initDatabase } from '../lib/db/init';
import { getCompletedCount } from '../lib/db/somedayList';
import { getLevelInfo, type LevelInfo } from '../lib/somedayLevels';

// Profile'daki giriş noktası — Kapsül/Geleceğe Mektuplar ile aynı desen: kısa bir
// özet kartı, gerçek liste + ekleme/tamamlama akışı ayrı bir ekranda (bkz.
// app/someday-list.tsx). Sınırsız/free-premium ayrımı yok, bu yüzden burada hiç
// kilitli bir hal göstermiyoruz — her zaman en az "Seviye 1" ile başlar.
export default function SomedayListSection() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);

  const load = useCallback(async () => {
    try {
      await initDatabase();
      const count = await getCompletedCount();
      setLevelInfo(getLevelInfo(count));
    } catch (error) {
      console.error('Bir Gün Listesi seviyesi yüklenemedi:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!loaded || !levelInfo) return null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
      onPress={() => router.push('/someday-list')}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
        <Ionicons name="trophy-outline" size={22} color={colors.accentText} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.text }]}>{t.somedayList.title}</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]} numberOfLines={1}>
          {t.somedayList.summary(levelInfo.level, levelInfo.title)}
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
