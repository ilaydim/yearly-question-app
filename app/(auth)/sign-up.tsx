import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import RingsIcon from '../../components/RingsIcon';
import { signUpWithEmail } from '../../lib/supabase/auth';
import { updateProfile } from '../../lib/supabase/profiles';
import { usePendingProfileStore } from '../../lib/store/pendingProfileStore';
import { GENDER_OPTIONS, type Gender } from '../../lib/gender';
import { toDateString } from '../../lib/date';
import { useTheme } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { useSettingsStore } from '../../lib/store/settingsStore';

export default function SignUpScreen() {
  // sign-in.tsx'teki gibi: scheme'i useTheme()'den al ve RingsIcon'a explicit ver,
  // yoksa ikon Ayarlar'daki manuel tema tercihini değil ham cihaz ayarını izler.
  const { colors, scheme } = useTheme();
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t.auth.nameRequired);
      return;
    }
    if (!birthDate) {
      setError(t.auth.birthDateRequired);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.auth.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      const birthDateStr = toDateString(birthDate);
      const data = await signUpWithEmail(email.trim(), password);
      if (data.session) {
        await updateProfile(data.session.user.id, {
          name: trimmedName,
          birth_date: birthDateStr,
          gender,
        });
      } else {
        usePendingProfileStore.getState().setPending({
          name: trimmedName,
          birthDate: birthDateStr,
          gender,
        });
        setInfo(t.auth.confirmEmail);
      }
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

  const formatDate = (d: Date) =>
    d.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  return (
    <Screen colors={colors} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.iconWrap}>
        <RingsIcon size={96} scheme={scheme} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{t.auth.signUpTitle}</Text>

      <TextInput
        style={inputStyle}
        placeholder={t.auth.namePlaceholder}
        placeholderTextColor={colors.subtext}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={inputStyle}
        placeholder={t.auth.email}
        placeholderTextColor={colors.subtext}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Pressable
        style={[inputStyle, styles.dateButton]}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={{ color: birthDate ? colors.text : colors.subtext, fontSize: 15 }}>
          {birthDate ? formatDate(birthDate) : t.auth.birthDatePlaceholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.subtext} />
      </Pressable>
      {showDatePicker && (
        <DateTimePicker
          value={birthDate ?? new Date()}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(_event, selected) => {
            setShowDatePicker(false);
            if (selected) setBirthDate(selected);
          }}
        />
      )}

      <Text style={[styles.genderLabel, { color: colors.subtext }]}>{t.auth.genderLabel}</Text>
      <View style={styles.genderRow}>
        {GENDER_OPTIONS.map((option) => {
          const selected = gender === option;
          return (
            <Pressable
              key={option}
              style={[
                styles.genderChip,
                { borderColor: colors.border },
                selected && { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
              onPress={() => setGender(selected ? null : option)}
            >
              <Text
                style={[
                  styles.genderChipText,
                  { color: selected ? colors.accentText : colors.text },
                ]}
              >
                {t.gender[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={inputStyle}
        placeholder={t.auth.password}
        placeholderTextColor={colors.subtext}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={inputStyle}
        placeholder={t.auth.confirmPasswordPlaceholder}
        placeholderTextColor={colors.subtext}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      {passwordsMismatch && (
        <Text style={[styles.error, { color: colors.danger }]}>{t.auth.passwordMismatch}</Text>
      )}

      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
      {info && <Text style={[styles.info, { color: colors.subtext }]}>{info}</Text>}

      <Pressable
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: colors.accent, opacity: pressed || loading || passwordsMismatch ? 0.85 : 1 },
        ]}
        onPress={handleSubmit}
        disabled={loading || passwordsMismatch}
      >
        <Text style={[styles.ctaText, { color: colors.accentText }]}>{t.auth.registerCta}</Text>
      </Pressable>

      <Link href="/sign-in" style={[styles.link, { color: colors.accent }]}>
        {t.auth.haveAccount}
      </Link>
    </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  genderLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: -6,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  genderChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  info: {
    fontSize: 13,
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
