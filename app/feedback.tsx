import { useState } from 'react';
import {
  Alert,
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
import Screen from '../components/Screen';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { submitFeedback, FEEDBACK_NOT_CONFIGURED } from '../lib/supabase/feedback';

export default function FeedbackScreen() {
  const { colors } = useTheme();
  const t = useT();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert(t.feedbackForm.errorTitle, t.feedbackForm.messageRequired);
      return;
    }
    setSending(true);
    try {
      await submitFeedback({ message, email: email.trim() || null });
      setMessage('');
      setEmail('');
      setSent(true);
    } catch (error) {
      console.error('Geri bildirim gönderilemedi:', error);
      const isNotConfigured = error instanceof Error && error.message === FEEDBACK_NOT_CONFIGURED;
      Alert.alert(
        t.feedbackForm.errorTitle,
        isNotConfigured ? t.feedbackForm.notConfigured : t.feedbackForm.errorMessage
      );
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Screen colors={colors} edges={['bottom']}>
        <View style={styles.successWrap}>
          <Ionicons name="checkmark-circle" size={56} color={colors.accent} />
          <Text style={[styles.successTitle, { color: colors.text }]}>
            {t.feedbackForm.successTitle}
          </Text>
          <Text style={[styles.successMessage, { color: colors.subtext }]}>
            {t.feedbackForm.successMessage}
          </Text>
          <Pressable
            style={[styles.submitButton, { backgroundColor: colors.accent }]}
            onPress={() => setSent(false)}
          >
            <Text style={[styles.submitText, { color: colors.accentText }]}>
              {t.feedbackForm.title}
            </Text>
          </Pressable>
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
          <Text style={[styles.label, { color: colors.subtext }]}>
            {t.feedbackForm.messageLabel}
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            multiline
            placeholder={t.feedbackForm.messagePlaceholder}
            placeholderTextColor={colors.subtext}
            value={message}
            onChangeText={setMessage}
          />

          <Text style={[styles.label, { color: colors.subtext }]}>
            {t.feedbackForm.emailLabel}
          </Text>
          <TextInput
            style={[
              styles.emailInput,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            placeholder={t.feedbackForm.emailPlaceholder}
            placeholderTextColor={colors.subtext}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: colors.accent, opacity: pressed || sending ? 0.85 : 1 },
            ]}
            disabled={sending}
            onPress={handleSubmit}
          >
            <Text style={[styles.submitText, { color: colors.accentText }]}>
              {sending ? t.feedbackForm.sending : t.feedbackForm.submit}
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
  container: {
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  input: {
    minHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  emailInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  submitButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
  },
  successMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
});
