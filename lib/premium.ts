// TODO: IAP kurulunca gerçek entitlement kontrolüyle değiştir (RevenueCat / expo-in-app-purchases
// vb.) — o zamana kadar tüm premium-gated ekranlar (Harita, Yıl Sonu Kapsülü) bu tek stub'ı
// kullanıyor, gerçek kontrol bağlanınca tek noktadan güncellenmesi yeterli olur.
export function useIsPremiumUser(): boolean {
  return false;
}
