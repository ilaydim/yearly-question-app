import { create } from 'zustand';
import { isPinSet } from '../security/pin';

interface PinLockState {
  // Gerçek kaynak SecureStore'daki hash'in varlığı; bu store sadece o gerçeği
  // React render ağacına yansıtan reaktif bir ayna (authStore'daki session deseniyle aynı).
  pinEnabled: boolean;
  checked: boolean;
  // Kilit ekranının şu an gösterilip gösterilmeyeceği. Cold start'ta pinEnabled henüz
  // bilinmediği için kötümser varsayım true — flaş riski sıfıra iner (bkz. app/_layout.tsx).
  locked: boolean;
  setPinEnabled: (value: boolean) => void;
  setLocked: (value: boolean) => void;
}

export const usePinLockStore = create<PinLockState>((set) => ({
  pinEnabled: false,
  checked: false,
  locked: true,
  setPinEnabled: (pinEnabled) => set({ pinEnabled }),
  setLocked: (locked) => set({ locked }),
}));

isPinSet()
  .then((pinEnabled) => usePinLockStore.setState({ pinEnabled, locked: pinEnabled, checked: true }))
  .catch((error) => {
    console.error('PIN durumu okunamadı:', error);
    usePinLockStore.setState({ pinEnabled: false, locked: false, checked: true });
  });
