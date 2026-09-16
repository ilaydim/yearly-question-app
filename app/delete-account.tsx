import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Screen from '../components/Screen';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useAuthStore } from '../lib/store/authStore';
import { signInWithEmail } from '../lib/supabase/auth';
import { deleteOwnAccount, ACCOUNT_NOT_CONFIGURED } from '../lib/supabase/account';

type Stage = 'confirm' | 'deleting';

export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  const [stage, setStage] = useState<Stage>('confirm');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!session?.user.email || !password) return;
    setError(null);
    setStage('deleting');
    try {
      // Şifreyi doğrudan doğrulamanın bir API'si yok; PIN kilidi kurtarma akışındaki
      // (components/PinLockScreen.tsx) desenin aynısı — signInWithPassword başarılıysa
      // şifre doğrudur. Kasıtlı olarak session'daki e-postayı kullanıyoruz, kullanıcının
      // serbestçe yazacağı bir alan DEĞİL.
      await signInWithEmail(session.user.email, password);
      await deleteOwnAccount(session.user.id);
      router.replace('/sign-in');
    } catch (err) {
      console.error('Hesap silinemedi:', err);
      const notConfigured = err instanceof Error && err.message === ACCOUNT_NOT_CONFIGURED;
      setStage('confirm');
      setError(
        notConfigured
          ? t.deleteAccount.notConfigured
          : err instanceof Error && err.message.toLowerCase().includes('invalid')
            ? t.deleteAccount.wrongPassword
            : t.deleteAccount.errorMessage
      );
    }
  };

  if (!session) {
    return (
      <Screen colors={colors} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={[styles.info, { color: colors.subtext }]}>
            {t.deleteAccount.signInRequired}
          </Text>
        </View>
      </Screen>
    );
  }

  if (stage === 'deleting') {
    return (
      <Screen colors={colors} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.danger} size="large" />
          <Text style={[styles.info, { color: colors.subtext, marginTop: 16 }]}>
            {t.deleteAccount.deleting}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen colors={colors} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={[styles.iconWrap, { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="warning" size={32} color={colors.danger} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{t.deleteAccount.title}</Text>
          <Text style={[styles.warning, { color: colors.subtext }]}>
            {t.deleteAccount.warningMessage}
          </Text>

          <Text style={[styles.label, { color: colors.subtext }]}>
            {t.deleteAccount.passwordLabel}
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            placeholder={t.deleteAccount.passwordPlaceholder}
            placeholderTextColor={colors.subtext}
            secureTextEntry
            value={password}
            onChangeText={(v) => {
              setError(null);
              setPassword(v);
            }}
          />

          {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              { backgroundColor: colors.danger, opacity: pressed || !password ? 0.7 : 1 },
            ]}
            disabled={!password}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>{t.deleteAccount.confirmCta}</Text>
          </Pressable>

          <Pressable style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={[styles.cancelText, { color: colors.subtext }]}>
              {t.deleteAccount.cancel}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  info: {
    fontSize: 14,
    textAlign: 'center',
  },
  container: {
    padding: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  warning: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    alignSelf: 'stretch',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: {
    alignSelf: 'stretch',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  deleteButton: {
    alignSelf: 'stretch',
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    marginTop: 16,
    padding: 8,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
