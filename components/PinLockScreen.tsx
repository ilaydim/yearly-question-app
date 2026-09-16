import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Screen from './Screen';
import PinPad from './PinPad';
import { useTheme } from '../lib/theme';
import { TITLE_FONT_FAMILY } from '../lib/fonts';
import { useT } from '../lib/i18n';
import { useAuthStore } from '../lib/store/authStore';
import { verifyPin, setPin } from '../lib/security/pin';
import { signInWithEmail } from '../lib/supabase/auth';

type Stage = 'enter' | 'forgot' | 'reset';
type ResetSubStage = 'enter' | 'confirm';

// LinearGradient renk duraklarını RGBA alfa ile karıştırmak (ör. `${accent}22`)
// aradaki durağı YARI SAYDAM yapar — üstündeki her şeyin arkasından geçmişteki
// ekran (bu durumda ana sayfa) görünür hale gelir. Bunun yerine iki tam OPAK
// rengi RGB uzayında karıştırıp yine tam opak bir sonuç üretiyoruz.
function mixOpaqueHex(base: string, tint: string, ratio: number): string {
  const b = parseInt(base.slice(1), 16);
  const t = parseInt(tint.slice(1), 16);
  const mix = (shift: number) => {
    const bc = (b >> shift) & 255;
    const tc = (t >> shift) & 255;
    return Math.round(bc + (tc - bc) * ratio);
  };
  const [r, g, bl] = [16, 8, 0].map(mix);
  return `#${[r, g, bl].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

interface PinLockScreenProps {
  onUnlock: () => void;
}

export default function PinLockScreen({ onUnlock }: PinLockScreenProps) {
  const { colors } = useTheme();
  const t = useT();
  const session = useAuthStore((s) => s.session);

  const [stage, setStage] = useState<Stage>('enter');

  // 'enter' state
  const [enterValue, setEnterValue] = useState('');
  const [enterError, setEnterError] = useState(false);

  // 'forgot' state
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // 'reset' state
  const [resetSubStage, setResetSubStage] = useState<ResetSubStage>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [resetValue, setResetValue] = useState('');
  const [resetError, setResetError] = useState(false);

  const handleVerifyEnter = useCallback(
    async (pin: string) => {
      const ok = await verifyPin(pin);
      if (ok) {
        onUnlock();
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setEnterError(true);
      setTimeout(() => {
        setEnterValue('');
        setEnterError(false);
      }, 400);
    },
    [onUnlock]
  );

  const handleVerifyPassword = useCallback(async () => {
    // session yoksa buraya hiç gelinmemeli (bkz. forgotLink'in görünürlük koşulu),
    // ama savunma amaçlı yine de kontrol ediyoruz.
    if (!session?.user.email || !password) return;
    setVerifying(true);
    setForgotError(null);
    try {
      // Kasıtlı olarak session'daki e-postayı kullanıyoruz, kullanıcının serbestçe
      // yazacağı bir e-posta alanı DEĞİL — aksi halde biri kendi (geçerli) Supabase
      // hesabıyla giriş yaparak BAŞKA birinin cihazındaki PIN kilidini sıfırlayabilirdi.
      // signInWithEmail zaten aynı hesap olduğu için authStore'daki session'ı da
      // (zararsızca) tazeler, hesap değişimi riski yok.
      await signInWithEmail(session.user.email, password);
      setPassword('');
      setStage('reset');
    } catch (error) {
      console.error('Kimlik doğrulanamadı:', error);
      setForgotError(t.pinLock.wrongPassword);
    } finally {
      setVerifying(false);
    }
  }, [session, password, t]);

  const resetReset = () => {
    setResetSubStage('enter');
    setFirstPin('');
    setResetValue('');
  };

  const handleResetComplete = useCallback(
    async (pin: string) => {
      if (resetSubStage === 'enter') {
        setFirstPin(pin);
        setResetValue('');
        setResetSubStage('confirm');
        return;
      }
      if (pin !== firstPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setResetError(true);
        setTimeout(() => {
          resetReset();
          setResetError(false);
        }, 400);
        return;
      }
      try {
        await setPin(pin);
        onUnlock();
      } catch (error) {
        console.error('Yeni PIN kaydedilemedi:', error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setResetError(true);
        setTimeout(() => {
          resetReset();
          setResetError(false);
        }, 400);
      }
    },
    [resetSubStage, firstPin, onUnlock]
  );

  // Screen'in kendi solid arka planı yerine gradyanın görünmesi için sadece bu
  // ekrandaki kopyada bg'yi şeffaf yapıyoruz; text/subtext vb. diğer renkler aynı kalıyor.
  const screenColors = { ...colors, bg: 'transparent' };

  return (
    <View style={styles.overlay}>
      <LinearGradient
        colors={[colors.bg, mixOpaqueHex(colors.bg, colors.accent, 0.16), colors.bg]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Screen colors={screenColors} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {stage === 'enter' && (
            <View style={styles.centered}>
              <Text style={[styles.brand, { color: colors.text }]}>{t.welcome.title}</Text>
              <Text style={[styles.title, { color: colors.text }]}>{t.pinLock.lockTitle}</Text>
              <Text style={[styles.subtitle, { color: colors.subtext }]}>
                {t.pinLock.enterPinPrompt}
              </Text>
              <PinPad
                value={enterValue}
                onChangeValue={setEnterValue}
                onComplete={handleVerifyEnter}
                colors={colors}
                error={enterError}
              />
              {session && (
                <Pressable style={styles.linkButton} onPress={() => setStage('forgot')}>
                  <Text style={[styles.link, { color: colors.accent }]}>{t.pinLock.forgotPin}</Text>
                </Pressable>
              )}
            </View>
          )}

          {stage === 'forgot' && (
            <View style={styles.centered}>
              <Text style={[styles.title, { color: colors.text }]}>{t.pinLock.forgotPinTitle}</Text>
              <Text style={[styles.subtitle, { color: colors.subtext }]}>
                {t.pinLock.forgotPinDescription}
              </Text>
              <Text style={[styles.email, { color: colors.text }]}>{session?.user.email}</Text>
              <TextInput
                style={[
                  styles.passwordInput,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholder={t.pinLock.passwordPlaceholder}
                placeholderTextColor={colors.subtext}
                secureTextEntry
                value={password}
                onChangeText={(v) => {
                  setForgotError(null);
                  setPassword(v);
                }}
                autoFocus
              />
              {forgotError && (
                <Text style={[styles.error, { color: colors.danger }]}>{forgotError}</Text>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.verifyButton,
                  { backgroundColor: colors.accent, opacity: pressed || verifying ? 0.85 : 1 },
                ]}
                disabled={verifying || !password}
                onPress={handleVerifyPassword}
              >
                {verifying ? (
                  <ActivityIndicator color={colors.accentText} />
                ) : (
                  <Text style={[styles.verifyButtonText, { color: colors.accentText }]}>
                    {t.pinLock.verify}
                  </Text>
                )}
              </Pressable>
              <Pressable
                style={styles.linkButton}
                onPress={() => {
                  setStage('enter');
                  setPassword('');
                  setForgotError(null);
                }}
              >
                <Text style={[styles.link, { color: colors.subtext }]}>{t.pinLock.backToPin}</Text>
              </Pressable>
            </View>
          )}

          {stage === 'reset' && (
            <View style={styles.centered}>
              <Text style={[styles.title, { color: colors.text }]}>{t.pinLock.setNewPinTitle}</Text>
              <Text style={[styles.subtitle, { color: colors.subtext }]}>
                {resetSubStage === 'enter' ? t.pinLock.enterNewPin : t.pinLock.confirmPin}
              </Text>
              <PinPad
                value={resetValue}
                onChangeValue={(v) => {
                  setResetError(false);
                  setResetValue(v);
                }}
                onComplete={handleResetComplete}
                colors={colors}
                error={resetError}
              />
              {resetError && (
                <Text style={[styles.error, { color: colors.danger }]}>{t.pinLock.mismatch}</Text>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  brand: {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 30,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  email: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  passwordInput: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
  verifyButton: {
    alignSelf: 'stretch',
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 20,
    padding: 8,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
});
