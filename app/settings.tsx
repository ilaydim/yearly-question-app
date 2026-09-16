import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Screen from '../components/Screen';
import MenuCard from '../components/MenuCard';
import MenuRow from '../components/MenuRow';
import { useTheme, getPalette } from '../lib/theme';
import { useT } from '../lib/i18n';
import {
  useSettingsStore,
  PALETTE_KEYS,
  type Language,
  type PaletteKey,
  type ThemeMode,
} from '../lib/store/settingsStore';
import { useAuthStore } from '../lib/store/authStore';
import { useReminderStore } from '../lib/store/reminderStore';
import { usePinLockStore } from '../lib/store/pinLockStore';
import { clearPin } from '../lib/security/pin';
import { signOut } from '../lib/supabase/auth';
import { updateProfile } from '../lib/supabase/profiles';
import { useScrollHeader } from '../lib/useScrollHeader';
import {
  cancelDailyReminder,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  scheduleDailyReminder,
  type PermissionStatus,
} from '../lib/notifications';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const lightPalette = useSettingsStore((s) => s.lightPalette);
  const setLightPalette = useSettingsStore((s) => s.setLightPalette);
  const darkPalette = useSettingsStore((s) => s.darkPalette);
  const setDarkPalette = useSettingsStore((s) => s.setDarkPalette);
  const session = useAuthStore((s) => s.session);

  const reminderEnabled = useReminderStore((s) => s.enabled);
  const reminderHour = useReminderStore((s) => s.hour);
  const reminderMinute = useReminderStore((s) => s.minute);
  const hasPromptedPermission = useReminderStore((s) => s.hasPromptedPermission);
  const setReminderEnabled = useReminderStore((s) => s.setEnabled);
  const setReminderTime = useReminderStore((s) => s.setTime);
  const setHasPromptedPermission = useReminderStore((s) => s.setHasPromptedPermission);

  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const { scrollY, onScroll } = useScrollHeader();

  const pinEnabled = usePinLockStore((s) => s.pinEnabled);
  const setPinEnabled = usePinLockStore((s) => s.setPinEnabled);
  const setLocked = usePinLockStore((s) => s.setLocked);

  // İlk Ayarlar ziyaretinde bir kez izin iste, sonrasında bir daha sormaz (hasPromptedPermission).
  useEffect(() => {
    (async () => {
      const status = await getNotificationPermissionStatus();
      if (status === 'unsupported') {
        setPermissionStatus('unsupported');
        return;
      }
      if (!hasPromptedPermission && status === 'undetermined') {
        const result = await requestNotificationPermission();
        setPermissionStatus(result);
        setHasPromptedPermission(true);
      } else {
        setPermissionStatus(status);
      }
    })();
  }, [hasPromptedPermission, setHasPromptedPermission]);

  // Etkinleştirme/saat/dil değiştikçe zamanlamayı anında güncelle.
  useEffect(() => {
    if (permissionStatus === null) return;
    if (reminderEnabled && permissionStatus === 'granted') {
      scheduleDailyReminder(reminderHour, reminderMinute, {
        title: t.notifications.title,
        body: t.notifications.body,
      }).catch((error) => console.error('Hatırlatma zamanlanamadı:', error));
    } else {
      cancelDailyReminder().catch((error) => console.error('Hatırlatma iptal edilemedi:', error));
    }
  }, [reminderEnabled, reminderHour, reminderMinute, permissionStatus, language, t]);

  const handleLogout = async () => {
    try {
      await signOut();
      // PIN kilidinin kurtarma yolu ("PIN'imi Unuttum") bu hesabın Supabase oturumuna
      // dayanıyor; oturum kapanınca o yol da kaybolur — kilidi açık bırakmak kullanıcıyı
      // kurtarma imkânı olmayan bir PIN'e mahkûm eder, bu yüzden çıkışta da kaldırıyoruz.
      if (pinEnabled) {
        await clearPin();
        setPinEnabled(false);
        setLocked(false);
      }
      router.replace('/sign-in');
    } catch (error) {
      console.error('Çıkış yapılamadı:', error);
    }
  };

  const handleToggleAppLock = (value: boolean) => {
    if (!session) return;
    router.push(value ? '/pin-setup' : '/pin-disable');
  };

  const handleToggleReminder = async (value: boolean) => {
    if (permissionStatus === 'unsupported') return;
    if (value && permissionStatus !== 'granted') {
      const result = await requestNotificationPermission();
      setPermissionStatus(result);
      setHasPromptedPermission(true);
      if (result !== 'granted') return;
    }
    setReminderEnabled(value);
  };

  // Yerel değişiklik anında uygulanır (misafir kullanıcı da paleti değiştirebilsin);
  // oturum varsa arka planda (fire-and-forget) profiles'a da yazılır ki başka bir
  // cihazda girişte de aynı palet gelsin (bkz. lib/paletteSync.ts).
  const handlePickLightPalette = (key: PaletteKey) => {
    setLightPalette(key);
    if (session) {
      updateProfile(session.user.id, { light_palette: key }).catch((error) =>
        console.error('Açık tema paleti kaydedilemedi:', error)
      );
    }
  };

  const handlePickDarkPalette = (key: PaletteKey) => {
    setDarkPalette(key);
    if (session) {
      updateProfile(session.user.id, { dark_palette: key }).catch((error) =>
        console.error('Koyu tema paleti kaydedilemedi:', error)
      );
    }
  };

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: t.settings.themeSystem },
    { value: 'light', label: t.settings.themeLight },
    { value: 'dark', label: t.settings.themeDark },
  ];

  const languageOptions: { value: Language; label: string }[] = [
    { value: 'tr', label: t.settings.languageTr },
    { value: 'en', label: t.settings.languageEn },
  ];

  return (
    <Screen
      colors={colors}
      title={t.settings.title}
      scrollY={scrollY}
      onBack={() => router.back()}
      edges={['top', 'bottom']}
    >
    <Animated.ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>{t.settings.appearance}</Text>
      <View style={[styles.segment, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {themeOptions.map((option) => {
          const selected = themeMode === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.segmentItem, selected && { backgroundColor: colors.accent }]}
              onPress={() => setThemeMode(option.value)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? colors.accentText : colors.subtext },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
        {t.settings.lightPalette}
      </Text>
      <View style={styles.swatchRow}>
        {PALETTE_KEYS.map((key) => {
          const swatch = getPalette('light', key);
          const selected = lightPalette === key;
          return (
            <Pressable
              key={key}
              style={styles.swatchWrap}
              onPress={() => handlePickLightPalette(key)}
            >
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: swatch.accent },
                  selected && { borderWidth: 3, borderColor: colors.text },
                ]}
              >
                {selected && <Ionicons name="checkmark" size={16} color={swatch.accentText} />}
              </View>
              <Text style={[styles.swatchLabel, { color: colors.subtext }]}>
                {t.settings.paletteNames[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
        {t.settings.darkPalette}
      </Text>
      <View style={styles.swatchRow}>
        {PALETTE_KEYS.map((key) => {
          const swatch = getPalette('dark', key);
          const selected = darkPalette === key;
          return (
            <Pressable key={key} style={styles.swatchWrap} onPress={() => handlePickDarkPalette(key)}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: swatch.accent },
                  selected && { borderWidth: 3, borderColor: colors.text },
                ]}
              >
                {selected && <Ionicons name="checkmark" size={16} color={swatch.accentText} />}
              </View>
              <Text style={[styles.swatchLabel, { color: colors.subtext }]}>
                {t.settings.paletteNames[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>{t.settings.language}</Text>
      <View style={[styles.segment, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {languageOptions.map((option) => {
          const selected = language === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.segmentItem, selected && { backgroundColor: colors.accent }]}
              onPress={() => setLanguage(option.value)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? colors.accentText : colors.subtext },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
        {t.settings.dailyReminder}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.reminderRow}>
          <Text style={[styles.reminderLabel, { color: colors.text }]}>
            {t.settings.dailyReminder}
          </Text>
          <Switch
            value={reminderEnabled}
            onValueChange={handleToggleReminder}
            disabled={permissionStatus === 'unsupported'}
          />
        </View>
        <Text style={[styles.reminderDescription, { color: colors.subtext }]}>
          {t.settings.reminderDescription}
        </Text>
        {reminderEnabled && (
          <Pressable style={styles.timeRow} onPress={() => setShowTimePicker(true)}>
            <Text style={[styles.reminderLabel, { color: colors.text }]}>
              {t.settings.reminderTime}
            </Text>
            <Text style={[styles.timeValue, { color: colors.accent }]}>
              {pad(reminderHour)}:{pad(reminderMinute)}
            </Text>
          </Pressable>
        )}
        {permissionStatus === 'denied' && (
          <Text style={[styles.warning, { color: colors.danger }]}>
            {t.settings.reminderPermissionDenied}
          </Text>
        )}
        {permissionStatus === 'unsupported' && (
          <Text style={[styles.warning, { color: colors.subtext }]}>
            {t.settings.reminderUnsupported}
          </Text>
        )}
      </View>
      {showTimePicker && (
        <DateTimePicker
          value={new Date(2000, 0, 1, reminderHour, reminderMinute)}
          mode="time"
          display="default"
          onChange={(_event, selected) => {
            setShowTimePicker(false);
            if (selected) setReminderTime(selected.getHours(), selected.getMinutes());
          }}
        />
      )}

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>{t.pinLock.title}</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.reminderRow}>
          <Text style={[styles.reminderLabel, { color: colors.text }]}>{t.pinLock.enableRow}</Text>
          <Switch value={pinEnabled} onValueChange={handleToggleAppLock} disabled={!session} />
        </View>
        <Text style={[styles.reminderDescription, { color: colors.subtext }]}>
          {t.pinLock.description}
        </Text>
        {!session && (
          <Text style={[styles.warning, { color: colors.subtext }]}>
            {t.pinLock.signInRequiredRow}
          </Text>
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>{t.settings.account}</Text>
      {session && <Text style={[styles.email, { color: colors.text }]}>{session.user.email}</Text>}
      <MenuCard colors={colors}>
        {session ? (
          <MenuRow
            icon="log-out-outline"
            label={t.settings.logout}
            onPress={handleLogout}
            colors={colors}
            tint={colors.danger}
            showChevron={false}
            showDivider
          />
        ) : (
          // __DEV__ modunda root guard atlandığı için oturumsuz Ayarlar'a girilebiliyor;
          // auth ekranlarını yine de test edebilmek için bu satır sadece dev'de gösteriliyor.
          __DEV__ && (
            <MenuRow
              icon="log-in-outline"
              label={t.settings.loginRow}
              onPress={() => router.push('/sign-in')}
              colors={colors}
              showDivider
            />
          )
        )}
        <MenuRow
          icon="chatbubble-ellipses-outline"
          label={t.settings.feedbackRow}
          onPress={() => router.push('/feedback')}
          colors={colors}
        />
      </MenuCard>

      {session && (
        <MenuCard colors={colors}>
          <MenuRow
            icon="trash-outline"
            label={t.settings.deleteAccountRow}
            onPress={() => router.push('/delete-account')}
            colors={colors}
            tint={colors.danger}
            showChevron={false}
          />
        </MenuCard>
      )}

      {__DEV__ && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Geliştirici</Text>
          <MenuCard colors={colors}>
            <MenuRow
              icon="brush-outline"
              label="Kalem Animasyonu Önizleme"
              onPress={() => router.push('/dev/pen-preview')}
              colors={colors}
            />
          </MenuCard>
        </>
      )}
    </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  swatchWrap: {
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  reminderDescription: {
    fontSize: 13,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000022',
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  warning: {
    fontSize: 13,
  },
  email: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
});
