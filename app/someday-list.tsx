import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
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
import Screen from '../components/Screen';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useSettingsStore } from '../lib/store/settingsStore';
import { useAuthStore } from '../lib/store/authStore';
import { useIsPremiumUser } from '../lib/premium';
import { initDatabase } from '../lib/db/init';
import {
  DEFAULT_SOMEDAY_LIST_ID,
  getAllLists,
  createList,
  getItemsForList,
  getCompletedCount,
  addItem,
  completeItem,
  deleteItem,
  type SomedayList,
  type SomedayItem,
} from '../lib/db/somedayList';
import { deleteSomedayItemFromCloud } from '../lib/supabase/backup';
import { getEntryById } from '../lib/db/entries';
import { getPhotosByEntryId } from '../lib/db/photos';
import { getLevelInfo, type LevelInfo } from '../lib/somedayLevels';
import { pickAndProcessPhoto } from '../lib/photoPicker';
import { PAPER } from '../lib/paper';
import type { Entry } from '../lib/db/types';

interface ViewingMemory {
  entry: Entry;
  photoUri: string | undefined;
}

export default function SomedayListScreen() {
  const { colors, scheme } = useTheme();
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const session = useAuthStore((s) => s.session);
  const paper = PAPER[scheme];

  const formatEntryDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const isPremiumUser = useIsPremiumUser();

  const [loaded, setLoaded] = useState(false);
  const [lists, setLists] = useState<SomedayList[]>([]);
  const [selectedListId, setSelectedListId] = useState(DEFAULT_SOMEDAY_LIST_ID);
  const [items, setItems] = useState<SomedayItem[]>([]);
  const [levelInfo, setLevelInfo] = useState<LevelInfo>(getLevelInfo(0));
  const [newItemDraft, setNewItemDraft] = useState('');

  const [completingItem, setCompletingItem] = useState<SomedayItem | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [reflectionPhotoUri, setReflectionPhotoUri] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const [viewingMemory, setViewingMemory] = useState<ViewingMemory | null>(null);

  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [savingList, setSavingList] = useState(false);

  const [toastTitle, setToastTitle] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Seviye kartı (levelInfo) her zaman TÜM listelerin toplamına dayanır — bu yüzden
  // getCompletedCount() burada listId'den bağımsız çağrılıyor; sadece items, seçili
  // listeye (selectedListId) göre filtreleniyor.
  const load = useCallback(async (listId: string) => {
    try {
      await initDatabase();
      const [allLists, listItems, count] = await Promise.all([
        getAllLists(),
        getItemsForList(listId),
        getCompletedCount(),
      ]);
      setLists(allLists);
      setItems(listItems);
      setLevelInfo(getLevelInfo(count));
    } catch (error) {
      console.error('Bir Gün Listesi yüklenemedi:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load(selectedListId);
  }, [load, selectedListId]);

  const showLevelUpToast = (title: string) => {
    setToastTitle(title);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, friction: 7, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setToastTitle(null);
    });
  };

  // completeItem sonrası önce/sonra tamamlanma sayısını karşılaştırıp seviye
  // yükseldiyse kutlama toast'ını tetikler.
  const applyCompletionResult = (beforeCount: number, afterCount: number) => {
    const before = getLevelInfo(beforeCount);
    const after = getLevelInfo(afterCount);
    setLevelInfo(after);
    if (after.level > before.level) showLevelUpToast(after.title);
  };

  const handleAddItem = async () => {
    const trimmed = newItemDraft.trim();
    if (!trimmed) return;
    try {
      await addItem(selectedListId, trimmed);
      setNewItemDraft('');
      setItems(await getItemsForList(selectedListId));
    } catch (error) {
      console.error('Madde eklenemedi:', error);
    }
  };

  const handleSelectList = (listId: string) => {
    setSelectedListId(listId);
  };

  const handleNewListPress = () => {
    if (!isPremiumUser) {
      Alert.alert(t.somedayList.newListUpsellTitle, t.somedayList.newListUpsellMessage);
      return;
    }
    setNewListName('');
    setCreatingList(true);
  };

  const handleCreateList = async () => {
    const trimmed = newListName.trim();
    if (!trimmed) return;
    setSavingList(true);
    try {
      const list = await createList(trimmed);
      setCreatingList(false);
      // Yeni listeye geçiş, seçili listeyi değiştirdiği için yukarıdaki useEffect'i
      // tetikler — bu da lists/items/levelInfo'yu yeniden yükler, burada ayrıca
      // setLists/setItems çağırmaya gerek yok.
      setSelectedListId(list.id);
    } catch (error) {
      console.error('Liste oluşturulamadı:', error);
      Alert.alert(t.somedayList.createListErrorTitle, t.somedayList.createListErrorMessage);
    } finally {
      setSavingList(false);
    }
  };

  const handlePressCheckbox = (item: SomedayItem) => {
    setCompletingItem(item);
    setReflectionText('');
    setReflectionPhotoUri(null);
  };

  const runCompletion = async (options: { reflectionText?: string; photoUri?: string }) => {
    if (!completingItem) return;
    const item = completingItem;
    try {
      const beforeCount = await getCompletedCount();
      await completeItem(item.id, options);
      const afterCount = await getCompletedCount();
      setCompletingItem(null);
      setItems(await getItemsForList(selectedListId));
      applyCompletionResult(beforeCount, afterCount);
    } catch (error) {
      console.error('Madde tamamlanamadı:', error);
      Alert.alert(t.somedayList.completeErrorTitle, t.somedayList.completeErrorMessage);
    }
  };

  const handleConfirmComplete = async () => {
    setCompleting(true);
    try {
      await runCompletion({
        reflectionText: reflectionText.trim() || undefined,
        photoUri: reflectionPhotoUri || undefined,
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleSkipComplete = () => {
    void runCompletion({});
  };

  const handleAddPhotoPress = () => {
    Alert.alert(t.entryForm.addPhoto, undefined, [
      { text: t.entryForm.camera, onPress: () => handlePickPhoto('camera') },
      { text: t.entryForm.gallery, onPress: () => handlePickPhoto('library') },
      { text: t.entryForm.cancel, style: 'cancel' },
    ]);
  };

  const handlePickPhoto = async (source: 'camera' | 'library') => {
    try {
      const uri = await pickAndProcessPhoto(source, {
        permissionTitle: t.entryForm.permissionTitle,
        permissionMessage: t.entryForm.permissionMessage,
      });
      if (uri) setReflectionPhotoUri(uri);
    } catch (error) {
      console.error('Fotoğraf işlenemedi:', error);
    }
  };

  const handleDeleteItem = (item: SomedayItem) => {
    Alert.alert(t.somedayList.deleteConfirmTitle, t.somedayList.deleteConfirmMessage, [
      { text: t.somedayList.cancel, style: 'cancel' },
      {
        text: t.somedayList.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem(item.id);
            setItems(await getItemsForList(selectedListId));
          } catch (error) {
            console.error('Madde silinemedi:', error);
            return;
          }
          if (session) void deleteSomedayItemFromCloud(session.user.id, item.id);
        },
      },
    ]);
  };

  const handlePressCompletedItem = async (item: SomedayItem) => {
    if (!item.completed_entry_id) return;
    try {
      const entry = await getEntryById(item.completed_entry_id);
      // completed_entry_id gevşek bir referans — entry silinmiş ya da (başka bir
      // cihazdan senkronlanmış bir madde için) bu cihaza hiç inmemiş olabilir.
      if (!entry) return;
      const photos = await getPhotosByEntryId(entry.id);
      setViewingMemory({ entry, photoUri: photos[0]?.file_path });
    } catch (error) {
      console.error('Bağlı giriş yüklenemedi:', error);
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

  const incompleteItems = items.filter((i) => i.is_completed === 0);
  const completedItems = items.filter((i) => i.is_completed === 1);
  const progressRatio = levelInfo.completedInCurrentLevel / (levelInfo.completedInCurrentLevel + levelInfo.neededForNextLevel);

  return (
    <Screen colors={colors} edges={['bottom']}>
      {toastTitle && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              backgroundColor: colors.accent,
              opacity: toastAnim,
              transform: [
                { translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
              ],
            },
          ]}
        >
          <Ionicons name="trophy" size={18} color={colors.accentText} />
          <Text style={[styles.toastText, { color: colors.accentText }]}>
            {t.somedayList.levelUpToast(toastTitle)}
          </Text>
        </Animated.View>
      )}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={[styles.levelCard, { backgroundColor: colors.accent }]}>
            <View style={styles.levelCardHeader}>
              <Ionicons name="trophy" size={22} color={colors.accentText} />
              <Text style={[styles.levelCardTitle, { color: colors.accentText }]} numberOfLines={2}>
                {t.somedayList.levelLabel(levelInfo.level)}: {levelInfo.title}
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.accentText, width: `${Math.round(progressRatio * 100)}%` },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: colors.accentText }]}>
              {t.somedayList.nextLevelHint(levelInfo.neededForNextLevel)}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listSelectorRow}
          >
            {lists.map((list) => {
              const selected = list.id === selectedListId;
              // 'default' (is_custom=0) için isim yerine t.somedayList.title gösterilir —
              // DB'deki name sütunu sabit Türkçe seed edildi (bkz. lib/db/init.ts
              // seedDefaultSomedayList), dil değişince de doğru başlığın görünmesi için.
              const label = list.is_custom === 0 ? t.somedayList.title : list.name;
              return (
                <Pressable
                  key={list.id}
                  style={[
                    styles.listChip,
                    {
                      borderColor: colors.border,
                      backgroundColor: selected ? colors.accent : colors.card,
                    },
                  ]}
                  onPress={() => handleSelectList(list.id)}
                >
                  <Text
                    style={[styles.listChipText, { color: selected ? colors.accentText : colors.text }]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.listChip, { borderColor: colors.accent, borderStyle: 'dashed' }]}
              onPress={handleNewListPress}
            >
              <Text style={[styles.listChipText, { color: colors.accent }]} numberOfLines={1}>
                {t.somedayList.newListChip}
              </Text>
            </Pressable>
          </ScrollView>

          <View style={[styles.addRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.addInput, { color: colors.text }]}
              placeholder={t.somedayList.addPlaceholder}
              placeholderTextColor={colors.subtext}
              value={newItemDraft}
              onChangeText={setNewItemDraft}
              onSubmitEditing={handleAddItem}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.addButton, { backgroundColor: newItemDraft.trim() ? colors.accent : colors.border }]}
              onPress={handleAddItem}
              disabled={!newItemDraft.trim()}
            >
              <Ionicons name="add" size={20} color={newItemDraft.trim() ? colors.accentText : colors.subtext} />
            </Pressable>
          </View>

          {incompleteItems.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.subtext }]}>{t.somedayList.emptyState}</Text>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {incompleteItems.map((item, i) => (
                <View
                  key={item.id}
                  style={[
                    styles.row,
                    i < incompleteItems.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Pressable style={styles.rowMain} onPress={() => handlePressCheckbox(item)}>
                    <Ionicons name="ellipse-outline" size={22} color={colors.subtext} />
                    <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => handleDeleteItem(item)}>
                    <Ionicons name="trash-outline" size={18} color={colors.subtext} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
              {t.somedayList.completedSectionTitle}
            </Text>
            {completedItems.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.subtext }]}>{t.somedayList.noCompletedYet}</Text>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {completedItems.map((item, i) => (
                  <View
                    key={item.id}
                    style={[
                      styles.row,
                      i < completedItems.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <Pressable
                      style={styles.rowMain}
                      onPress={() => handlePressCompletedItem(item)}
                      disabled={!item.completed_entry_id}
                    >
                      <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                      <Text
                        style={[styles.itemTitle, styles.itemTitleDone, { color: colors.subtext }]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                      {item.completed_entry_id && (
                        <Ionicons name="chevron-forward" size={16} color={colors.subtext} />
                      )}
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => handleDeleteItem(item)}>
                      <Ionicons name="trash-outline" size={18} color={colors.subtext} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Tamamlama akışı: yansıma/fotoğraf isteğe bağlı — X = atla, Tamamla = ne
          girildiyse onunla kaydet (boş bırakılırsa fonksiyonel olarak atlamayla aynı). */}
      <Modal
        visible={!!completingItem}
        animationType="slide"
        transparent
        onRequestClose={() => setCompletingItem(null)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {t.somedayList.reflectionPromptTitle}
              </Text>
              <Pressable onPress={handleSkipComplete}>
                <Ionicons name="close" size={22} color={colors.subtext} />
              </Pressable>
            </View>
            <Text style={[styles.sheetSubtitle, { color: colors.subtext }]}>
              {t.somedayList.reflectionPromptSubtitle}
            </Text>

            <View style={[styles.textCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                multiline
                placeholder={t.somedayList.reflectionPlaceholder}
                placeholderTextColor={colors.subtext}
                value={reflectionText}
                onChangeText={setReflectionText}
              />
            </View>

            {reflectionPhotoUri ? (
              <Pressable onPress={() => setReflectionPhotoUri(null)}>
                <Image source={{ uri: reflectionPhotoUri }} style={styles.photoPreview} />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.photoButton, { borderColor: colors.border }]}
                onPress={handleAddPhotoPress}
              >
                <Ionicons name="camera-outline" size={18} color={colors.accent} />
                <Text style={[styles.photoButtonText, { color: colors.accent }]}>{t.entryForm.addPhoto}</Text>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: colors.accent, opacity: pressed || completing ? 0.85 : 1 },
              ]}
              disabled={completing}
              onPress={handleConfirmComplete}
            >
              {completing ? (
                <ActivityIndicator color={colors.accentText} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.accentText }]}>
                  {t.somedayList.completeAction}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Tamamlanmış bir maddeye bağlı anı — kapsül/Geleceğe Mektup ile aynı
          kağıt-stili, salt okunur kart. */}
      <Modal
        visible={!!viewingMemory}
        animationType="slide"
        transparent
        onRequestClose={() => setViewingMemory(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {viewingMemory ? formatEntryDate(viewingMemory.entry.date) : ''}
              </Text>
              <Pressable onPress={() => setViewingMemory(null)}>
                <Ionicons name="close" size={22} color={colors.subtext} />
              </Pressable>
            </View>
            {viewingMemory && (
              <ScrollView>
                <View style={[styles.paperCard, { backgroundColor: paper.bg }]}>
                  <View style={[styles.paperMargin, { backgroundColor: paper.margin }]} />
                  <View style={styles.paperContent}>
                    <Text style={[styles.paperText, { color: colors.text }]}>
                      {viewingMemory.entry.content}
                    </Text>
                    {viewingMemory.photoUri && (
                      <Image source={{ uri: viewingMemory.photoUri }} style={styles.paperPhoto} />
                    )}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Yeni özel liste oluşturma — sadece premium kullanıcı buraya ulaşabilir
          (bkz. handleNewListPress'teki upsell Alert'i). */}
      <Modal
        visible={creatingList}
        animationType="slide"
        transparent
        onRequestClose={() => setCreatingList(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {t.somedayList.newListPromptTitle}
              </Text>
              <Pressable onPress={() => setCreatingList(false)}>
                <Ionicons name="close" size={22} color={colors.subtext} />
              </Pressable>
            </View>

            <View style={[styles.textCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.nameInput, { color: colors.text }]}
                placeholder={t.somedayList.newListPlaceholder}
                placeholderTextColor={colors.subtext}
                value={newListName}
                onChangeText={setNewListName}
                autoFocus
                onSubmitEditing={handleCreateList}
                returnKeyType="done"
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor: colors.accent,
                  opacity: pressed || savingList || !newListName.trim() ? 0.85 : 1,
                },
              ]}
              disabled={savingList || !newListName.trim()}
              onPress={handleCreateList}
            >
              {savingList ? (
                <ActivityIndicator color={colors.accentText} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.accentText }]}>
                  {t.somedayList.createListAction}
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
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: 16,
    gap: 14,
  },
  toast: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  levelCard: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  levelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    flexShrink: 1,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  listSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  listChip: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 14,
    maxWidth: 180,
  },
  listChipText: {
    fontSize: 13,
    fontWeight: '700',
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
  sheetSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
  },
  textCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  input: {
    minHeight: 100,
    padding: 14,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  nameInput: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    paddingVertical: 12,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
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
  paperContent: {
    flex: 1,
    gap: 12,
  },
  paperText: {
    fontSize: 15,
    lineHeight: 22,
  },
  paperPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 10,
  },
});
