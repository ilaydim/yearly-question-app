import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Screen from '../components/Screen';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useAuthStore } from '../lib/store/authStore';
import { useBackupStore } from '../lib/store/backupStore';
import { initDatabase } from '../lib/db/init';
import { restoreFromCloud, type RestoreProgress, type RestoreResult } from '../lib/supabase/backup';

type Status = 'running' | 'done' | 'error';

export default function RestoreScreen() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const recordBackupAttempt = useBackupStore((s) => s.recordBackupAttempt);

  const [status, setStatus] = useState<Status>('running');
  const [progress, setProgress] = useState<RestoreProgress | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!session || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        await initDatabase();
        const restoreResult = await restoreFromCloud(session.user.id, setProgress);
        setResult(restoreResult);
        // Local veri artık bulutla eşit — bir sonraki backup her şeyi tekrar
        // yüklemeye çalışmasın diye senkron ilerlemesini "şimdi"ye çekiyoruz.
        recordBackupAttempt(new Date().toISOString());
        setStatus('done');
      } catch (error) {
        console.error('Geri yükleme başarısız:', error);
        setStatus('error');
      }
    })();
  }, [session, recordBackupAttempt]);

  if (!session) {
    return (
      <Screen colors={colors} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={[styles.info, { color: colors.subtext }]}>{t.restore.signInRequired}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen colors={colors} edges={['bottom']}>
      <View style={styles.centered}>
        {status === 'running' && (
          <>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={[styles.status, { color: colors.text }]}>{t.restore.restoring}</Text>
            {progress && (
              <Text style={[styles.progress, { color: colors.subtext }]}>
                {progress.phase === 'entries' ? t.restore.entriesProgress : t.restore.photosProgress}
                {': '}
                {progress.completed} / {progress.total}
              </Text>
            )}
          </>
        )}

        {status === 'done' && result && (
          <>
            <Text style={[styles.status, { color: colors.text }]}>{t.restore.doneTitle}</Text>
            <Text style={[styles.progress, { color: colors.subtext }]}>
              {result.entriesRestored} {t.backup.entriesWord} · {result.photosRestored}{' '}
              {t.backup.photosWord}
            </Text>
            <Pressable
              style={[styles.closeButton, { backgroundColor: colors.accent }]}
              onPress={() => router.replace('/')}
            >
              <Text style={[styles.closeButtonText, { color: colors.accentText }]}>
                {t.restore.close}
              </Text>
            </Pressable>
          </>
        )}

        {status === 'error' && (
          <>
            <Text style={[styles.status, { color: colors.danger }]}>{t.restore.errorMessage}</Text>
            <Pressable
              style={[styles.closeButton, { backgroundColor: colors.accent }]}
              onPress={() => router.replace('/')}
            >
              <Text style={[styles.closeButtonText, { color: colors.accentText }]}>
                {t.restore.close}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  info: {
    fontSize: 14,
    textAlign: 'center',
  },
  status: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  progress: {
    fontSize: 14,
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
