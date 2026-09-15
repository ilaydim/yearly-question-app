import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import MapView, { Callout, Marker, type Region } from 'react-native-maps';
import Screen from '../../components/Screen';
import { getEntriesWithLocation } from '../../lib/db/entries';
import { getAllCategories } from '../../lib/db/categories';
import { getPhotoMap } from '../../lib/db/photos';
import { initDatabase } from '../../lib/db/init';
import { useTheme, type Palette } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import type { Category, Entry } from '../../lib/db/types';

// TODO: IAP kurulunca bu flag'i gerçek "kullanıcı premium mi" kontrolüne bağla
// (ör. bir entitlements store'undan okunacak). true olduğunda aşağıdaki paywall
// overlay'i haritanın üstünü kaplayıp etkileşimi engelleyecek şekilde zaten hazır.
const MAP_VIEW_REQUIRES_PREMIUM = false;

function useIsPremiumUser(): boolean {
  // TODO: IAP kurulunca gerçek entitlement kontrolüyle değiştir.
  return false;
}

// Hiç konumlu giriş yokken (ya da yüklenmeden önce initialRegion için) gösterilen,
// tüm dünyayı kapsayan varsayılan görünüm — bu ekran sadece anılara bakmak için,
// giriş eklemeye yönlendiren bir CTA'sı yok.
const WORLD_REGION: Region = {
  latitude: 20,
  longitude: 10,
  latitudeDelta: 120,
  longitudeDelta: 120,
};

// Bu iki eşik, haritanın hangi "kademede" gruplama yapacağını belirliyor:
// dünya/kıta görünümünde ülkeye, ülke/bölge görünümünde şehre, iyice
// yakınlaşınca tek tek anılara göre gösteriyoruz. Gerçek cihazda denendikçe
// ince ayar gerekebilir — kesin bilimsel bir değer değil, göz kararı bir sezgi.
const COUNTRY_TIER_MIN_DELTA = 25;
const CITY_TIER_MIN_DELTA = 4;

type MapTier = 'country' | 'city' | 'individual';

type LocatedEntry = Entry & { latitude: number; longitude: number };

interface MapGroup {
  key: string;
  label: string;
  coordinate: { latitude: number; longitude: number };
  entries: LocatedEntry[];
}

function hasLocation(entry: Entry): entry is LocatedEntry {
  return entry.latitude != null && entry.longitude != null;
}

function tierForRegion(region: Region): MapTier {
  if (region.latitudeDelta > COUNTRY_TIER_MIN_DELTA) return 'country';
  if (region.latitudeDelta > CITY_TIER_MIN_DELTA) return 'city';
  return 'individual';
}

function regionForEntries(entries: LocatedEntry[]): Region {
  const lats = entries.map((e) => e.latitude);
  const lngs = entries.map((e) => e.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat, 0.05) * 1.6,
    longitudeDelta: Math.max(maxLng - minLng, 0.05) * 1.6,
  };
}

// location_name her zaman "ilçe, şehir" (ya da sadece "şehir") formatında saklandığından
// (bkz. lib/location.ts), şehir grubu için son virgülden sonraki (ya da tek parçaysa
// tamamı) kısmı alıyoruz — ayrı bir "city" sütunu tutmadan yeterince tutarlı bir anahtar.
function cityKey(entry: LocatedEntry, unknownLabel: string): string {
  if (!entry.location_name) return entry.country ?? unknownLabel;
  const parts = entry.location_name
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || entry.location_name;
}

function groupEntries(
  entries: LocatedEntry[],
  keyFn: (entry: LocatedEntry) => string
): MapGroup[] {
  const map = new Map<string, LocatedEntry[]>();
  for (const entry of entries) {
    const key = keyFn(entry);
    const list = map.get(key);
    if (list) list.push(entry);
    else map.set(key, [entry]);
  }
  return Array.from(map.entries()).map(([key, group]) => ({
    key,
    label: key,
    coordinate: regionForEntries(group),
    entries: group,
  }));
}

function GroupMarker({
  group,
  photos,
  categories,
  colors,
  onPress,
}: {
  group: MapGroup;
  photos: Record<string, string>;
  categories: Record<string, Category>;
  colors: Palette;
  onPress: () => void;
}) {
  const withPhoto = group.entries.find((entry) => photos[entry.id]);
  const thumbUri = withPhoto ? photos[withPhoto.id] : undefined;
  const swatchColor = categories[group.entries[0]?.category_id]?.color ?? colors.accent;

  return (
    <Marker coordinate={group.coordinate} onPress={onPress} tracksViewChanges>
      <View style={[styles.groupPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.groupThumb} />
        ) : (
          <View style={[styles.groupThumb, { backgroundColor: swatchColor }]} />
        )}
        <Text style={[styles.groupLabel, { color: colors.text }]} numberOfLines={1}>
          {group.label} · {group.entries.length}
        </Text>
      </View>
    </Marker>
  );
}

