// app.json yerine app.config.js kullanıyoruz çünkü Google Maps API key gibi
// build-time değerleri process.env üzerinden okumamız gerekiyor — düz JSON (app.json)
// JS ifadesi çalıştıramaz. Expo CLI .env dosyasını otomatik yüklediği için
// GOOGLE_MAPS_API_KEY burada process.env'den geliyor; repo public olduğundan
// gerçek key sadece .env'de tutuluyor (.gitignore'da), asla commit edilmiyor.
module.exports = {
  expo: {
    name: 'yearly-question-app',
    slug: 'yearly-question-app',
    version: '1.0.0',
    scheme: 'yearlyquestionapp',
    orientation: 'portrait',
    icon: './assets/icon-light.png',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      icon: {
        light: './assets/icon-light.png',
        dark: './assets/icon-dark.png',
      },
    },
    android: {
      // iconikai-icon-pack tek, düz (katmansız) bir görsel olarak geldi — ayrı bir
      // arka plan/monochrome katmanı yok, bu yüzden foreground'un kendisi zaten opak
      // ve tüm kareyi kaplıyor; backgroundColor sadece foreground'un altında kalan
      // (görünmeyen) bir yedek. monochromeImage (Android 13+ themed icon) için
      // kaynak pakette ayrıştırılmış bir siluet olmadığından bilerek eklenmedi.
      adaptiveIcon: {
        backgroundColor: '#384C76',
        foregroundImage: './assets/adaptive-icon-foreground.png',
      },
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      'expo-font',
      '@react-native-community/datetimepicker',
      [
        'expo-image-picker',
        {
          photosPermission: 'Girişlerine fotoğraf ekleyebilmek için galeriye erişim izni ver.',
          cameraPermission: 'Girişlerine fotoğraf çekebilmek için kameraya erişim izni ver.',
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon-light.png',
          imageWidth: 140,
          backgroundColor: '#FFFFFF',
          dark: {
            image: './assets/splash-icon-dark.png',
            backgroundColor: '#00487C',
          },
        },
      ],
      'expo-notifications',
      'expo-secure-store',
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Gezi girişlerine konum eklemek için konumuna erişim izni ver.',
        },
      ],
      'expo-sharing',
    ],
  },
};
