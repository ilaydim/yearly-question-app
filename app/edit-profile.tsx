import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useAuthStore } from '../lib/store/authStore';
import { useCloudProfileStore } from '../lib/store/cloudProfileStore';
import { pickAndProcessPhoto } from '../lib/photoPicker';
import { getProfile, updateProfile, uploadAvatar, PROFILES_NOT_CONFIGURED } from '../lib/supabase/profiles';

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const cloudProfile = useCloudProfileStore((s) => s.profile);
  const setCloudProfile = useCloudProfileStore((s) => s.setProfile);

  const [loading, setLoading] = useState(!cloudProfile);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(cloudProfile?.name ?? '');
  const [remoteAvatarUrl, setRemoteAvatarUrl] = useState<string | null>(
    cloudProfile?.avatarUrl ?? null
  );
  const [pickedAvatarUri, setPickedAvatarUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || cloudProfile) return;
    setLoading(true);
    getProfile(session.user.id)
      .then((profile) => {
        setName(profile?.name ?? '');
        setRemoteAvatarUrl(profile?.avatar_url ?? null);
      })
      .catch((err) => {
        console.error('Profil yüklenemedi:', err);
        setError(t.editProfile.loadError);
      })
      .finally(() => setLoading(false));
  }, [session, cloudProfile, t]);

  const handleChangePhoto = async () => {
    try {
      const uri = await pickAndProcessPhoto('library', {
        permissionTitle: t.entryForm.permissionTitle,
        permissionMessage: t.entryForm.permissionMessage,
      });
      if (uri) setPickedAvatarUri(uri);
    } catch (err) {
      console.error('Fotoğraf seçilemedi:', err);
    }
  };

  const handleSave = async () => {
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      let avatarUrl = remoteAvatarUrl;
      if (pickedAvatarUri) {
        avatarUrl = await uploadAvatar(session.user.id, pickedAvatarUri);
      }
      const trimmedName = name.trim() || null;
      await updateProfile(session.user.id, { name: trimmedName, avatar_url: avatarUrl });
      setCloudProfile({ name: trimmedName, avatarUrl });
      router.back();
    } catch (err) {
      console.error('Profil kaydedilemedi:', err);
      const notConfigured = err instanceof Error && err.message === PROFILES_NOT_CONFIGURED;
      setError(notConfigured ? t.editProfile.notConfigured : t.editProfile.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (!session) {
    return (
      <Screen colors={colors} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={[styles.info, { color: colors.subtext }]}>
            {t.editProfile.signInRequired}
          </Text>
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen colors={colors} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const shownAvatar = pickedAvatarUri ?? remoteAvatarUrl;

  return (
    <Screen colors={colors} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.subtext }]}>{t.editProfile.photoLabel}</Text>
          <Pressable style={styles.avatarWrap} onPress={handleChangePhoto}>
            {shownAvatar ? (
              <Image source={{ uri: shownAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accent }]}>
                <Ionicons name="person" size={36} color={colors.accentText} />
              </View>
            )}
            <View
              style={[styles.avatarBadge, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="camera" size={14} color={colors.text} />
            </View>
          </Pressable>
          <Pressable onPress={handleChangePhoto}>
            <Text style={[styles.changePhotoText, { color: colors.accent }]}>
              {t.editProfile.changePhoto}
            </Text>
          </Pressable>

          <Text style={[styles.label, { color: colors.subtext }]}>{t.editProfile.nameLabel}</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            placeholder={t.editProfile.namePlaceholder}
            placeholderTextColor={colors.subtext}
            value={name}
            onChangeText={setName}
          />

          {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: colors.accent, opacity: pressed || saving ? 0.85 : 1 },
            ]}
            disabled={saving}
            onPress={handleSave}
          >
            <Text style={[styles.submitText, { color: colors.accentText }]}>
              {saving ? t.editProfile.saving : t.editProfile.save}
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
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  label: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
  avatarWrap: {
    marginTop: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  input: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  error: {
    alignSelf: 'stretch',
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    alignSelf: 'stretch',
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
