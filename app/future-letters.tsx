import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Screen from '../components/Screen';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useSettingsStore } from '../lib/store/settingsStore';
import { useIsPremiumUser } from '../lib/premium';
import { useAuthStore } from '../lib/store/authStore';
import { initDatabase } from '../lib/db/init';
import { getAllLetters, createLetter, deleteLetter, type FutureLetter } from '../lib/db/futureLetters';
import { deleteFutureLetterFromCloud } from '../lib/supabase/backup';
import { toDateString } from '../lib/date';
import { PAPER } from '../lib/paper';

function startOfTomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateFromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

// TODO: IAP kurulunca useIsPremiumUser() gerçek entitlement kontrolüne bağlanınca bu
// ekranda ekstra bir şey değiştirmeye gerek yok — mantık zaten isPremiumUser'a göre kuruldu.

export default function FutureLettersScreen() {
  const { colors, scheme } = useTheme();
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const isPremiumUser = useIsPremiumUser();
  const session = useAuthStore((s) => s.session);
  const paper = PAPER[scheme];

  const [loaded, setLoaded] = useState(false);
  const [letters, setLetters] = useState<FutureLetter[]>([]);
  const [composeVisible, setComposeVisible] = useState(false);
  const [composeDate, setComposeDate] = useState(startOfTomorrow());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewingLetter, setViewingLetter] = useState<FutureLetter | null>(null);

  const load = useCallback(async () => {
    try {
      await initDatabase();
      setLetters(await getAllLetters());
    } catch (error) {
      console.error('Geleceğe mektuplar yüklenemedi:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = toDateString(new Date());
  const activeLetters = useMemo(() => letters.filter((l) => l.unlock_date > today), [letters, today]);
  const openedLetters = useMemo(() => letters.filter((l) => l.unlock_date <= today), [letters, today]);
  const canCreateNew = isPremiumUser || activeLetters.length === 0;

  const formatDate = (d: Date) =>
    d.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const countdownLabel = (unlockDate: string): string => {
    const diffMs = dateFromIso(unlockDate).getTime() - dateFromIso(today).getTime();
    const days = Math.round(diffMs / 86400000);
    if (days <= 0) return t.futureLetters.opensToday;
    if (days === 1) return t.futureLetters.opensTomorrow;
    return t.futureLetters.opensInDays(days);
  };

  const handleNewLetterPress = () => {
    if (!canCreateNew) {
      Alert.alert(t.futureLetters.limitReachedTitle, t.futureLetters.limitReachedMessage);
      return;
    }
    setComposeDate(startOfTomorrow());
    setDraftContent('');
    setComposeVisible(true);
  };

  const handleSave = async () => {
    if (!draftContent.trim()) return;
    setSaving(true);
    try {
      await createLetter(draftContent, composeDate);
      setLetters(await getAllLetters());
      setComposeVisible(false);
    } catch (error) {
      console.error('Mektup kaydedilemedi:', error);
      Alert.alert(t.futureLetters.saveErrorTitle, t.futureLetters.saveErrorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLetter = (letter: FutureLetter) => {
    Alert.alert(t.futureLetters.deleteConfirmTitle, t.futureLetters.deleteConfirmMessage, [
      { text: t.futureLetters.cancel, style: 'cancel' },
      {
        text: t.futureLetters.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLetter(letter.id);
            setLetters(await getAllLetters());
          } catch (error) {
            console.error('Mektup silinemedi:', error);
            Alert.alert(t.futureLetters.deleteErrorTitle, t.futureLetters.deleteErrorMessage);
            return;
          }
          // Local silme zaten tamamlandı; bulut senkronu arkada, beklenmeden
          // (best-effort) tetikleniyor — deleteFutureLetterFromCloud kendi içinde
          // tüm hataları yutuyor (bkz. lib/supabase/backup.ts).
          if (session) {
            void deleteFutureLetterFromCloud(session.user.id, letter.id);
          }
        },
      },
    ]);
  };

  // İçerik ASLA önizlenmiyor — sadece açılış tarihi/geri sayım gösteriliyor. Silme
  // seçeneği de burada: kilitli bir mektubu vazgeçip iptal etmenin tek yolu bu.
  const handlePressLocked = (letter: FutureLetter) => {
    Alert.alert(
      t.futureLetters.lockedDetailTitle,
      `${t.futureLetters.lockedDetailMessage(formatDate(dateFromIso(letter.unlock_date)))}`,
      [
        {
          text: t.futureLetters.deleteAction,
          style: 'destructive',
          onPress: () => handleDeleteLetter(letter),
        },
        { text: t.futureLetters.close, style: 'cancel' },
      ]
    );
  };

  if (!loaded) {
    return (
      <Screen colors={colors} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen colors={colors} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable
          style={({ pressed }) => [
            styles.newButton,
            { backgroundColor: colors.accent, opacity: pressed ? 0.85 : canCreateNew ? 1 : 0.5 },
          ]}
          onPress={handleNewLetterPress}
        >
          <Ionicons name="add" size={18} color={colors.accentText} />
          <Text style={[styles.newButtonText, { color: colors.accentText }]}>
            {t.futureLetters.newLetter}
          </Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
            {t.futureLetters.activeSectionTitle}
          </Text>
          {activeLetters.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.subtext }]}>{t.futureLetters.noActive}</Text>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {activeLetters.map((letter, i) => (
                <Pressable
                  key={letter.id}
                  style={[
                    styles.row,
                    i < activeLetters.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                  onPress={() => handlePressLocked(letter)}
                >
                  <View style={[styles.rowIconWrap, { backgroundColor: colors.border }]}>
                    <Ionicons name="lock-closed-outline" size={16} color={colors.subtext} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowDate, { color: colors.text }]}>
                      {formatDate(dateFromIso(letter.unlock_date))}
                    </Text>
                    <Text style={[styles.rowHint, { color: colors.subtext }]}>
                      {countdownLabel(letter.unlock_date)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.subtext} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
            {t.futureLetters.openedSectionTitle}
          </Text>
          {openedLetters.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.subtext }]}>{t.futureLetters.noOpened}</Text>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {openedLetters.map((letter, i) => (
                <Pressable
                  key={letter.id}
                  style={[
                    styles.row,
                    i < openedLetters.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                  onPress={() => setViewingLetter(letter)}
                >
                  <View style={[styles.rowIconWrap, { backgroundColor: colors.accent }]}>
                    <Ionicons name="mail-open-outline" size={16} color={colors.accentText} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={[styles.rowDate, { color: colors.text }]}>
                      {formatDate(dateFromIso(letter.unlock_date))}
                    </Text>
                    <Text style={[styles.rowPreview, { color: colors.subtext }]} numberOfLines={1}>
                      {letter.content}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.subtext} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!viewingLetter}
        animationType="slide"
        transparent
        onRequestClose={() => setViewingLetter(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {viewingLetter ? formatDate(dateFromIso(viewingLetter.unlock_date)) : ''}
              </Text>
              <Pressable onPress={() => setViewingLetter(null)}>
                <Ionicons name="close" size={22} color={colors.subtext} />
              </Pressable>
            </View>
            {viewingLetter && (
              <ScrollView>
                <View style={[styles.paperCard, { backgroundColor: paper.bg }]}>
                  <View style={[styles.paperMargin, { backgroundColor: paper.margin }]} />
                  <Text style={[styles.paperText, { color: colors.text }]}>{viewingLetter.content}</Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={composeVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setComposeVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {t.futureLetters.composeTitle}
              </Text>
              <Pressable onPress={() => setComposeVisible(false)}>
                <Ionicons name="close" size={22} color={colors.subtext} />
              </Pressable>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.subtext }]}>{t.futureLetters.dateLabel}</Text>
            <Pressable
              style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.accent} />
              <Text style={[styles.dateText, { color: colors.text }]}>{formatDate(composeDate)}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.subtext} />
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={composeDate}
                mode="date"
                display="default"
                minimumDate={startOfTomorrow()}
                onChange={(_event, selected) => {
                  setShowDatePicker(false);
                  if (selected) setComposeDate(selected);
                }}
              />
            )}

            <View style={[styles.textCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                multiline
                placeholder={t.futureLetters.placeholder}
                placeholderTextColor={colors.subtext}
                value={draftContent}
                onChangeText={setDraftContent}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: colors.accent, opacity: pressed || saving ? 0.85 : 1 },
              ]}
              disabled={saving}
              onPress={handleSave}
            >
              {saving ? (
                <ActivityIndicator color={colors.accentText} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.accentText }]}>
                  {t.futureLetters.send}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: 16,
    gap: 10,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 14,
  },
  newButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    marginTop: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 14,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowDate: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowHint: {
    fontSize: 12,
  },
  rowPreview: {
    fontSize: 13,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    padding: 20,
    gap: 14,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  paperCard: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    minHeight: 120,
  },
  paperMargin: {
    width: 2,
    marginRight: 14,
    borderRadius: 1,
  },
  paperText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dateText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  textCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  input: {
    minHeight: 130,
    padding: 14,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
