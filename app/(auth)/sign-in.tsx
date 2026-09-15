import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Link } from 'expo-router';
import Screen from '../../components/Screen';
import { signInWithEmail } from '../../lib/supabase/auth';
import { useTheme } from '../../lib/theme';
import { useT } from '../../lib/i18n';

export default function SignInScreen() {
  const { colors } = useTheme();
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
  ];

  return (
    <Screen colors={colors} edges={['top', 'bottom']}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.text }]}>{t.auth.signInTitle}</Text>

      <TextInput
        style={inputStyle}
        placeholder={t.auth.email}
        placeholderTextColor={colors.subtext}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={inputStyle}
        placeholder={t.auth.password}
        placeholderTextColor={colors.subtext}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

      <Pressable
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: colors.accent, opacity: pressed || loading ? 0.85 : 1 },
        ]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={[styles.ctaText, { color: colors.accentText }]}>{t.auth.loginCta}</Text>
      </Pressable>

      <Link href="/sign-up" style={[styles.link, { color: colors.accent }]}>
        {t.auth.noAccount}
      </Link>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  cta: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});
