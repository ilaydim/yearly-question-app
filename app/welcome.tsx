import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useSettingsStore } from '../lib/store/settingsStore';

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const t = useT();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const handleStart = () => {
    completeOnboarding();
  };

  return (
    <Screen colors={colors} edges={['top', 'bottom']}>
      <View style={styles.container}>
      <Animated.View
        style={[styles.content, { opacity: fade, transform: [{ translateY: rise }] }]}
      >
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={styles.badgeText}>📖</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t.welcome.title}</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>{t.welcome.subtitle}</Text>
      </Animated.View>
      <Pressable
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={handleStart}
      >
        <Text style={[styles.ctaText, { color: colors.accentText }]}>{t.welcome.cta}</Text>
      </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
    gap: 40,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  cta: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
