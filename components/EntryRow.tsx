import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category, Entry } from '../lib/db/types';
import type { Palette } from '../lib/theme';

interface EntryRowProps {
  item: Entry;
  category: Category | undefined;
  photoUri?: string;
  colors: Palette;
  onPress: () => void;
  animate?: boolean;
}

export default function EntryRow({
  item,
  category,
  photoUri,
  colors,
  onPress,
  animate = true,
}: EntryRowProps) {
  const fade = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (animate) {
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }
  }, [animate, fade]);

  return (
    <Animated.View style={{ opacity: fade }}>
      <Pressable
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={onPress}
      >
        {photoUri && <Image source={{ uri: photoUri }} style={styles.thumbnail} />}
        <View style={styles.rowBody}>
          <View style={styles.rowHeader}>
            <Text style={[styles.date, { color: colors.subtext }]}>{item.date}</Text>
            {item.mood && <Text style={styles.mood}>{item.mood}</Text>}
          </View>
          <Text style={[styles.preview, { color: colors.text }]} numberOfLines={2}>
            {item.content.slice(0, 60)}
          </Text>
          {category && (
            <View style={styles.categoryTag}>
              <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              <Text style={[styles.categoryName, { color: colors.subtext }]}>{category.name}</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  rowBody: {
    flex: 1,
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
  },
  mood: {
    fontSize: 18,
  },
  preview: {
    fontSize: 15,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    fontSize: 12,
  },
});
