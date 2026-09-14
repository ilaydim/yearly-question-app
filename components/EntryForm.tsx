import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import type { Category } from '../lib/db/types';

export const MOODS = ['😊', '😐', '😢', '😡', '😴'];

function formatDate(date: Date): string {
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function pickAndProcessPhoto(source: 'camera' | 'library'): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert('İzin gerekli', 'Fotoğraf eklemek için izin vermelisin.');
    return null;
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

  if (result.canceled || !result.assets[0]) return null;

  const manipulated = await ImageManipulator.manipulate(result.assets[0].uri)
    .resize({ width: 1280, height: null })
    .renderAsync()
    .then((ref) => ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 }));

  const destination = new File(new Directory(Paths.document), `photo-${Date.now()}.jpg`);
  await new File(manipulated.uri).copy(destination);
  return destination.uri;
}

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
  onSubmit,
  submitLabel,
}: EntryFormProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  const handlePickPhoto = async (source: 'camera' | 'library') => {
    setProcessingPhoto(true);
    try {
      const uri = await pickAndProcessPhoto(source);
      if (uri) onChangePhotoPath(uri);
    } catch (error) {
      console.error('Fotoğraf işlenemedi:', error);
      Alert.alert('Hata', 'Fotoğraf eklenemedi.');
    } finally {
      setProcessingPhoto(false);
    }
  };

  const handleAddPhotoPress = () => {
    Alert.alert('Fotoğraf Ekle', undefined, [
      { text: 'Kamera', onPress: () => handlePickPhoto('camera') },
      { text: 'Galeri', onPress: () => handlePickPhoto('library') },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.dateText}>{formatDate(date)}</Text>
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
        style={styles.input}
        multiline
        placeholder="Bugün ne oldu?"
        value={content}
        onChangeText={onChangeContent}
      />

      <Text style={styles.label}>Kategori</Text>
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
              <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Ruh Hali</Text>
      <View style={styles.row}>
        {MOODS.map((emoji) => (
          <Pressable
            key={emoji}
            style={[styles.moodButton, mood === emoji && styles.moodButtonSelected]}
            onPress={() => onChangeMood(mood === emoji ? null : emoji)}
          >
            <Text style={styles.moodEmoji}>{emoji}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Fotoğraf</Text>
      {photoPath ? (
        <View style={styles.photoPreviewWrap}>
          <Image source={{ uri: photoPath }} style={styles.photoPreview} />
          <Pressable style={styles.photoRemove} onPress={() => onChangePhotoPath(null)}>
            <Text style={styles.photoRemoveText}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.photoButton}
          disabled={processingPhoto}
          onPress={handleAddPhotoPress}
        >
          <Text style={styles.photoButtonText}>
            {processingPhoto ? 'Yükleniyor…' : 'Fotoğraf Ekle'}
          </Text>
        </Pressable>
      )}

      <Pressable style={styles.submitButton} onPress={onSubmit}>
        <Text style={styles.submitText}>{submitLabel}</Text>
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
    borderRadius: 8,
    backgroundColor: '#F1F1F4',
    alignSelf: 'flex-start',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    minHeight: 140,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
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
  chipTextSelected: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  moodButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F1F4',
  },
  moodButtonSelected: {
    backgroundColor: '#4F46E5',
  },
  moodEmoji: {
    fontSize: 22,
  },
  photoButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F1F1F4',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
