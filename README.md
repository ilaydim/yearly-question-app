# Yearly Question App

Her gün için sabit bir soru soran, cevapların yıllar boyunca biriktiği; aynı zamanda
serbest günlük yazma, fotoğraf, konum ve kategori desteği olan bir günlük uygulaması.
Yerel-öncelikli (local-first) çalışır — hesap açmadan da tam işlevseldir; hesap açılırsa
bulut yedekleme, cihazlar arası geri yükleme ve profil senkronu gibi ek özellikler devreye girer.

Yapılan ve planlanan işlerin listesi için [ROADMAP.md](ROADMAP.md)'ye bakabilirsin.

## Teknoloji Yığını

| Katman | Kullanılan |
|---|---|
| Framework | [Expo](https://expo.dev) (SDK 57) + React Native 0.86 + React 19 |
| Dil | TypeScript |
| Yönlendirme (routing) | [expo-router](https://docs.expo.dev/router/introduction/) (dosya tabanlı, `Stack` + `Tabs`) |
| Yerel veritabanı | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) — tüm günlük verisi cihazda saklanır |
| Durum yönetimi | [zustand](https://github.com/pmndrs/zustand) (+ `persist` middleware, AsyncStorage üzerinden) |
| Bulut (isteğe bağlı) | [Supabase](https://supabase.com) — auth, Postgres, Storage |
| Kimlik doğrulama | Supabase e-posta/şifre auth (isteğe bağlı; hesapsız kullanım her zaman mümkün) |
| Bildirimler | expo-notifications (yerel/local, günlük hatırlatma) |
| Konum & Harita | expo-location, react-native-maps |
| Fotoğraf | expo-image-picker, expo-image-manipulator, expo-file-system |
| Görsel paylaşım | react-native-view-shot, expo-sharing |
| Güvenlik | expo-secure-store, expo-crypto (PIN kilidi hash'i) |
| Animasyon | react-native-reanimated, lottie-react-native |
| i18n | Kendi yazılmış basit sözlük yapısı (`lib/i18n`) — Türkçe / İngilizce |
| Tema | Kendi yazılmış tema sistemi (`lib/theme.ts`) — açık/koyu/sistem |

## Özellikler (özet)

- Serbest günlük yazma + her gün için sabit/döngüsel soru-cevap sistemi
- Kategoriler (Kişisel, İş, Rüya, Gezi, Soru Günlüğü) ve gezi girişlerinde konum/harita
- Fotoğraf ekleme, arama, "Geçmiş Yıllarda Bugün" kartları, basit istatistikler
- Girişleri görsel kart olarak paylaşma
- İsteğe bağlı hesap: bulut yedekleme/geri yükleme, profil senkronu, geri bildirim gönderme
- Uygulama geneli PIN kilidi
- Açık/koyu tema, Türkçe/İngilizce dil desteği, günlük hatırlatma bildirimi

Detaylı liste için [ROADMAP.md](ROADMAP.md).

## Proje Yapısı

```
app/                  expo-router sayfaları (her dosya bir ekran)
  (tabs)/             Ana Sayfa, Soru, Takvim, Harita, Profil sekmeleri
  (auth)/             Giriş / Kayıt ekranları
  entry/               Yeni giriş / giriş detayı
  ...                  settings, stats, feedback, backup/restore, PIN ekranları vb.
components/           Paylaşılan UI bileşenleri (EntryForm, LocationPicker, PinPad, ...)
lib/
  db/                 SQLite şeması ve CRUD fonksiyonları
  store/              zustand store'ları (auth, ayarlar, profil, backup, PIN kilidi ...)
  supabase/           Supabase client + auth/profil/backup fonksiyonları
  i18n/               Türkçe/İngilizce sözlükler
  security/           PIN hash'leme (SecureStore + SHA-256)
  theme.ts            Renk paleti ve tema mantığı
supabase/migrations/  Supabase SQL Editor'de sırayla çalıştırılacak migration dosyaları
assets/               İkonlar, splash görselleri, Lottie animasyonları, soru veri setleri
```

## Kurulum

### 1. Bağımlılıklar

```bash
npm install
```

> Not: Bazı Expo paketleri arasında peer-dependency uyarıları çıkabiliyor; proje kökündeki
> `.npmrc` dosyası `legacy-peer-deps=true` ayarını zaten içeriyor, bu yüzden ekstra bir flag
> vermeye gerek yok.

### 2. Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyala ve kendi değerlerini yaz:

```bash
cp .env.example .env
```

| Değişken | Ne için | Zorunlu mu |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase proje URL'i | Hayır — boşsa hesap/bulut özellikleri sessizce devre dışı kalır |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Hayır — yukarıdakiyle aynı |
| `GOOGLE_MAPS_API_KEY` | Android'de harita tile'larının yüklenmesi için | Hayır — iOS Apple Maps kullandığından key gerektirmez; Android'de key olmadan harita boş/gri görünür |

### 3. Supabase kurulumu (isteğe bağlı)

Hesap/bulut özelliklerini kullanmak istiyorsan, Supabase projende **SQL Editor**'den
`supabase/migrations/` klasöründeki dosyaları **numara sırasıyla** (0001 → 0008) çalıştır.
Her dosyanın başında ne işe yaradığı ve nereye çalıştırılacağı yazıyor.

Bunu atlarsan uygulama sorunsuz çalışmaya devam eder — sadece hesap açma, bulut yedekleme,
profil senkronu ve geri bildirim gönderme gibi özellikler "şu an kullanılamıyor" mesajı verir.

### 4. Çalıştırma

```bash
npx expo start
```

Expo Go uygulamasıyla QR kodu okutarak (iOS/Android) ya da simülatörde açabilirsin.
Proje **Expo Go üzerinde çalışacak şekilde** geliştirildi — ayrı bir development build
gerekmiyor (yalnızca Android + Expo Go kombinasyonunda günlük hatırlatma bildirimi
desteklenmiyor, bu durum uygulama içinde otomatik olarak fark edilip nazikçe devre dışı bırakılıyor).

## Geliştirme Notları

- `__DEV__` modunda (yani `expo start` ile geliştirirken) hesap açmadan da tüm uygulamaya
  erişilebilir ("dev bypass"); production build'de hesapsız kullanıcı sadece giriş/kayıt
  ekranlarını görür.
- Her kod değişikliğinden sonra `npx tsc --noEmit` ile tip kontrolü, `npx expo export --platform ios|android`
  ile bundle'ın sorunsuz derlendiği kontrol edilebilir.
- Yeni bir native paket kurarken `npx expo install <paket>` kullan; sürüm uyumu için
  ara sıra `npx expo install --check` çalıştırmakta fayda var.
