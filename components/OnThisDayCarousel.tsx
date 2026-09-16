import { useEffect, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { TITLE_FONT_FAMILY } from '../lib/fonts';
import type { Category, Entry } from '../lib/db/types';
import type { Palette } from '../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DECK_HEIGHT = 168;
const MAX_STACK_DEPTH = 3;
const STACK_OFFSET_Y = 9;
const STACK_SCALE_STEP = 0.055;
const STACK_OPACITY_STEP = 0.22;
const STACK_FAN_ROTATE_DEG = 3.5;
const STACK_FAN_TRANSLATE_X = 8;
const SWIPE_DISMISS_DISTANCE = 100;
const SWIPE_DISMISS_VELOCITY = 800;
const SPRING_CONFIG = { damping: 18, stiffness: 220 };

function OnThisDayCardContent({
  entry,
  category,
  photoUri,
  colors,
}: {
  entry: Entry;
  category: Category | undefined;
  photoUri: string | undefined;
  colors: Palette;
}) {
  const year = entry.date.slice(0, 4);
  return (
    <>
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
    </>
  );
}

// Desteki tek bir kart: konumu (stackPosition — 0 önde, 1/2 arkada) her zaman
// entries dizisindeki gerçek sırayla değil, topIndex'e göre türetiliyor (bkz.
// OnThisDayCarousel), bu yüzden aynı entry.id'ye sahip React elemanı bir sonraki
// kart öne geçtiğinde konum değiştirip "arka sıraya" kayıyor, unmount olmuyor —
// depth animasyonu (useEffect + withSpring) bu geçişi yumuşatıyor.
function DeckCard({
  entry,
  category,
  photoUri,
  colors,
  stackPosition,
  swipeEnabled,
  dragX,
  onPress,
  onSwipedAway,
}: {
  entry: Entry;
  category: Category | undefined;
  photoUri: string | undefined;
  colors: Palette;
  stackPosition: number;
  swipeEnabled: boolean;
  // Sürüdeki TEK bir shared value — parent'ta oluşturuluyor, sadece o anki ön
  // kart yazıyor (isExiting/isFront ile korunuyor), ama her kart (ön ve arka)
  // her frame'de okuyor. Böylece arkadaki kartlar, önd eki kartın canlı sürükleme
  // ilerlemesine bir React re-render'ı beklemeden, aynı UI-thread frame'inde
  // senkron kalabiliyor (Semptom 1'in kök nedeni: eskiden arkadaki kartlar SADECE
  // stackPosition prop'u (yani commit sonrası) değişince spring'lenen kendi
  // `depth`'ine bakıyordu, sürüklemeden tamamen habersizdi).
  dragX: SharedValue<number>;
  onPress: () => void;
  onSwipedAway: () => void;
}) {
  const isFront = stackPosition === 0;

  const translateY = useSharedValue(0);
  const depth = useSharedValue(stackPosition);
  // Çıkış spring'i başladığı an true olur; stackPosition değişince (yeni bir
  // dinlenme konumuna geçince) sıfırlanır. Amaç: kart hâlâ ekrandan uçarken
  // (isFront/stackPosition commit'e kadar hâlâ eskisi gibi "ön kart" göründüğü
  // için) ikinci bir dokunuşun aynı gesture handler'ı tetikleyip çıkış spring'ini
  // sessizce iptal etmesini engellemek — Semptom 2'nin asıl nedeni buydu.
  const isExiting = useSharedValue(false);

  useEffect(() => {
    // withSpring (withTiming yerine): parmağı bıraktığın an başlayan çıkış fırlatmasıyla
    // aynı "fiziksel" hissi taşısın diye bir sonraki kartın öne kayışı da spring —
    // ikisi de aynı SPRING_CONFIG'i paylaşınca geçiş tek, akışkan bir hareket gibi hissettiriyor.
    depth.value = withSpring(stackPosition, SPRING_CONFIG);
    isExiting.value = false;
  }, [stackPosition, depth, isExiting]);

  const panGesture = Gesture.Pan()
    .enabled(isFront && swipeEnabled)
    .onUpdate((e) => {
      if (isExiting.value) return;
      // Worklet içinde, JS thread'e hiç geçmeden — parmakla bire bir, gecikmesiz.
      dragX.value = e.translationX;
      translateY.value = e.translationY * 0.12;
    })
    .onEnd((e) => {
      if (isExiting.value) return;
      const shouldDismiss =
        Math.abs(e.translationX) > SWIPE_DISMISS_DISTANCE ||
        Math.abs(e.velocityX) > SWIPE_DISMISS_VELOCITY;

      if (shouldDismiss) {
        isExiting.value = true;
        const direction = e.translationX < 0 ? -1 : 1;
        // Bu satır da worklet içinde (.onEnd zaten UI thread'de) çalışıyor — çıkış
        // animasyonu parmağı bıraktığın FRAME'de başlıyor, bir React re-render'ı
        // beklemiyor. topIndex state'i (runOnJS(onSwipedAway)) BİLEREK sadece
        // animasyon tamamen bitince güncelleniyor — aksi halde bu kart hâlâ ekrandan
        // uçarken deste yeniden dizilip stackPosition'ı değişir, iki animasyon aynı
        // anda çakışıp "sıçrama" gibi görünürdü. Gerçek velocity'yi (e.velocityX)
        // spring'e vermek, fırlatmayı parmağın hızına göre doğal hissettiriyor.
        dragX.value = withSpring(
          direction * SCREEN_WIDTH * 1.2,
          { ...SPRING_CONFIG, velocity: e.velocityX },
          (finished) => {
            if (finished) {
              // Kart artık ekran dışında — bir sonraki render'da (topIndex ilerleyince)
              // aynı kart deste'nin en arkasına dönecek, o yüzden pan değerlerini
              // burada, state güncellemesinden ÖNCE sıfırlıyoruz; aksi halde arkadaki
              // yeni konumunda bir an için "uçmuş" haliyle görünürdü.
              dragX.value = 0;
              translateY.value = 0;
              runOnJS(onSwipedAway)();
            }
          }
        );
      } else {
        dragX.value = withSpring(0, { ...SPRING_CONFIG, velocity: e.velocityX });
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const tapGesture = Gesture.Tap()
    .enabled(isFront)
    .maxDuration(250)
    .onEnd((_event, success) => {
      if (success && !isExiting.value) runOnJS(onPress)();
    });

  const gesture = Gesture.Race(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => {
    // Arkadaki kartlar için: ön kart ne kadar sürüklendiyse (ekran genişliğine
    // oranla) depth'ten o kadarını düş — stackPosition=1 olan kart, ön kart tam
    // ekran dışına çıkana dek depth 1 -> 0 arası akıcı şekilde öne kayar, parmak
    // geri çekilirse aynı şekilde geri yelken açar. Ön kartın kendi depth'i zaten
    // 0'da sabit olduğundan burada dokunulmuyor.
    const dragProgress = isFront ? 0 : Math.min(Math.abs(dragX.value) / SCREEN_WIDTH, 1);
    const d = Math.max(0, depth.value - dragProgress);

    const fanRotate = interpolate(d, [0, 1, 2], [0, -STACK_FAN_ROTATE_DEG, STACK_FAN_ROTATE_DEG]);
    const fanX = interpolate(d, [0, 1, 2], [0, -STACK_FAN_TRANSLATE_X, STACK_FAN_TRANSLATE_X]);
    const baseY = interpolate(d, [0, 1, 2], [0, STACK_OFFSET_Y, STACK_OFFSET_Y * 2]);
    const scale = interpolate(
      d,
      [0, 1, 2],
      [1, 1 - STACK_SCALE_STEP, 1 - STACK_SCALE_STEP * 2]
    );
    const opacity = interpolate(
      d,
      [0, 1, 2],
      [1, 1 - STACK_OPACITY_STEP, 1 - STACK_OPACITY_STEP * 2],
      Extrapolation.CLAMP
    );
    const panRotate = interpolate(
      dragX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-16, 0, 16],
      Extrapolation.CLAMP
    );
    const layer = MAX_STACK_DEPTH - d;

    return {
      opacity,
      zIndex: layer,
      elevation: layer,
      transform: [
        { translateX: fanX + (isFront ? dragX.value : 0) },
        { translateY: baseY + translateY.value },
        { rotate: `${fanRotate + panRotate}deg` },
        { scale },
      ],
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        pointerEvents={isFront ? 'auto' : 'none'}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, animatedStyle]}
      >
        <OnThisDayCardContent entry={entry} category={category} photoUri={photoUri} colors={colors} />
      </Animated.View>
    </GestureDetector>
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
  const [topIndex, setTopIndex] = useState(0);
  // Destedeki TÜM kartlar arasında paylaşılan tek shared value (bkz. DeckCard) —
  // hook kuralları gereği aşağıdaki erken `return null`'dan ÖNCE oluşturulmalı.
  const dragX = useSharedValue(0);

  // entries her gün yeniden hesaplanan bir liste (bkz. Ana Sayfa) — uzunluğu
  // değişirse (farklı bir güne geçilmesi gibi) topIndex'in artık anlamsız bir
  // konuma işaret etmesini önlüyoruz.
  useEffect(() => {
    setTopIndex(0);
  }, [entries.length]);

  if (entries.length === 0) return null;

  const n = entries.length;
  const visibleCount = Math.min(MAX_STACK_DEPTH, n);
  const stack = Array.from({ length: visibleCount }, (_, k) => ({
    entry: entries[(topIndex + k) % n],
    stackPosition: k,
  }));

  const handleSwipedAway = () => {
    setTopIndex((i) => (i + 1) % n);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="hourglass-outline" size={14} color={colors.accent} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <View style={styles.deck}>
        {stack.map(({ entry, stackPosition }) => (
          <DeckCard
            key={entry.id}
            entry={entry}
            category={entry.category_id ? categories[entry.category_id] : undefined}
            photoUri={photos[entry.id]}
            colors={colors}
            stackPosition={stackPosition}
            swipeEnabled={n > 1}
            dragX={dragX}
            onPress={() => onPressEntry(entry.id)}
            onSwipedAway={handleSwipedAway}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 18,
  },
  deck: {
    height: DECK_HEIGHT,
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    minHeight: DECK_HEIGHT - 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
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
