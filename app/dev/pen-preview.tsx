import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import Screen from '../../components/Screen';
import PenWritingAnimation from '../../components/PenWritingAnimation';
import { useTheme } from '../../lib/theme';

export default function PenPreviewScreen() {
  const { colors } = useTheme();
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [playCount, setPlayCount] = useState(0);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const ref = useRef<LottieView>(null);

  const replay = () => {
    setFinishedAt(null);
    ref.current?.reset();
    ref.current?.play();
    setPlayCount((n) => n + 1);
  };

  return (
    <Screen colors={colors} title="Kalem Animasyonu">
      <View style={styles.container}>
        <View style={[styles.stage, { backgroundColor: scheme === 'light' ? '#FFF9EC' : '#2A2419' }]}>
          <PenWritingAnimation
            ref={ref}
            scheme={scheme}
            autoPlay
            loop={false}
            onAnimationFinish={() => setFinishedAt(Date.now())}
            style={styles.animation}
          />
        </View>

        <Text style={[styles.info, { color: colors.text }]}>Oynatma sayısı: {playCount + 1}</Text>
        <Text style={[styles.info, { color: colors.subtext }]}>
          {finishedAt ? 'Bitti ✓' : 'Oynuyor…'}
        </Text>

        <View style={styles.row}>
          <Pressable
            style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setScheme(scheme === 'light' ? 'dark' : 'light')}
          >
            <Text style={[styles.buttonText, { color: colors.text }]}>
              {scheme === 'light' ? 'Dark moda geç' : 'Light moda geç'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.button, { backgroundColor: colors.accent }]}
            onPress={replay}
          >
            <Text style={[styles.buttonText, { color: colors.accentText }]}>Tekrar Oynat</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  stage: {
    width: '100%',
    aspectRatio: 300 / 200,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  animation: {
    width: '90%',
    height: '90%',
  },
  info: {
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
