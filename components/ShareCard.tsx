import { Image, StyleSheet, Text, View } from 'react-native';
import type { Category, Entry } from '../lib/db/types';

export type ShareFormat = 'square' | 'portrait';

export const SHARE_CARD_WIDTH = 320;

export function shareCardHeight(format: ShareFormat): number {
  return format === 'square' ? SHARE_CARD_WIDTH : Math.round((SHARE_CARD_WIDTH * 16) / 9);
}

interface ShareCardProps {
  entry: Entry;
  category: Category | undefined;
  photoUri: string | null;
  format: ShareFormat;
  dateLabel: string;
  watermarkText: string;
}

// Paylaşım için yakalanacak asıl görsel — react-native-view-shot bu View'in ref'ini
// yakalıyor, bu yüzden burada hiçbir yerde ScrollView/kırpma kullanmıyoruz: her şey
// sabit boyutlu bir kutunun içinde, taşan metin numberOfLines ile kesiliyor.
export default function ShareCard({
  entry,
  category,
  photoUri,
  format,
  dateLabel,
  watermarkText,
}: ShareCardProps) {
  const height = shareCardHeight(format);

  return (
    <View style={[styles.card, { width: SHARE_CARD_WIDTH, height }]}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.background} resizeMode="cover" />
      ) : (
        <View
          style={[styles.background, { backgroundColor: category?.color ?? '#4F46E5' }]}
        />
      )}

      <View style={[styles.textPanel, photoUri ? styles.textPanelBottom : styles.textPanelFull]}>
        {category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{category.name}</Text>
          </View>
        )}
        <Text
          style={styles.content}
          numberOfLines={photoUri ? (format === 'square' ? 4 : 6) : format === 'square' ? 8 : 12}
        >
          {entry.content}
        </Text>
        <Text style={styles.date}>{dateLabel}</Text>
        <Text style={styles.watermark}>{watermarkText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#111',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  textPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    padding: 20,
    gap: 8,
  },
  textPanelBottom: {
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  textPanelFull: {
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 23,
  },
  date: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  watermark: {
    alignSelf: 'flex-end',
    marginTop: 4,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
  },
});
