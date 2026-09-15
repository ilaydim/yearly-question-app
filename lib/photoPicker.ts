import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';

export async function pickAndProcessPhoto(
  source: 'camera' | 'library',
  messages: { permissionTitle: string; permissionMessage: string }
): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert(messages.permissionTitle, messages.permissionMessage);
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
