import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Screen from '../../components/Screen';
import BackupSection from '../../components/BackupSection';
import { useTheme } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { useAuthStore } from '../../lib/store/authStore';
import { useProfileStore } from '../../lib/store/profileStore';
import { useCloudProfileStore } from '../../lib/store/cloudProfileStore';
import { pickAndProcessPhoto } from '../../lib/photoPicker';
import { getProfile } from '../../lib/supabase/profiles';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  // Oturumsuz (misafir/dev bypass) kullanım için hâlâ tamamen yerel, hesap gerektirmeyen ad/fotoğraf.
  const avatarUri = useProfileStore((s) => s.avatarUri);
  const displayName = useProfileStore((s) => s.displayName);
  const setAvatarUri = useProfileStore((s) => s.setAvatarUri);
  const setDisplayName = useProfileStore((s) => s.setDisplayName);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName ?? '');

  // Oturum varken gerçek kaynak: Supabase'teki profiles satırı.
  const cloudProfile = useCloudProfileStore((s) => s.profile);
  const setCloudProfile = useCloudProfileStore((s) => s.setProfile);

  useEffect(() => {
    if (!session) {
      setCloudProfile(null);
      return;
    }
    getProfile(session.user.id)
      .then((profile) =>
        setCloudProfile({ name: profile?.name ?? null, avatarUrl: profile?.avatar_url ?? null })
      )
      .catch((error) => console.error('Profil yüklenemedi:', error));
  }, [session, setCloudProfile]);

  const emailPrefix = session?.user.email?.split('@')[0] ?? t.profile.guest;
  const shownName = session ? cloudProfile?.name || emailPrefix : displayName || t.profile.guest;
  const shownAvatarUri = session ? cloudProfile?.avatarUrl ?? null : avatarUri;

  const handleAvatarPress = () => {
    if (session) {
      router.push('/edit-profile');
    } else {
      handleChangePhoto();
    }
  };

  const handleChangePhoto = async () => {
    try {
      const uri = await pickAndProcessPhoto('library', {
        permissionTitle: t.entryForm.permissionTitle,
        permissionMessage: t.entryForm.permissionMessage,
      });
      if (uri) setAvatarUri(uri);
    } catch (error) {
      console.error('Profil fotoğrafı ayarlanamadı:', error);
    }
  };

  const handleSaveName = () => {
    setDisplayName(nameDraft.trim() || null);
    setEditingName(false);
  };

  return (
    <Screen colors={colors} title={t.tabs.profile}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable style={styles.avatarWrap} onPress={handleAvatarPress}>
          {shownAvatarUri ? (
            <Image source={{ uri: shownAvatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accent }]}>
              <Text style={[styles.avatarInitial, { color: colors.accentText }]}>
                {shownName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={[styles.avatarBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="pencil" size={12} color={colors.text} />
          </View>
        </Pressable>

        {session ? (
          <Pressable onPress={() => router.push('/edit-profile')}>
            <Text style={[styles.name, { color: colors.text }]}>{shownName}</Text>
          </Pressable>
        ) : editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={[styles.nameInput, { borderColor: colors.border, color: colors.text }]}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder={t.profile.namePlaceholder}
              placeholderTextColor={colors.subtext}
              autoFocus
              onSubmitEditing={handleSaveName}
            />
            <Pressable onPress={handleSaveName}>
              <Text style={[styles.saveText, { color: colors.accent }]}>{t.profile.save}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setNameDraft(displayName ?? '');
              setEditingName(true);
            }}
          >
            <Text style={[styles.name, { color: colors.text }]}>{shownName}</Text>
          </Pressable>
        )}

        {session ? (
          <Text style={[styles.email, { color: colors.subtext }]}>{session.user.email}</Text>
        ) : (
          <Pressable onPress={() => router.push('/sign-in')}>
            <Text style={[styles.email, { color: colors.accent }]}>{t.profile.notSignedIn}</Text>
          </Pressable>
        )}

        {session && (
          <Pressable
            style={[styles.settingsRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/edit-profile')}
          >
            <View style={styles.settingsRowLeft}>
              <Ionicons name="create-outline" size={20} color={colors.text} />
              <Text style={[styles.settingsRowText, { color: colors.text }]}>
                {t.profile.editProfileRow}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </Pressable>
        )}

        <Pressable
          style={[styles.settingsRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/stats')}
        >
          <View style={styles.settingsRowLeft}>
            <Ionicons name="stats-chart-outline" size={20} color={colors.text} />
            <Text style={[styles.settingsRowText, { color: colors.text }]}>
              {t.profile.statsRow}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
        </Pressable>

        <Pressable
          style={[styles.settingsRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/settings')}
        >
          <View style={styles.settingsRowLeft}>
            <Ionicons name="settings-outline" size={20} color={colors.text} />
            <Text style={[styles.settingsRowText, { color: colors.text }]}>
              {t.profile.settingsRow}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
        </Pressable>

        <BackupSection />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  avatarWrap: {
    marginTop: 8,
    marginBottom: 4,
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
  avatarInitial: {
    fontSize: 36,
    fontWeight: '800',
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
  name: {
    fontSize: 20,
    fontWeight: '800',
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '700',
    borderBottomWidth: 1,
    paddingVertical: 4,
    minWidth: 160,
    textAlign: 'center',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
  },
  email: {
    fontSize: 14,
    marginBottom: 12,
  },
  settingsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsRowText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
