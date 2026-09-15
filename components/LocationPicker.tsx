import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type LatLng } from 'react-native-maps';
import { useT } from '../lib/i18n';
import type { Palette } from '../lib/theme';
import {
  getCurrentCoordinates,
  requestLocationPermission,
  reverseGeocode,
} from '../lib/location';

export interface LocationValue {
  latitude: number;
  longitude: number;
  locationName: string | null;
  country: string | null;
}

interface LocationPickerProps {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  colors: Palette;
}

const DELTA = 0.01;

export default function LocationPicker({ value, onChange, colors }: LocationPickerProps) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [resolvingName, setResolvingName] = useState(false);

  const handleAddLocation = async () => {
    setLoading(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert(t.tripLocation.permissionTitle, t.tripLocation.permissionMessage);
        return;
      }
      const coords = await getCurrentCoordinates();
      const { locationName, country } = await reverseGeocode(coords);
      onChange({ ...coords, locationName, country });
    } catch (error) {
      console.error('Konum alınamadı:', error);
      Alert.alert(t.tripLocation.errorTitle, t.tripLocation.errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (coordinate: LatLng) => {
    if (!value) return;
    onChange({ ...value, latitude: coordinate.latitude, longitude: coordinate.longitude });
    setResolvingName(true);
    try {
      const { locationName, country } = await reverseGeocode(coordinate);
      onChange({ ...coordinate, locationName, country });
    } catch (error) {
      console.error('Konum adı çözülemedi:', error);
    } finally {
      setResolvingName(false);
    }
  };

  if (!value) {
    return (
      <Pressable
        style={[styles.addButton, { backgroundColor: colors.card }]}
        disabled={loading}
        onPress={handleAddLocation}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={[styles.addButtonText, { color: colors.text }]}>
            {t.tripLocation.addLocation}
          </Text>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.mapWrap, { borderColor: colors.border }]}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: value.latitude,
            longitude: value.longitude,
            latitudeDelta: DELTA,
            longitudeDelta: DELTA,
          }}
        >
          <Marker
            coordinate={{ latitude: value.latitude, longitude: value.longitude }}
            draggable
            onDragEnd={(e) => handleDragEnd(e.nativeEvent.coordinate)}
          />
        </MapView>
      </View>
      <View style={styles.footer}>
        {resolvingName ? (
          <ActivityIndicator size="small" color={colors.subtext} />
        ) : (
          <Text style={[styles.locationName, { color: colors.text }]} numberOfLines={1}>
            {value.locationName ?? t.tripLocation.unknownPlace}
          </Text>
        )}
        <Pressable onPress={() => onChange(null)}>
          <Text style={[styles.removeText, { color: colors.danger }]}>
            {t.tripLocation.removeLocation}
          </Text>
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: colors.subtext }]}>{t.tripLocation.dragHint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  wrap: {
    gap: 6,
  },
  mapWrap: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  removeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    fontSize: 11,
  },
});
