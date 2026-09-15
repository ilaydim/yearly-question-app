import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Screen from '../components/Screen';
import ShareCard, { type ShareFormat } from '../components/ShareCard';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useSettingsStore } from '../lib/store/settingsStore';
import { getEntryById } from '../lib/db/entries';
import { getAllCategories } from '../lib/db/categories';
import { getPhotosByEntryId } from '../lib/db/photos';
import { initDatabase } from '../lib/db/init';
import type { Category, Entry } from '../lib/db/types';

export default function ShareEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const t = useT();
  const language = useSettingsStore((s) => s.language);

  const [entry, setEntry] = useState<Entry | null>(null);
  const [category, setCategory] = useState<Category | undefined>(undefined);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [format, setFormat] = useState<ShareFormat>('square');
  const [loaded, setLoaded] = useState(false);
  const [sharing, setSharing] = useState(false);

  const cardRef = useRef<View>(null);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        const [entryRow, categoryRows, photos] = await Promise.all([
          getEntryById(id),
          getAllCategories(),
          getPhotosByEntryId(id),
        ]);
        setEntry(entryRow);
        setCategory(categoryRows.find((c) => c.id === entryRow?.category_id));
        setPhotoUri(photos[0]?.file_path ?? null);
      } catch (error) {
        console.error('Paylaşım verisi yüklenemedi:', error);
      } finally {
        setLoaded(true);
      }
    })();
  }, [id]);

  const handleShare = async () => {
    if (!entry) return;
    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(t.shareEntry.shareErrorTitle, t.shareEntry.notAvailable);
        return;
      }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch (error) {
      console.error('Paylaşım başarısız:', error);
      Alert.alert(t.shareEntry.shareErrorTitle, t.shareEntry.shareErrorMessage);
    } finally {
      setSharing(false);
    }
  };

  if (!loaded || !entry) {
    return (
      <Screen colors={colors} edges={['bottom']}>
        <View style={styles.centered}>
          {!loaded && <ActivityIndicator color={colors.accent} />}
        </View>
      </Screen>
    );
  }

  const dateLabel = new Date(entry.date).toLocaleDateString(
    language === 'tr' ? 'tr-TR' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <Screen colors={colors} edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.previewWrap}>
          <View ref={cardRef} collapsable={false}>
            <ShareCard
              entry={entry}
              category={category}
              photoUri={photoUri}
              format={format}
              dateLabel={dateLabel}
              watermarkText={t.welcome.title}
            />
          </View>
        </View>

        <View
          style={[styles.formatSwitch, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Pressable
            style={[styles.formatItem, format === 'square' && { backgroundColor: colors.accent }]}
            onPress={() => setFormat('square')}
          >
            <Text
              style={[
                styles.formatText,
                { color: format === 'square' ? colors.accentText : colors.subtext },
              ]}
            >
              {t.shareEntry.square}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.formatItem, format === 'portrait' && { backgroundColor: colors.accent }]}
            onPress={() => setFormat('portrait')}
          >
            <Text
              style={[
                styles.formatText,
                { color: format === 'portrait' ? colors.accentText : colors.subtext },
              ]}
            >
              {t.shareEntry.portrait}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.shareButton,
            { backgroundColor: colors.accent, opacity: pressed || sharing ? 0.85 : 1 },
          ]}
          disabled={sharing}
          onPress={handleShare}
        >
          {sharing ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={[styles.shareButtonText, { color: colors.accentText }]}>
              {t.shareEntry.shareButton}
            </Text>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  previewWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  formatSwitch: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    width: '100%',
    maxWidth: 320,
  },
  formatItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  formatText: {
    fontSize: 14,
    fontWeight: '700',
  },
  shareButton: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
