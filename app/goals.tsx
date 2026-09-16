import { useCallback, useEffect, useState } from 'react';
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
import { useSettingsStore } from '../lib/store/settingsStore';
import { useAuthStore } from '../lib/store/authStore';
import { initDatabase } from '../lib/db/init';
import {
  getCurrentItems,
  getArchivedPeriods,
  getItemsForPeriod,
  addItem,
  toggleItem,
  deleteItem,
  type GoalItem,
  type ArchivedPeriodSummary,
} from '../lib/db/goals';
import type { GoalListType } from '../lib/goalPeriods';
import { deleteGoalItemFromCloud } from '../lib/supabase/backup';

const LIST_TYPES: GoalListType[] = ['daily', 'weekly', 'yearly'];

export default function GoalsScreen() {
  const { colors } = useTheme();
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const session = useAuthStore((s) => s.session);

  const [listType, setListType] = useState<GoalListType>('daily');
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<GoalItem[]>([]);
  const [archivedPeriods, setArchivedPeriods] = useState<ArchivedPeriodSummary[]>([]);
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<GoalItem[]>([]);
  const [draft, setDraft] = useState('');

  const load = useCallback(async (type: GoalListType) => {
    try {
      await initDatabase();
      const [current, archived] = await Promise.all([
        getCurrentItems(type),
        getArchivedPeriods(type),
      ]);
      setItems(current);
      setArchivedPeriods(archived);
    } catch (error) {
      console.error('Hedefler yüklenemedi:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    setLoaded(false);
    setExpandedPeriod(null);
    setExpandedItems([]);
    setDraft('');
    load(listType);
  }, [listType, load]);

  const tabLabel = (type: GoalListType) => {
    if (type === 'daily') return t.goals.dailyTab;
    if (type === 'weekly') return t.goals.weeklyTab;
    return t.goals.yearlyTab;
  };

  // period_key'ler toDateString gibi UTC gün sınırına göre üretiliyor (bkz.
  // lib/goalPeriods.ts) — burada gösterim için AYNI desenle (someday-list.tsx'teki
  // formatEntryDate gibi) yerel gece yarısı olarak ayrıştırıyoruz.
  const formatDate = (periodKey: string) =>
    new Date(`${periodKey}T00:00:00`).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const formatPeriodLabel = (periodKey: string): string => {
    if (listType === 'yearly') return periodKey;
    if (listType === 'weekly') return t.goals.weekOfPrefix(formatDate(periodKey));
    return formatDate(periodKey);
  };

  const handleAdd = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    try {
      await addItem(listType, trimmed);
      setDraft('');
      setItems(await getCurrentItems(listType));
    } catch (error) {
      console.error('Hedef eklenemedi:', error);
    }
  };

  const handleToggle = async (item: GoalItem) => {
    try {
      await toggleItem(item.id);
      setItems(await getCurrentItems(listType));
    } catch (error) {
      console.error('Hedef işaretlenemedi:', error);
    }
  };

  const handleDelete = (item: GoalItem) => {
    Alert.alert(t.goals.deleteConfirmTitle, t.goals.deleteConfirmMessage, [
      { text: t.goals.cancel, style: 'cancel' },
      {
        text: t.goals.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem(item.id);
            setItems(await getCurrentItems(listType));
          } catch (error) {
            console.error('Hedef silinemedi:', error);
            return;
          }
          if (session) void deleteGoalItemFromCloud(session.user.id, item.id);
        },
      },
    ]);
  };

  const handleTogglePeriod = async (periodKey: string) => {
    if (expandedPeriod === periodKey) {
      setExpandedPeriod(null);
      setExpandedItems([]);
      return;
    }
    try {
      const periodItems = await getItemsForPeriod(listType, periodKey);
      setExpandedPeriod(periodKey);
      setExpandedItems(periodItems);
    } catch (error) {
      console.error('Geçmiş periyot yüklenemedi:', error);
    }
  };

  return (
    <Screen colors={colors} edges={['bottom']}>
      <View style={[styles.modeSwitch, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {LIST_TYPES.map((type) => (
          <Pressable
            key={type}
            style={[styles.modeItem, listType === type && { backgroundColor: colors.accent }]}
            onPress={() => setListType(type)}
          >
            <Text
              style={[
                styles.modeText,
                { color: listType === type ? colors.accentText : colors.subtext },
              ]}
            >
              {tabLabel(type)}
            </Text>
          </Pressable>
        ))}
      </View>

      {!loaded ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={[styles.addRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.addInput, { color: colors.text }]}
                placeholder={t.goals.addPlaceholder}
                placeholderTextColor={colors.subtext}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={handleAdd}
                returnKeyType="done"
              />
              <Pressable
                style={[styles.addButton, { backgroundColor: draft.trim() ? colors.accent : colors.border }]}
                onPress={handleAdd}
                disabled={!draft.trim()}
              >
                <Ionicons name="add" size={20} color={draft.trim() ? colors.accentText : colors.subtext} />
              </Pressable>
            </View>

            {items.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.subtext }]}>{t.goals.emptyState}</Text>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {items.map((item, i) => (
                  <View
                    key={item.id}
                    style={[
                      styles.row,
                      i < items.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <Pressable style={styles.rowMain} onPress={() => handleToggle(item)}>
                      <Ionicons
                        name={item.is_completed === 1 ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={item.is_completed === 1 ? colors.accent : colors.subtext}
                      />
                      <Text
                        style={[
                          styles.itemTitle,
                          item.is_completed === 1 && styles.itemTitleDone,
                          { color: item.is_completed === 1 ? colors.subtext : colors.text },
                        ]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => handleDelete(item)}>
                      <Ionicons name="trash-outline" size={18} color={colors.subtext} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
                {t.goals.archiveSectionTitle}
              </Text>
              {archivedPeriods.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.subtext }]}>{t.goals.archiveEmptyState}</Text>
              ) : (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {archivedPeriods.map((period, i) => {
                    const expanded = expandedPeriod === period.period_key;
                    return (
                      <View
                        key={period.period_key}
                        style={
                          i < archivedPeriods.length - 1 && {
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: colors.border,
                          }
                        }
                      >
                        <Pressable style={styles.row} onPress={() => handleTogglePeriod(period.period_key)}>
                          <Text style={[styles.itemTitle, styles.periodTitle, { color: colors.text }]}>
                            {formatPeriodLabel(period.period_key)}
                          </Text>
                          <Text style={[styles.periodSummaryText, { color: colors.subtext }]}>
                            {t.goals.periodSummary(period.completed_count, period.missed_count)}
                          </Text>
                          <Ionicons
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={colors.subtext}
                          />
                        </Pressable>
                        {expanded && (
                          <View style={styles.expandedList}>
                            {expandedItems.map((item) => (
                              <View key={item.id} style={styles.expandedRow}>
                                <Text
                                  style={[styles.itemTitle, styles.expandedItemTitle, { color: colors.text }]}
                                  numberOfLines={2}
                                >
                                  {item.title}
                                </Text>
                                <View
                                  style={[
                                    styles.tag,
                                    { backgroundColor: item.is_completed === 1 ? colors.accent : colors.dangerSoft },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.tagText,
                                      { color: item.is_completed === 1 ? colors.accentText : colors.danger },
                                    ]}
                                  >
                                    {item.is_completed === 1 ? t.goals.completedLabel : t.goals.missedLabel}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
  },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  modeItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  container: {
    padding: 16,
    gap: 14,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  addInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  itemTitleDone: {
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  periodTitle: {
    flex: 0,
    flexShrink: 1,
  },
  periodSummaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandedList: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 10,
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expandedItemTitle: {
    fontWeight: '500',
  },
  tag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
