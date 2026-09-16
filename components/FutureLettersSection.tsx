import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { initDatabase } from '../lib/db/init';
import { getAllLetters } from '../lib/db/futureLetters';
import { toDateString } from '../lib/date';

// Profile'daki giriş noktası — Kapsül/Yılın Kelimesi ile aynı desen: kısa bir özet
// kartı, gerçek liste + yazma akışı ayrı bir ekranda (bkz. app/future-letters.tsx).
export default function FutureLettersSection() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [openedCount, setOpenedCount] = useState(0);

  const load = useCallback(async () => {
    try {
      await initDatabase();
      const letters = await getAllLetters();
      const today = toDateString(new Date());
      const active = letters.filter((l) => l.unlock_date > today).length;
      setActiveCount(active);
      setOpenedCount(letters.length - active);
    } catch (error) {
      console.error('Geleceğe mektuplar yüklenemedi:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Basit mount-only useEffect yeterli olmazdı: kullanıcı /future-letters'a gidip
  // bir mektup yazdıktan/sildikten sonra Profile'a geri döndüğünde bu bileşen
  // yeniden mount OLMAZ (stack'te altta kalmış hali), bu yüzden WrappedSection'daki
  // ile aynı desen — her odaklanmada yeniden yükleniyor.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!loaded) return null;

  const hasLetters = activeCount + openedCount > 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
      onPress={() => router.push('/future-letters')}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
        <Ionicons name="mail-outline" size={22} color={colors.accentText} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.text }]}>{t.futureLetters.title}</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]} numberOfLines={1}>
          {hasLetters ? t.futureLetters.summary(activeCount, openedCount) : t.futureLetters.subtitle}
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
