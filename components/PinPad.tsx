import { useEffect, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { Palette } from '../lib/theme';

const PIN_LENGTH = 4;

interface PinPadProps {
  value: string;
  onChangeValue: (value: string) => void;
  onComplete?: (value: string) => void;
  colors: Palette;
  error?: boolean;
  autoFocus?: boolean;
}

// Görünür dört nokta + üstlerinde görünmez bir TextInput: dokununca sistem sayısal
// klavyesi açılır, gerçek giriş kutusu hiç görünmez — yaygın "PIN dots" deseni.
export default function PinPad({
  value,
  onChangeValue,
  onComplete,
  colors,
  error = false,
  autoFocus = true,
}: PinPadProps) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (value.length === PIN_LENGTH) onComplete?.(value);
  }, [value, onComplete]);

  return (
    <View style={styles.wrap}>
      <View style={styles.dotsRow} pointerEvents="none">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < value.length;
          const dotColor = error ? colors.danger : filled ? colors.accent : colors.border;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: filled || error ? dotColor : 'transparent', borderColor: dotColor },
              ]}
            />
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={(text) => onChangeValue(text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
        keyboardType="number-pad"
        maxLength={PIN_LENGTH}
        secureTextEntry
        autoFocus={autoFocus}
        caretHidden
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 18,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
});
