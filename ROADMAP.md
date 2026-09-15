# Yapılanlar ve Yapılacaklar

Bu dosya, projede şu ana kadar tamamlanan işlerin ve henüz yapılmamış/eksik kalan işlerin
basit bir listesidir. Teknik detay için [README.md](README.md)'ye bakabilirsin.

## ✅ Yapılanlar

### Günlük ve sorular
- [x] Günlük giriş ekleme/düzenleme/silme (tarih, metin, ruh hali, kategori, fotoğraf)
- [x] Ana Sayfa'da gün gün kaydırmalı takvim şeridi ve o günün girişleri
- [x] Ayrı bir Takvim sekmesi: aylık görünüm + kategoriye göre günlük (Letterboxd tarzı) görünüm
- [x] Her tarih için sabit/varsayılan bir soru havuzu yapıldı (366 gün, Türkçe + İngilizce)
- [x] Her gün otomatik olarak o güne ait soru gösteriliyor, cevaplar yıllar boyunca birikiyor
- [x] Geçmiş yılların cevapları kilitli/kilitsiz mantığıyla gösteriliyor (bugünü/geçmişi cevaplamadan gelecek görünmüyor)
- [x] "Geçmiş Yıllarda Bugün" — Ana Sayfa'da, bugünün tarihine denk gelen geçmiş yıl girişlerini gösteren kaydırmalı kart alanı
- [x] Girişlerde arama (metin + kategori filtresi, kısa önizleme ile sonuç listesi)
- [x] Bir girişi görsel bir kart olarak (kare veya dikey) paylaşma (WhatsApp, Instagram vb. ile)

### Kategoriler ve konum
- [x] 5 sabit kategori (Kişisel, İş, Rüya, Gezi, Soru Günlüğü)
- [x] "Gezi" kategorisindeki girişlere konum ekleme (GPS + haritadan sürükleyerek düzeltme)
- [x] Ayrı bir Harita sekmesi: konum eklenmiş tüm gezi girişlerini pin olarak gösteriyor

### Hesap ve bulut yedekleme
- [x] E-posta/şifre ile isteğe bağlı hesap oluşturma ve giriş (hesapsız da kullanılabiliyor)
- [x] Profil ekranı: isim ve profil fotoğrafı (hesapsızken cihazda, hesaplıyken bulutta saklanıyor)
- [x] Otomatik/manuel bulut yedekleme (günlük yazıları + fotoğraflar, sıklık seçilebiliyor: günlük/haftalık/aylık/manuel)
- [x] Yeni cihazda ya da uygulamayı silip yeniden kurunca "verilerini geri yükle" önerisi
- [x] Bir girişi silince buluttaki kopyasını da silmeye çalışma (internet varsa)
- [x] Uygulama içinden geri bildirim gönderme formu (öneri/hata bildirimi)

### Kişiselleştirme ve bildirimler
- [x] Açık/koyu tema ve sistemle uyumlu tema seçeneği
- [x] Türkçe/İngilizce dil desteği
- [x] Günlük hatırlatma bildirimi (saat seçilebiliyor) — Android + Expo Go'da bu özellik desteklenmediği için orada nazikçe devre dışı kalıyor, iOS'ta çalışıyor
- [x] Basit istatistikler: güncel yazma serisi, en uzun seri, toplam giriş sayısı

### Güvenlik
- [x] Uygulama geneli 4 haneli PIN kilidi (isteğe bağlı, Ayarlar'dan açılıyor)
- [x] Uygulama her arka plandan öne gelişinde PIN soruyor
- [x] PIN'i unutursa hesap şifresiyle kimlik doğrulayıp yeni PIN belirleme

### Altyapı / geliştirici tarafı
- [x] Tüm veriler önce cihazda (SQLite) tutuluyor, internet/hesap olmasa da çalışıyor
- [x] Supabase (bulut veritabanı + depolama) entegrasyonu — tamamen isteğe bağlı bir katman
- [x] Google Maps API key ve diğer gizli anahtarlar `.env` dosyasında tutuluyor, koda/repoya yazılmıyor

## 🔜 Yapılacaklar / Bilinen Eksikler

- [ ] **Kullanıcının kendi kategorisini eklemesi** — altyapıda yer var ama şu an ekleme ekranı yok, sadece 5 sabit kategori kullanılabiliyor
- [ ] **Kullanıcının kendi sorusunu eklemesi** — altyapıda yer var ama şu an ekleme ekranı yok
- [ ] **"Şifremi unuttum" akışı** (hesaba giriş yapamayınca) — şu an yok, sadece PIN kilidini unutunca şifreyle kurtarma var
- [ ] **Hata mesajlarının Türkçeleştirilmesi** — giriş/kayıt ekranlarında bazı hata mesajları hâlâ İngilizce geliyor
- [ ] **Bir girişe birden fazla fotoğraf ekleme** — veritabanı buna hazır ama ekranlar şu an tek fotoğrafla sınırlı
- [ ] **Silinen bir girişin bulut yedeğinden de tamamen silinmesini garanti etme** — şu an internet yoksa ya da silme isteği başarısız olursa, giriş buluttan geri gelebilir (nadir bir durum, bilinen bir sınır)
- [ ] **Premium/ücretli üyelik sistemi** — Harita sekranı gibi yerlerde "ileride premium olacak" diye bir işaret bırakıldı ama gerçek ödeme/üyelik sistemi kurulmadı
- [ ] **Uygulama arka plana alınınca çoklu görev ekranında (app switcher) içeriğin gizlenmesi** — PIN kilidi var ama bu ek koruma henüz yok
- [ ] **Paylaşım kartlarında gradient arka plan** — şu an düz renk kullanılıyor, istenirse daha "canlı" bir tasarıma geçilebilir
- [ ] **Gerçek cihazda uçtan uca test** — bu listedeki pek çok özellik (yedekleme/geri yükleme, PIN kilidi, harita, paylaşım, arama) kodlandı ve derleme/tip kontrolünden geçti ama siz henüz elle test etmediniz
