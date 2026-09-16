import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { getCurrentCapsuleWindow } from '../lib/capsule';
import { useIsPremiumUser } from '../lib/premium';
import { initDatabase } from '../lib/db/init';
import { getCapsuleForYear, getAllCapsules, upsertCapsule } from '../lib/db/entries';
import { PAPER } from '../lib/paper';
import type { Entry } from '../lib/db/types';

// TODO: IAP kurulunca useIsPremiumUser() gerçek entitlement kontrolüne bağlanınca bu
// ekran otomatik olarak pencere dışında da premium kullanıcılara açılacak — burada
// ekstra bir şey değiştirmeye gerek yok, mantık zaten isPremiumUser'a göre kuruldu.

export default function CapsuleScreen() {
  const { colors, scheme } = useTheme();
  const t = useT();
  const isPremiumUser = useIsPremiumUser();
  const capsuleWindow = useMemo(() => getCurrentCapsuleWindow(new Date()), []);
  const paper = PAPER[scheme];

  const [loaded, setLoaded] = useState(false);
  const [revealEntry, setRevealEntry] = useState<Entry | null>(null);
  const [allCapsules, setAllCapsules] = useState<Entry[]>([]);
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      await initDatabase();
      if (capsuleWindow.isOpen) {
        const [reveal, writing] = await Promise.all([
          getCapsuleForYear(capsuleWindow.revealYear),
          getCapsuleForYear(capsuleWindow.writingYear),
        ]);
        setRevealEntry(reveal);
        setEditingYear(capsuleWindow.writingYear);
        setDraftContent(writing?.content ?? '');
      }
      if (isPremiumUser) {
        setAllCapsules(await getAllCapsules());
      }
    } catch (error) {
      console.error('Kapsül verisi yüklenemedi:', error);
    } finally {
      setLoaded(true);
    }
  }, [capsuleWindow, isPremiumUser]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelectCapsule = (entry: Entry) => {
    if (entry.capsule_year == null) return;
    setEditingYear(entry.capsule_year);
    setDraftContent(entry.content);
  };

  const handleSave = async () => {
    if (editingYear == null || !draftContent.trim()) return;
    setSaving(true);
    try {
      await upsertCapsule(editingYear, draftContent.trim());
      Alert.alert(t.capsule.savedTitle, t.capsule.savedMessage);
      if (isPremiumUser) setAllCapsules(await getAllCapsules());
      if (capsuleWindow.isOpen && editingYear === capsuleWindow.revealYear) {
        setRevealEntry(await getCapsuleForYear(capsuleWindow.revealYear));
      }
    } catch (error) {
      console.error('Kapsül kaydedilemedi:', error);
    } finally {
      setSaving(false);
    }
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

  // Savunma amaçlı: Profile normalde bu ekrana sadece pencere açıkken ya da premium
  // iken yönlendiriyor, ama doğrudan navigasyon ihtimaline karşı burada da koruyoruz.
  if (!capsuleWindow.isOpen && !isPremiumUser) {
    return (
      <Screen colors={colors} edges={['bottom']}>
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.subtext} />
          <Text style={[styles.lockedText, { color: colors.subtext }]}>
            {t.capsule.lockedInfoMessage}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen colors={colors} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {capsuleWindow.isOpen && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
                {capsuleWindow.revealYear}
                {t.capsule.revealTitleSuffix}
              </Text>
              {revealEntry ? (
                <View style={[styles.paperCard, { backgroundColor: paper.bg }]}>
                  <View style={[styles.paperMargin, { backgroundColor: paper.margin }]} />
                  <Text style={[styles.paperText, { color: colors.text }]}>{revealEntry.content}</Text>
                </View>
              ) : (
                <Text style={[styles.emptyText, { color: colors.subtext }]}>{t.capsule.revealEmpty}</Text>
              )}
            </>
          )}

          {editingYear != null && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
                {editingYear}
                {t.capsule.writeTitleSuffix}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  multiline
                  placeholder={t.capsule.placeholder}
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
                  <Text style={[styles.saveText, { color: colors.accentText }]}>{t.capsule.save}</Text>
                )}
              </Pressable>
            </View>
          )}

          {isPremiumUser && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
                {t.capsule.allCapsulesTitle}
              </Text>
              {allCapsules.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.subtext }]}>{t.capsule.noCapsulesYet}</Text>
              ) : (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {allCapsules.map((entry, i) => (
                    <Pressable
                      key={entry.id}
                      style={[
                        styles.capsuleRow,
                        i < allCapsules.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                        },
                        editingYear === entry.capsule_year && { backgroundColor: `${colors.accent}1A` },
                      ]}
                      onPress={() => handleSelectCapsule(entry)}
                    >
                      <Text style={[styles.capsuleYear, { color: colors.accent }]}>
                        {entry.capsule_year}
                      </Text>
                      <Text style={[styles.capsulePreview, { color: colors.text }]} numberOfLines={1}>
                        {entry.content}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {!isPremiumUser && (
            <Text style={[styles.premiumHint, { color: colors.subtext }]}>{t.capsule.premiumHint}</Text>
          )}
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
    gap: 12,
  },
  lockedText: {
    fontSize: 14,
    textAlign: 'center',
  },
  container: {
    padding: 16,
    gap: 10,
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
  paperCard: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    minHeight: 100,
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
  emptyText: {
    fontSize: 14,
  },
  card: {
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
  saveText: {
    fontSize: 15,
    fontWeight: '700',
  },
  capsuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  capsuleYear: {
    fontSize: 14,
    fontWeight: '800',
    width: 48,
  },
  capsulePreview: {
    flex: 1,
    fontSize: 14,
  },
  premiumHint: {
    marginTop: 16,
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
