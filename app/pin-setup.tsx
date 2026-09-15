import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Screen from '../components/Screen';
import PinPad from '../components/PinPad';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { setPin } from '../lib/security/pin';
import { usePinLockStore } from '../lib/store/pinLockStore';

type Stage = 'enter' | 'confirm';

export default function PinSetupScreen() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const setPinEnabled = usePinLockStore((s) => s.setPinEnabled);

  const [stage, setStage] = useState<Stage>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const reset = () => {
    setStage('enter');
    setFirstPin('');
    setValue('');
  };

  const handleComplete = useCallback(
    async (pin: string) => {
      if (stage === 'enter') {
        setFirstPin(pin);
        setValue('');
        setStage('confirm');
        return;
      }

      if (pin !== firstPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(true);
        setTimeout(reset, 400);
        return;
      }

      try {
        await setPin(pin);
        setPinEnabled(true);
        router.back();
      } catch (err) {
        console.error('PIN kaydedilemedi:', err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(true);
        setTimeout(reset, 400);
      }
    },
    [stage, firstPin, setPinEnabled, router]
  );

  return (
    <Screen colors={colors} edges={['bottom']}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>{t.pinLock.setupTitle}</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          {stage === 'enter' ? t.pinLock.enterNewPin : t.pinLock.confirmPin}
        </Text>
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
        {error && <Text style={[styles.error, { color: colors.danger }]}>{t.pinLock.mismatch}</Text>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 12,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
});
