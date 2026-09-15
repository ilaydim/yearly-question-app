import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useSettingsStore } from '../lib/store/settingsStore';
import { pickAndProcessPhoto } from '../lib/photoPicker';
import LocationPicker, { type LocationValue } from './LocationPicker';
import { TRIP_CATEGORY_ID } from '../lib/db/init';
import type { Category } from '../lib/db/types';

export const MOODS = ['😊', '😐', '😢', '😡', '😴'];

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

  const formatDate = (d: Date) =>
    d.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
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
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.container}
    >
      <Pressable
        style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setShowPicker(true)}
      >
        <Text style={[styles.dateText, { color: colors.text }]}>{formatDate(date)}</Text>
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

      <TextInput
        style={[
          styles.input,
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
        ]}
        multiline
        placeholder={t.entryForm.placeholder}
        placeholderTextColor={colors.subtext}
        value={content}
        onChangeText={onChangeContent}
      />

      <Text style={[styles.label, { color: colors.subtext }]}>{t.entryForm.category}</Text>
      <View style={styles.row}>
        {categories.map((category) => {
          const selected = categoryId === category.id;
          return (
            <Pressable
              key={category.id}
              style={[
                styles.chip,
                { borderColor: category.color },
                selected && { backgroundColor: category.color },
              ]}
              onPress={() => onChangeCategoryId(category.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? '#FFFFFF' : colors.text },
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.subtext }]}>{t.entryForm.mood}</Text>
      <View style={styles.row}>
        {MOODS.map((emoji) => {
          const selected = mood === emoji;
          return (
            <Pressable
              key={emoji}
              style={[
                styles.moodButton,
                { backgroundColor: colors.card },
                selected && { backgroundColor: colors.accent },
              ]}
              onPress={() => onChangeMood(selected ? null : emoji)}
            >
              <Text style={styles.moodEmoji}>{emoji}</Text>
            </Pressable>
          );
        })}
      </View>

      {categoryId === TRIP_CATEGORY_ID && (
        <>
          <Text style={[styles.label, { color: colors.subtext }]}>
            {t.tripLocation.sectionTitle}
          </Text>
          <LocationPicker value={location} onChange={onChangeLocation} colors={colors} />
        </>
      )}

      <Text style={[styles.label, { color: colors.subtext }]}>{t.entryForm.photo}</Text>
      {photoPath ? (
        <View style={styles.photoPreviewWrap}>
          <Image source={{ uri: photoPath }} style={styles.photoPreview} />
          <Pressable style={styles.photoRemove} onPress={() => onChangePhotoPath(null)}>
            <Text style={styles.photoRemoveText}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.photoButton, { backgroundColor: colors.card }]}
          disabled={processingPhoto}
          onPress={handleAddPhotoPress}
        >
          <Text style={[styles.photoButtonText, { color: colors.text }]}>
            {processingPhoto ? t.entryForm.uploading : t.entryForm.addPhoto}
          </Text>
        </Pressable>
      )}

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
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 12,
  },
  dateButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    minHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  moodButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodEmoji: {
    fontSize: 22,
  },
  photoButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoPreviewWrap: {
    alignSelf: 'flex-start',
  },
  photoPreview: {
    width: 96,
    height: 96,
    borderRadius: 8,
  },
  photoRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  submitButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
