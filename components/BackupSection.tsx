import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import type { Dictionary } from '../lib/i18n';
import { useAuthStore } from '../lib/store/authStore';
import { useSettingsStore } from '../lib/store/settingsStore';
import { useBackupStore, type BackupFrequency } from '../lib/store/backupStore';
import { runBackup, BACKUP_NOT_CONFIGURED } from '../lib/supabase/backup';
import { initDatabase } from '../lib/db/init';

const FREQUENCIES: BackupFrequency[] = ['daily', 'weekly', 'monthly', 'manual'];

function frequencyLabel(t: Dictionary, frequency: BackupFrequency): string {
  switch (frequency) {
    case 'daily':
      return t.backup.frequencyDaily;
    case 'weekly':
      return t.backup.frequencyWeekly;
    case 'monthly':
      return t.backup.frequencyMonthly;
    case 'manual':
      return t.backup.frequencyManual;
  }
}

function formatLastBackup(t: Dictionary, language: string, iso: string | null): string {
  if (!iso) return t.backup.never;
  return new Date(iso).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function BackupSection() {
  const { colors } = useTheme();
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const session = useAuthStore((s) => s.session);

  const enabled = useBackupStore((s) => s.enabled);
  const frequency = useBackupStore((s) => s.frequency);
  const lastBackupAt = useBackupStore((s) => s.lastBackupAt);
  const syncCursor = useBackupStore((s) => s.syncCursor);
  const setEnabled = useBackupStore((s) => s.setEnabled);
  const setFrequency = useBackupStore((s) => s.setFrequency);
  const recordBackupAttempt = useBackupStore((s) => s.recordBackupAttempt);

  const [backingUp, setBackingUp] = useState(false);

  if (!session) return null;

  const handleBackupNow = async () => {
    setBackingUp(true);
    try {
      await initDatabase();
      const result = await runBackup(session.user.id, syncCursor);
      recordBackupAttempt(result.newCursor);

      if (
        result.entriesIncomplete ||
        result.photosFailed > 0 ||
        result.yearWordsFailed ||
        result.futureLettersFailed ||
        result.somedayListsFailed ||
        result.somedayListFailed ||
        result.goalsFailed
      ) {
        Alert.alert(t.backup.partialTitle, t.backup.partialMessage);
      } else {
        Alert.alert(
          t.backup.successTitle,
          `${result.entriesSynced} ${t.backup.entriesWord} · ${result.photosSynced} ${t.backup.photosWord}`
        );
      }
    } catch (error) {
      console.error('Yedekleme başarısız:', error);
      const notConfigured = error instanceof Error && error.message === BACKUP_NOT_CONFIGURED;
      Alert.alert(t.backup.errorTitle, notConfigured ? t.backup.notConfigured : t.backup.errorMessage);
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>{t.backup.title}</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t.backup.enableRow}</Text>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>

        {enabled && (
          <View style={styles.frequencyBlock}>
            <Text style={[styles.frequencyLabel, { color: colors.subtext }]}>
              {t.backup.frequencyLabel}
            </Text>
            <View style={[styles.segment, { borderColor: colors.border }]}>
              {FREQUENCIES.map((option) => {
                const selected = frequency === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.segmentItem, selected && { backgroundColor: colors.accent }]}
                    onPress={() => setFrequency(option)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        { color: selected ? colors.accentText : colors.subtext },
                      ]}
                    >
                      {frequencyLabel(t, option)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Text style={[styles.lastBackup, { color: colors.subtext }]}>
          {t.backup.lastBackupLabel}: {formatLastBackup(t, language, lastBackupAt)}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.backupButton,
            { backgroundColor: colors.accent, opacity: pressed || backingUp ? 0.85 : 1 },
          ]}
          disabled={backingUp}
          onPress={handleBackupNow}
        >
          {backingUp ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={[styles.backupButtonText, { color: colors.accentText }]}>
              {t.backup.backupNow}
            </Text>
          )}
        </Pressable>

        <Text style={[styles.infoText, { color: colors.subtext }]}>{t.backup.infoText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  frequencyBlock: {
    gap: 6,
  },
  frequencyLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  segment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  lastBackup: {
    fontSize: 12,
  },
  backupButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backupButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 12,
    lineHeight: 17,
  },
});
