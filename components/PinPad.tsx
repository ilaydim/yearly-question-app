import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Palette } from '../lib/theme';

const PIN_LENGTH = 4;

// null = boş hücre (4. sıradaki sol boşluk, 0'ı ortalamak için).
const KEY_ROWS: Array<Array<string | null>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'backspace'],
];

interface PinPadProps {
  value: string;
  onChangeValue: (value: string) => void;
  onComplete?: (value: string) => void;
  colors: Palette;
  error?: boolean;
}

interface PinDotProps {
  filled: boolean;
  color: string;
}

// Dolan her nokta için hafif bir "pop" animasyonu (scale + fade); boşa dönüşte
// (backspace) animasyonsuz, anında sıfırlanır.
function PinDot({ filled, color }: PinDotProps) {
  const anim = useRef(new Animated.Value(filled ? 1 : 0)).current;
  const wasFilled = useRef(filled);

  useEffect(() => {
    if (filled && !wasFilled.current) {
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }).start();
    } else if (!filled) {
      anim.setValue(0);
    }
    wasFilled.current = filled;
  }, [filled, anim]);

  if (!filled) {
    return <View style={[styles.dot, { borderColor: color, backgroundColor: 'transparent' }]} />;
  }

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          borderColor: color,
          backgroundColor: color,
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
        },
      ]}
    />
  );
}

interface PadKeyProps {
  value: string;
  colors: Palette;
  onPress: (value: string) => void;
}

// Dairesel tuş: basılı tutulunca hafif scale-down + arka plan renk geçişi.
// Native (scale) ve JS (backgroundColor) driver'lı animasyonlar AYNI Animated.View
// üzerinde karıştırılamıyor ("moved to native" hatası) — bu yüzden ikisi için
// iç içe iki Animated.View kullanıyoruz: dıştaki sadece scale, içteki sadece renk.
function PadKey({ value, colors, onPress }: PadKeyProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.9, friction: 6, useNativeDriver: true }).start();
    Animated.timing(pressAnim, { toValue: 1, duration: 90, useNativeDriver: false }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    Animated.timing(pressAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  const backgroundColor = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.card, colors.border],
  });

  return (
    <Pressable
      onPress={() => onPress(value)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={6}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Animated.View style={[styles.key, { backgroundColor, borderColor: colors.border }]}>
          {value === 'backspace' ? (
            <Ionicons name="backspace-outline" size={24} color={colors.text} />
          ) : (
            <Text style={[styles.keyLabel, { color: colors.text }]}>{value}</Text>
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default function PinPad({ value, onChangeValue, onComplete, colors, error = false }: PinPadProps) {
  useEffect(() => {
    if (value.length === PIN_LENGTH) onComplete?.(value);
  }, [value, onComplete]);

  const handlePress = (key: string) => {
    if (key === 'backspace') {
      onChangeValue(value.slice(0, -1));
      return;
    }
    if (value.length >= PIN_LENGTH) return;
    onChangeValue(value + key);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dotsRow}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < value.length || error;
          const color = error ? colors.danger : filled ? colors.accent : colors.border;
          return <PinDot key={i} filled={filled} color={color} />;
        })}
      </View>
      <View style={styles.keypad}>
        {KEY_ROWS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((key, ki) =>
              key === null ? (
                <View key={ki} style={styles.keySpacer} />
              ) : (
                <PadKey key={ki} value={key} colors={colors} onPress={handlePress} />
              )
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 28,
    marginBottom: 8,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  keypad: {
    marginTop: 28,
    gap: 16,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keySpacer: {
    width: 72,
    height: 72,
  },
  keyLabel: {
    fontSize: 26,
    fontWeight: '600',
  },
});
