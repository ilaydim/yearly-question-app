import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Screen from '../components/Screen';
import PinPad from '../components/PinPad';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { clearPin, verifyPin } from '../lib/security/pin';
import { usePinLockStore } from '../lib/store/pinLockStore';

export default function PinDisableScreen() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const setPinEnabled = usePinLockStore((s) => s.setPinEnabled);

  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const handleComplete = useCallback(
    async (pin: string) => {
      try {
        const ok = await verifyPin(pin);
        if (!ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError(true);
          setTimeout(() => setValue(''), 400);
          return;
        }
        await clearPin();
        setPinEnabled(false);
        router.back();
      } catch (err) {
        console.error('Kilit kaldırılamadı:', err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(true);
        setTimeout(() => setValue(''), 400);
      }
    },
    [setPinEnabled, router]
  );

  return (
    <Screen colors={colors} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>{t.pinLock.disableTitle}</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>{t.pinLock.enterCurrentPin}</Text>
        <PinPad
          value={value}
          onChangeValue={(v) => {
            setError(false);
            setValue(v);
          }}
          onComplete={handleComplete}
          colors={colors}
          error={error}
        />
        {error && <Text style={[styles.error, { color: colors.danger }]}>{t.pinLock.wrongPin}</Text>}
      </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
});