export default function MapScreen() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const [entries, setEntries] = useState<LocatedEntry[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [region, setRegion] = useState<Region>(WORLD_REGION);

  const mapRef = useRef<MapView>(null);

  const isPremiumUser = useIsPremiumUser();
  const showPaywall = MAP_VIEW_REQUIRES_PREMIUM && !isPremiumUser;

  const load = useCallback(async () => {
    try {
      await initDatabase();
      const [entryRows, categoryRows, photoMap] = await Promise.all([
        getEntriesWithLocation(),
        getAllCategories(),
        getPhotoMap(),
      ]);
      setEntries(entryRows.filter(hasLocation));
      setCategories(Object.fromEntries(categoryRows.map((c) => [c.id, c])));
      setPhotos(photoMap);
    } catch (error) {
      console.error('Harita verisi yüklenemedi:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Yalnızca ilk yükleme tamamlandığında haritanın başlangıç görünümüyle aynı
  // bölgeyi (tüm girişleri kapsayan alan ya da boşsa dünya) kademe hesaplamasına
  // da veriyoruz — sonrasında kullanıcının kendi kaydırma/yakınlaştırması
  // onRegionChangeComplete ile devralıyor, burada tekrar ezilmiyor.
  useEffect(() => {
    if (loaded) {
      setRegion(entries.length > 0 ? regionForEntries(entries) : WORLD_REGION);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const tier = tierForRegion(region);
  const unknownLabel = t.tripLocation.unknownPlace;

  const groups = useMemo(() => {
    if (tier === 'individual') return null;
    const keyFn =
      tier === 'country'
        ? (entry: LocatedEntry) => entry.country ?? unknownLabel
        : (entry: LocatedEntry) => cityKey(entry, unknownLabel);
    return groupEntries(entries, keyFn);
  }, [tier, entries, unknownLabel]);

  const zoomToGroup = useCallback((group: MapGroup) => {
    mapRef.current?.animateToRegion(regionForEntries(group.entries), 450);
  }, []);

  if (!loaded) {
    return (
      <Screen colors={colors} title={t.tabs.map}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen colors={colors} edges={['top']}>
      <View style={styles.flex}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={entries.length > 0 ? regionForEntries(entries) : WORLD_REGION}
          onRegionChangeComplete={setRegion}
        >
          {tier === 'individual'
            ? entries.map((entry) => {
                const photoUri = photos[entry.id];
                const color = categories[entry.category_id]?.color ?? colors.accent;
                return (
                  <Marker
                    key={entry.id}
                    coordinate={{ latitude: entry.latitude, longitude: entry.longitude }}
                    tracksViewChanges={!!photoUri}
                  >
                    {photoUri ? (
                      <View style={[styles.photoMarkerRing, { borderColor: color }]}>
                        <Image source={{ uri: photoUri }} style={styles.photoMarkerImage} />
                      </View>
                    ) : (
                      <View style={[styles.dotMarkerRing, { borderColor: color }]}>
                        <View style={[styles.dotMarker, { backgroundColor: color }]} />
                      </View>
                    )}
                    <Callout onPress={() => router.push(`/entry/${entry.id}`)}>
                      <View style={styles.callout}>
                        <Text style={styles.calloutDate}>{entry.date}</Text>
                        {entry.location_name && (
                          <Text style={styles.calloutLocation}>{entry.location_name}</Text>
                        )}
                      </View>
                    </Callout>
                  </Marker>
                );
              })
            : groups?.map((group) => (
                <GroupMarker
                  key={group.key}
                  group={group}
                  photos={photos}
                  categories={categories}
                  colors={colors}
                  onPress={() => zoomToGroup(group)}
                />
              ))}
        </MapView>

        {showPaywall && (
          <View style={[styles.paywall, { backgroundColor: colors.bg }]}>
            <Text style={[styles.paywallTitle, { color: colors.text }]}>{t.map.upsellTitle}</Text>
            <Text style={[styles.paywallMessage, { color: colors.subtext }]}>
              {t.map.upsellMessage}
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  callout: {
    minWidth: 140,
    gap: 2,
  },
  calloutDate: {
    fontSize: 13,
    fontWeight: '700',
  },
  calloutLocation: {
    fontSize: 12,
    color: '#555',
  },
  photoMarkerRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    padding: 2,
    backgroundColor: '#FFFFFF',
  },
  photoMarkerImage: {
    flex: 1,
    borderRadius: 16,
  },
  dotMarkerRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  groupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    paddingLeft: 4,
    maxWidth: 160,
  },
  groupThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  paywall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  paywallTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  paywallMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
});
