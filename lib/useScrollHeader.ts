import { useRef } from 'react';
import { Animated } from 'react-native';

// components/Screen.tsx'teki büyük başlığın kaydırmayla küçülüp ince bir bara
// dönüşmesi için: ekranın kendi FlatList/ScrollView/SectionList'ine onScroll olarak
// verilir, scrollY de Screen'e geçirilir. Native driver kullanılabiliyor çünkü
// Screen sadece opacity/transform interpolasyonu yapıyor (height gibi layout
// özelliklerine dokunmuyor — başlık alanı sabit yükseklikte, içerik crossfade ediyor).
//
// NOT: Bu küçülme davranışı şu an Screen.tsx'teki SCROLL_COLLAPSE_ENABLED sabitiyle
// kapatıldı (başlık artık her zaman sabit boyutta) — bu hook hâlâ tam işlevsel,
// ekranlar onScroll'u bağlamaya devam ediyor, davranış istenirse tek bir yerden
// (o sabiti true yaparak) geri açılabilir.
export function useScrollHeader() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );
  return { scrollY, onScroll };
}
