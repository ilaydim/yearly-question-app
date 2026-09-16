import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Palette } from '../lib/theme';
import { TITLE_FONT_FAMILY } from '../lib/fonts';

interface ScreenProps {
  children?: ReactNode;
  colors: Palette;
  title?: string;
  // useScrollHeader()'dan gelir. NOT: kaydırmayla küçülme davranışı şu an
  // SCROLL_COLLAPSE_ENABLED ile kapalı (bkz. aşağısı) — bu prop yine de kabul
  // ediliyor ki ekranlar onScroll'u bağlamaya devam edebilsin, davranış ileride
  // tek bir yerden (bu dosyadaki sabiti true yaparak) geri açılabilsin.
  scrollY?: Animated.Value;
  onBack?: () => void;
  headerRight?: ReactNode;
  edges?: Edge[];
}

// Kapalı: başlık artık scroll'dan bağımsız her zaman aynı (büyük) boyutta kalıyor.
// true yapılırsa büyük başlık kaydırmayla küçülüp altındaki compact bar'a döner.
const SCROLL_COLLAPSE_ENABLED = false;
const COLLAPSE_DISTANCE = 44;
const HEADER_STACK_HEIGHT = 52;

export default function Screen({
  children,
  colors,
  title,
  scrollY: scrollYProp,
  onBack,
  headerRight,
  edges = ['top'],
}: ScreenProps) {
  const fallbackScrollY = useRef(new Animated.Value(0)).current;
  const scrollY = scrollYProp ?? fallbackScrollY;

  const largeOpacity = SCROLL_COLLAPSE_ENABLED
    ? scrollY.interpolate({
        inputRange: [0, COLLAPSE_DISTANCE * 0.6],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      })
    : 1;
  const largeTranslateY = SCROLL_COLLAPSE_ENABLED
    ? scrollY.interpolate({
        inputRange: [0, COLLAPSE_DISTANCE],
        outputRange: [0, -8],
        extrapolate: 'clamp',
      })
    : 0;
  const largeScale = SCROLL_COLLAPSE_ENABLED
    ? scrollY.interpolate({
        inputRange: [0, COLLAPSE_DISTANCE],
        outputRange: [1, 0.9],
        extrapolate: 'clamp',
      })
    : 1;
  const compactOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE_DISTANCE * 0.5, COLLAPSE_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const showHeader = !!(title || headerRight || onBack);

  return (
    <SafeAreaView edges={edges} style={[styles.container, { backgroundColor: colors.bg }]}>
      {showHeader && (
        // Arka plan içerikle birebir aynı (colors.bg) — ayrım, sabit bir hex değil,
        // border token'ının neredeyse şeffaf (%25 alfa) bir varyantından gelen ince
        // bir çizgiyle sağlanıyor; palet değişince o da otomatik uyum sağlıyor.
        <View
          style={[
            styles.headerStack,
            { backgroundColor: colors.bg, borderBottomColor: `${colors.border}40` },
          ]}
        >
          <Animated.View
            style={[
              styles.largeHeader,
              {
                opacity: largeOpacity,
                transform: [{ translateY: largeTranslateY }, { scale: largeScale }],
              },
            ]}
          >
            <View style={styles.largeHeaderRow}>
              <View style={styles.largeTitleRow}>
                {onBack && (
                  <Pressable hitSlop={10} onPress={onBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                  </Pressable>
                )}
                {title && (
                  <Text style={[styles.largeTitle, { color: colors.text }]} numberOfLines={1}>
                    {title}
                  </Text>
                )}
              </View>
            </View>
          </Animated.View>

          {SCROLL_COLLAPSE_ENABLED && title && (
            <Animated.View
              pointerEvents="none"
              style={[styles.compactBar, { backgroundColor: colors.bg, opacity: compactOpacity }]}
            >
              {onBack && (
                <Ionicons
                  name="chevron-back"
                  size={22}
                  color={colors.text}
                  style={styles.compactBackIcon}
                />
              )}
              <Text style={[styles.compactTitle, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
            </Animated.View>
          )}

          {headerRight && <View style={styles.headerRightSlot}>{headerRight}</View>}
        </View>
      )}
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerStack: {
    height: HEADER_STACK_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  largeHeader: {
    gap: 6,
  },
  largeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  largeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  backButton: {
    marginLeft: -8,
    marginRight: -2,
  },
  largeTitle: {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 26,
    flexShrink: 1,
  },
  compactBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  compactBackIcon: {
    position: 'absolute',
    left: 16,
  },
  compactTitle: {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 17,
  },
  headerRightSlot: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
