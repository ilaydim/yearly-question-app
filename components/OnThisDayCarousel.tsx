import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category, Entry } from '../lib/db/types';
import type { Palette } from '../lib/theme';

const CARD_WIDTH = 240;
const CARD_GAP = 10;

function OnThisDayCard({
  entry,
  category,
  photoUri,
  colors,
  onPress,
}: {
  entry: Entry;
  category: Category | undefined;
  photoUri: string | undefined;
  colors: Palette;
  onPress: () => void;
}) {
  const year = entry.date.slice(0, 4);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { width: CARD_WIDTH, backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.year, { color: colors.accent }]}>{year}</Text>
        {category && (
          <View style={[styles.badge, { backgroundColor: category.color }]}>
            <Text style={styles.badgeText}>{category.name}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.content, { color: colors.text }]} numberOfLines={photoUri ? 3 : 4}>
          {entry.content}
        </Text>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.thumbnail} />}
      </View>
    </Pressable>
  );
}

interface OnThisDayCarouselProps {
  title: string;
  entries: Entry[];
  categories: Record<string, Category>;
  photos: Record<string, string>;
  colors: Palette;
  onPressEntry: (id: string) => void;
}

export default function OnThisDayCarousel({
  title,
  entries,
  categories,
  photos,
  colors,
  onPressEntry,
}: OnThisDayCarouselProps) {
  if (entries.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>{title}</Text>
      {entries.length === 1 ? (
        <View style={styles.singleCardWrap}>
          <OnThisDayCard
            entry={entries[0]}
            category={categories[entries[0].category_id]}
            photoUri={photos[entries[0].id]}
            colors={colors}
            onPress={() => onPressEntry(entries[0].id)}
          />
        </View>
      ) : (
        <FlatList
          data={entries}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          decelerationRate="fast"
          renderItem={({ item }) => (
            <OnThisDayCard
              entry={item}
              category={categories[item.category_id]}
              photoUri={photos[item.id]}
              colors={colors}
              onPress={() => onPressEntry(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    gap: CARD_GAP,
  },
  singleCardWrap: {},
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  year: {
    fontSize: 18,
    fontWeight: '800',
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardBody: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  content: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
});
