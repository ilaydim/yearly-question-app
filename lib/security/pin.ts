import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const PIN_HASH_KEY = 'app-pin-hash';

// SHA-256(PIN) tek başına 4 haneli bir PIN için "güçlü" bir hash değil (sadece 10.000
// olasılık) — ama burada asıl güvenlik SecureStore'un kendisinden geliyor (iOS Keychain /
// Android Keystore, cihaz kilidiyle korunan şifreli depolama). Hash'lemenin amacı düz PIN'i
// hiçbir yerde (bellek dökümü, log vs.) açık tutmamak; brute-force koruması cihaz seviyesinde.
async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export async function isPinSet(): Promise<boolean> {
  const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  return hash !== null;
}

export async function setPin(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!stored) return false;
  const candidate = await hashPin(pin);
  return candidate === stored;
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
}
