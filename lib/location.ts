import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentCoordinates(): Promise<Coordinates> {
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

export interface ReverseGeocodeResult {
  locationName: string | null;
  country: string | null;
}

// Okunabilir bir yer adı (örn. "Kadıköy, İstanbul") ve ayrıca ülke adını AYRI bir
// alan olarak döndürür — location_name içine gömmüyoruz çünkü harita ekranında
// dünya görünümünde ülkeye, ülke görünümünde şehre göre kümeleme yapabilmek için
// ülkenin kendi başına, tutarlı bir alan olması gerekiyor. Reverse geocoding
// başarısız olursa (ağ yok, sonuç boş vs.) ikisi de null döner — çağıran taraf bu
// durumda sadece koordinatları kaydedebilir.
export async function reverseGeocode(coords: Coordinates): Promise<ReverseGeocodeResult> {
  try {
    const results = await Location.reverseGeocodeAsync(coords);
    const place = results[0];
    if (!place) return { locationName: null, country: null };
    const parts = [place.district ?? place.subregion, place.city ?? place.region].filter(
      (part): part is string => !!part
    );
    const locationName = parts.length > 0 ? parts.join(', ') : (place.country ?? null);
    return { locationName, country: place.country ?? null };
  } catch (error) {
    console.error('Ters coğrafi kodlama başarısız:', error);
    return { locationName: null, country: null };
  }
}
