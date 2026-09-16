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
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { getCurrentCapsuleWindow } from '../lib/capsule';
import { useIsPremiumUser } from '../lib/premium';
import { initDatabase } from '../lib/db/init';
import { getAllYearWords, getWordForYear, upsertYearWord } from '../lib/db/yearWords';
import type { YearWord } from '../lib/db/yearWords';

export default function YearWordSection() {
  const { colors } = useTheme();
  const t = useT();
  const isPremiumUser = useIsPremiumUser();

  // Yıl Sonu Kapsülü ile aynı pencere (20 Aralık - 10 Ocak): pencere açıkken hedef,
  // o pencerede "yazılan" (writingYear) yıl — kapalıyken ise şu an içinde
  // bulunduğumuz, sözü zaten pencerede seçilmiş olan yıl (revealYear).
  const capsuleWindow = useMemo(() => getCurrentCapsuleWindow(new Date()), []);
  const targetYear = capsuleWindow.isOpen ? capsuleWindow.writingYear : capsuleWindow.revealYear;
  const canEdit = capsuleWindow.isOpen || isPremiumUser;

  const [loaded, setLoaded] = useState(false);
  const [targetWord, setTargetWord] = useState<YearWord | null>(null);
  const [allWords, setAllWords] = useState<YearWord[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      await initDatabase();
      const [target, all] = await Promise.all([getWordForYear(targetYear), getAllYearWords()]);
      setTargetWord(target);
      setAllWords(all);
    } catch (error) {
      console.error('Yılın kelimesi yüklenemedi:', error);
    } finally {
      setLoaded(true);
    }
  }, [targetYear]);

  useEffect(() => {
    load();
  }, [load]);

  if (!loaded) return null;

  // Pencere kapalı + free + o yıl için hiç kelime seçilmemiş: chip'i gizlemek yerine
  // CapsuleSection'daki kilitli görünümle tutarlı bir "kilitli" hal gösteriyoruz —
  // dokununca (handlePress zaten canEdit=false iken bunu yapıyor) düzenleme modalı
  // AÇILMAZ, sadece bilgilendirme/upsell alert'i açılır.
  const isLocked = !canEdit && !targetWord;

  const handlePress = () => {
    if (!canEdit) {
      Alert.alert(t.yearWord.lockedInfoTitle, t.yearWord.lockedInfoMessage);
      return;
    }
    setDraft(targetWord?.word ?? '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await upsertYearWord(targetYear, draft.trim());
      const [target, all] = await Promise.all([getWordForYear(targetYear), getAllYearWords()]);
      setTargetWord(target);
      setAllWords(all);
      setModalVisible(false);
    } catch (error) {
      console.error('Yılın kelimesi kaydedilemedi:', error);
    } finally {
      setSaving(false);
    }
  };

  const pastWords = allWords.filter((w) => w.year !== targetYear);

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.chip,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={handlePress}
      >
        <Ionicons
          name={isLocked ? 'lock-closed-outline' : 'sparkles-outline'}
          size={14}
          color={isLocked ? colors.subtext : colors.accent}
        />
        <Text
          style={[styles.chipText, { color: isLocked ? colors.subtext : colors.text }]}
          numberOfLines={1}
        >
          {isLocked
            ? t.yearWord.title
            : targetWord
              ? `${targetYear}: ${targetWord.word}`
              : t.yearWord.invite}
        </Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {targetYear} {t.yearWord.editTitleSuffix}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.subtext} />
              </Pressable>
            </View>

            <TextInput
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
              ]}
              value={draft}
              onChangeText={setDraft}
              placeholder={t.yearWord.placeholder}
              placeholderTextColor={colors.subtext}
              maxLength={30}
              autoFocus
              onSubmitEditing={handleSave}
            />

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
                <Text style={[styles.saveText, { color: colors.accentText }]}>{t.yearWord.save}</Text>
              )}
            </Pressable>

            {pastWords.length > 0 && (
              <>
                <Text style={[styles.pastTitle, { color: colors.subtext }]}>
                  {t.yearWord.pastWordsTitle}
                </Text>
                <ScrollView style={styles.pastList}>
                  {pastWords.map((w) => (
                    <View
                      key={w.year}
                      style={[styles.pastRow, { borderBottomColor: colors.border }]}
                    >
                      <Text style={[styles.pastYear, { color: colors.accent }]}>{w.year}</Text>
                      <Text style={[styles.pastWord, { color: colors.text }]} numberOfLines={1}>
                        {w.word}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
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
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
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
  pastTitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pastList: {
    maxHeight: 200,
  },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pastYear: {
    fontSize: 13,
    fontWeight: '800',
    width: 48,
  },
  pastWord: {
    flex: 1,
    fontSize: 14,
  },
});
