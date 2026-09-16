import { useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Screen from '../../components/Screen';
import MenuCard from '../../components/MenuCard';
import MenuRow from '../../components/MenuRow';
import BackupSection from '../../components/BackupSection';
import CapsuleSection from '../../components/CapsuleSection';
import YearWordSection from '../../components/YearWordSection';
import FutureLettersSection from '../../components/FutureLettersSection';
import SomedayListSection from '../../components/SomedayListSection';
import GoalsSection from '../../components/GoalsSection';
import WrappedSection from '../../components/WrappedSection';
import { useTheme } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { useAuthStore } from '../../lib/store/authStore';
import { useProfileStore } from '../../lib/store/profileStore';
import { useCloudProfileStore, useSyncCloudProfile } from '../../lib/store/cloudProfileStore';
import { pickAndProcessPhoto } from '../../lib/photoPicker';
import { useScrollHeader } from '../../lib/useScrollHeader';

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
  useSyncCloudProfile();

  const { scrollY, onScroll } = useScrollHeader();

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
    <Screen colors={colors} title={t.tabs.profile} scrollY={scrollY}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Animated.ScrollView
        contentContainerStyle={styles.container}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
            <View style={[styles.avatarBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
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
        </View>

        <YearWordSection />

        <Pressable
          style={({ pressed }) => [styles.premiumCard, { opacity: pressed ? 0.9 : 1 }]}
          onPress={() => router.push('/premium')}
        >
          <View style={[styles.premiumIconWrap, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Ionicons name="star" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.premiumTextWrap}>
            <Text style={styles.premiumTitle}>{t.profile.premiumRow}</Text>
            <Text style={styles.premiumSubtitle}>{t.profile.premiumRowSubtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>

        <CapsuleSection />

        <FutureLettersSection />

        <SomedayListSection />

        <GoalsSection />

        <WrappedSection />

        <MenuCard colors={colors}>
          {session && (
            <MenuRow
              icon="create-outline"
              label={t.profile.editProfileRow}
              onPress={() => router.push('/edit-profile')}
              colors={colors}
              showDivider
            />
          )}
          <MenuRow
            icon="stats-chart-outline"
            label={t.profile.statsRow}
            onPress={() => router.push('/stats')}
            colors={colors}
            showDivider
          />
          <MenuRow
            icon="settings-outline"
            label={t.profile.settingsRow}
            onPress={() => router.push('/settings')}
            colors={colors}
          />
        </MenuCard>

        <BackupSection />
      </Animated.ScrollView>
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
    alignItems: 'center',
    gap: 14,
  },
  heroCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
  },
  avatarWrap: {
    marginBottom: 4,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: '800',
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 19,
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
    fontSize: 13,
  },
  premiumCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#7C3AED',
  },
  premiumIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumTextWrap: {
    flex: 1,
    gap: 2,
  },
  premiumTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  premiumSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
});
