import { useRef, useState } from 'react';
import {
  Alert,
  Image,
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, type Palette } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useSettingsStore } from '../lib/store/settingsStore';
import { pickAndProcessPhoto } from '../lib/photoPicker';
import LocationPicker, { type LocationValue } from './LocationPicker';
import type { Category } from '../lib/db/types';

export const MOODS = ['😊', '😐', '😢', '😡', '😴', '🥰', '😰', '🤒', '😌', '🎉', '😔', '🤔'];

interface EntryFormProps {
  date: Date;
  onChangeDate: (date: Date) => void;
  content: string;
  onChangeContent: (text: string) => void;
  mood: string | null;
  onChangeMood: (mood: string | null) => void;
  categories: Category[];
  categoryId: string | null;
  onChangeCategoryId: (id: string) => void;
  photoPath: string | null;
  onChangePhotoPath: (path: string | null) => void;
  location: LocationValue | null;
  onChangeLocation: (value: LocationValue | null) => void;
  onSubmit: () => void;
  submitLabel: string;
}

function SectionLabel({
  icon,
  text,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  colors: Palette;
}) {
  return (
    <View style={styles.sectionLabelRow}>
      <Ionicons name={icon} size={14} color={colors.subtext} />
      <Text style={[styles.label, { color: colors.subtext }]}>{text}</Text>
    </View>
  );
}

export default function EntryForm({
  date,
  onChangeDate,
  content,
  onChangeContent,
  mood,
  onChangeMood,
  categories,
  categoryId,
  onChangeCategoryId,
  photoPath,
  onChangePhotoPath,
  location,
  onChangeLocation,
  onSubmit,
  submitLabel,
}: EntryFormProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const [showPicker, setShowPicker] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [customMoodDraft, setCustomMoodDraft] = useState('');
  const [customMoodFocused, setCustomMoodFocused] = useState(false);
  const customMoodInputRef = useRef<TextInput>(null);

  // Kullanıcının klavyeden girdiği, MOODS listesinde olmayan bir emoji zaten seçiliyse
  // (ör. daha önce eklenmiş bir giriş düzenleniyorsa) onu da bir chip olarak göster,
  // aksi halde listede karşılığı olmadığı için sessizce kaybolurdu.
  const customMoodActive = mood !== null && !MOODS.includes(mood);

  const commitCustomMood = () => {
    const trimmed = customMoodDraft.trim();
    if (trimmed) onChangeMood(trimmed);
    setCustomMoodDraft('');
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const handlePickPhoto = async (source: 'camera' | 'library') => {
    setProcessingPhoto(true);
    try {
      const uri = await pickAndProcessPhoto(source, {
        permissionTitle: t.entryForm.permissionTitle,
        permissionMessage: t.entryForm.permissionMessage,
      });
      if (uri) onChangePhotoPath(uri);
    } catch (error) {
      console.error('Fotoğraf işlenemedi:', error);
      Alert.alert(t.entryForm.photoErrorTitle, t.entryForm.photoErrorMessage);
    } finally {
      setProcessingPhoto(false);
    }
  };

  const handleAddPhotoPress = () => {
    Alert.alert(t.entryForm.addPhoto, undefined, [
      { text: t.entryForm.camera, onPress: () => handlePickPhoto('camera') },
      { text: t.entryForm.gallery, onPress: () => handlePickPhoto('library') },
      { text: t.entryForm.cancel, style: 'cancel' },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setShowPicker(true)}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.accent} />
        <Text style={[styles.dateText, { color: colors.text }]}>{formatDate(date)}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.subtext} />
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={(_event, selected) => {
            setShowPicker(false);
            if (selected) onChangeDate(selected);
          }}
        />
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          multiline
          placeholder={t.entryForm.placeholder}
          placeholderTextColor={colors.subtext}
          value={content}
          onChangeText={onChangeContent}
        />
      </View>

      <View style={styles.section}>
        <SectionLabel icon="pricetag-outline" text={t.entryForm.category} colors={colors} />
        <View style={styles.row}>
          {categories.map((category) => {
            const selected = categoryId === category.id;
            return (
              <Pressable
                key={category.id}
                style={[
                  styles.chip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selected && { backgroundColor: category.color, borderColor: category.color },
                ]}
                onPress={() => onChangeCategoryId(category.id)}
              >
                {!selected && <View style={[styles.chipDot, { backgroundColor: category.color }]} />}
                <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.text }]}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel icon="happy-outline" text={t.entryForm.mood} colors={colors} />
        <View style={styles.row}>
          {MOODS.map((emoji) => {
            const selected = mood === emoji;
            return (
              <Pressable
                key={emoji}
                style={[
                  styles.moodButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selected && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                onPress={() => onChangeMood(selected ? null : emoji)}
              >
                <Text style={styles.moodEmoji}>{emoji}</Text>
              </Pressable>
            );
          })}
          {customMoodActive && (
            <Pressable
              style={[
                styles.moodButton,
                { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
              onPress={() => onChangeMood(null)}
            >
              <Text style={styles.moodEmoji}>{mood}</Text>
            </Pressable>
          )}
          <View
            style={[
              styles.moodButton,
              styles.moodCustomButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TextInput
              ref={customMoodInputRef}
              style={[styles.moodCustomInput, { color: colors.text }]}
              value={customMoodDraft}
              onChangeText={setCustomMoodDraft}
              onFocus={() => setCustomMoodFocused(true)}
              onBlur={() => {
                setCustomMoodFocused(false);
                commitCustomMood();
              }}
              onSubmitEditing={() => customMoodInputRef.current?.blur()}
              returnKeyType="done"
            />
            {!customMoodFocused && !customMoodDraft && (
              <Ionicons
                name="add"
                size={22}
                color={colors.text}
                style={styles.moodCustomIcon}
                pointerEvents="none"
              />
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel icon="location-outline" text={t.tripLocation.sectionTitle} colors={colors} />
        <LocationPicker value={location} onChange={onChangeLocation} colors={colors} />
      </View>

      <View style={styles.section}>
        <SectionLabel icon="image-outline" text={t.entryForm.photo} colors={colors} />
        {photoPath ? (
          <View style={styles.photoPreviewWrap}>
            <Image source={{ uri: photoPath }} style={styles.photoPreview} />
            <Pressable style={styles.photoRemove} onPress={() => onChangePhotoPath(null)}>
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.photoButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            disabled={processingPhoto}
            onPress={handleAddPhotoPress}
          >
            <Ionicons name="camera-outline" size={18} color={colors.text} />
            <Text style={[styles.photoButtonText, { color: colors.text }]}>
              {processingPhoto ? t.entryForm.uploading : t.entryForm.addPhoto}
            </Text>
          </Pressable>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={onSubmit}
      >
        <Text style={[styles.submitText, { color: colors.accentText }]}>{submitLabel}</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 16,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
  },
  input: {
    minHeight: 140,
    padding: 12,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  section: {
    gap: 8,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  moodButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodEmoji: {
    fontSize: 22,
  },
  moodCustomButton: {
    position: 'relative',
  },
  moodCustomInput: {
    ...StyleSheet.absoluteFill,
    fontSize: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 0,
  },
  moodCustomIcon: {
    ...StyleSheet.absoluteFill,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoPreviewWrap: {
    alignSelf: 'flex-start',
  },
  photoPreview: {
    width: 110,
    height: 110,
    borderRadius: 12,
  },
  photoRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
