import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, View, useColorScheme } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import SplashAnimation from '../components/SplashAnimation';
import { useSettingsStore } from '../lib/store/settingsStore';
import { useAuthStore } from '../lib/store/authStore';
import { useBackupStore } from '../lib/store/backupStore';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { SPLASH_FILL_COLOR } from '../lib/rings';
import {
  addNotificationResponseListener,
  DAILY_REMINDER_TYPE,
  getLastNotificationResponseType,
} from '../lib/notifications';
import { maybeRunBackup } from '../lib/backupScheduler';
import { hasCloudBackup } from '../lib/supabase/backup';
import { hasAnyEntries } from '../lib/db/entries';
import { initDatabase } from '../lib/db/init';
import { usePinLockStore } from '../lib/store/pinLockStore';
import PinLockScreen from '../components/PinLockScreen';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  const session = useAuthStore((s) => s.session);
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();

  // GELİŞTİRME BYPASS: __DEV__ true iken auth zorunluluğu devre dışı.
  // Store'a göndermeden önce bunu test etmeyi unutma.
  const canEnterApp = __DEV__ || !!session;

  const pinEnabled = usePinLockStore((s) => s.pinEnabled);
  const locked = usePinLockStore((s) => s.locked);
  const setLocked = usePinLockStore((s) => s.setLocked);

  // Foreground'dan AYRILIRKEN kilitliyoruz (sadece geri dönüşte değil) — böylece
  // kullanıcı foreground'a döndüğü anda kilit ekranı ZATEN orada bekliyor olur,
  // arkadaki içeriğin tek bir frame bile görünme riski kalmaz.
  useEffect(() => {
    if (!pinEnabled) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') setLocked(true);
    });
    return () => subscription.remove();
  }, [pinEnabled, setLocked]);

  useEffect(() => {
    if (!hasOnboarded || !canEnterApp) return;

    const goToQuestion = (type: string | undefined) => {
      if (type === DAILY_REMINDER_TYPE) router.push('/question');
    };

    getLastNotificationResponseType().then(goToQuestion);
    const unsubscribe = addNotificationResponseListener(goToQuestion);

    return unsubscribe;
  }, [hasOnboarded, canEnterApp, router]);

  // Açılışta ve foreground'a her dönüşte sessizce yedekleme sıklığını kontrol et.
  useEffect(() => {
    if (!hasOnboarded || !canEnterApp || !session) return;

    maybeRunBackup(session);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') maybeRunBackup(session);
    });
    return () => subscription.remove();
  }, [hasOnboarded, canEnterApp, session]);

  // Oturum var ama local'de hiç giriş yokken bulutta bir yedek varsa (yeni cihaz/yeniden
  // kurulum), tek seferlik bir restore önerisi göster. useRef ile uygulama başına en
  // fazla bir kez tetiklenmesi garanti ediliyor (hasPromptedRestore de kalıcı olarak
  // bir daha sormamak için ayrıca set ediliyor).
  const restoreCheckRan = useRef(false);
  useEffect(() => {
    if (!hasOnboarded || !canEnterApp || !session || restoreCheckRan.current) return;
    const { hasPromptedRestore, setHasPromptedRestore } = useBackupStore.getState();
    if (hasPromptedRestore) return;
    restoreCheckRan.current = true;

    (async () => {
      try {
        await initDatabase();
        const [localHasEntries, cloudHasEntries] = await Promise.all([
          hasAnyEntries(),
          hasCloudBackup(session.user.id),
        ]);
        if (localHasEntries || !cloudHasEntries) return;

        Alert.alert(t.restore.promptTitle, t.restore.promptMessage, [
          { text: t.restore.notNow, style: 'cancel', onPress: () => setHasPromptedRestore(true) },
          {
            text: t.restore.restoreCta,
            onPress: () => {
              setHasPromptedRestore(true);
              router.push('/restore');
            },
          },
        ]);
      } catch (error) {
        console.error('Restore kontrolü başarısız:', error);
      }
    })();
  }, [hasOnboarded, canEnterApp, session, t, router]);

  return (
    <View style={{ flex: 1 }}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!hasOnboarded}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>

      <Stack.Protected guard={hasOnboarded && canEnterApp}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="entry/new"
          options={{
            headerShown: true,
            title: t.entryNew.title,
            presentation: 'modal',
            animation: 'fade',
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="entry/[id]"
          options={{
            headerShown: true,
            title: t.entryDetail.title,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: t.settings.title,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="stats"
          options={{
            headerShown: true,
            title: t.stats.title,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="feedback"
          options={{
            headerShown: true,
            title: t.feedbackForm.title,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{
            headerShown: true,
            title: t.editProfile.title,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="restore"
          options={{
            headerShown: true,
            title: t.restore.title,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="search"
          options={{
            headerShown: true,
            title: t.search.title,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="pin-setup"
          options={{
            headerShown: true,
            title: t.pinLock.setupTitle,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="pin-disable"
          options={{
            headerShown: true,
            title: t.pinLock.disableTitle,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="share-entry"
          options={{
            headerShown: true,
            title: t.shareEntry.title,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
      </Stack.Protected>

      <Stack.Protected guard={hasOnboarded && (__DEV__ || !canEnterApp)}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="dev/pen-preview" />
      </Stack.Protected>
    </Stack>
    {pinEnabled && locked && <PinLockScreen onUnlock={() => setLocked(false)} />}
    </View>
  );
}

export default function RootLayout() {
  const hasHydrated = useSettingsStore((s) => s.hasHydrated);
  const authInitialized = useAuthStore((s) => s.initialized);
  const pinLockChecked = usePinLockStore((s) => s.checked);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  if (showIntro) {
    return <SplashAnimation onFinish={() => setShowIntro(false)} />;
  }

  // pinLockChecked burada bekleniyor ki RootNavigator hiç mount olmadan önce
  // pinEnabled/locked kesinleşmiş olsun — aksi halde kilitli bir kullanıcı için
  // gerçek içeriğin tek bir frame bile flaş etme ihtimali olurdu.
  if (!hasHydrated || !authInitialized || !pinLockChecked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: SPLASH_FILL_COLOR[scheme],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={scheme === 'dark' ? '#FFFFFF' : '#00487C'} />
      </View>
    );
  }

  return <RootNavigator />;
}
