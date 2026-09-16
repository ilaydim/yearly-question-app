import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ShareCard, { SHARE_CARD_WIDTH, shareCardHeight } from './ShareCard';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useSettingsStore } from '../lib/store/settingsStore';
import type { Category, Entry } from '../lib/db/types';

// Fotoğraflı girişlerde bile fotoğrafın baskın rengini analiz etmiyoruz — kasıtlı
// olarak basit tutuluyor, her zaman kategori rengi (yoksa ShareCard'ın kendi
// varsayılanıyla aynı) kullanılıyor.
const GLOW_FALLBACK_COLOR = '#4F46E5';
const GLOW_PADDING = 46;
const CARD_HEIGHT = shareCardHeight('portrait');

interface EntryPreviewModalProps {
  entry: Entry | null;
  category: Category | undefined;
  photoUri: string | undefined;
  onClose: () => void;
  onEdit: () => void;
}

// Salt-okunur önizleme: ShareCard'ın görsel dilini (fotoğraf/kategori rengi arka
// plan, içerik, tarih, kategori rozeti) aynen kullanıyor ama paylaşım formatı
// toggle'ı ve "Paylaş" butonu YOK — burası sadece "bu anı neydi?" diye bakıp,
// istenirse düzenlemeye geçmek için.
export default function EntryPreviewModal({
  entry,
  category,
  photoUri,
  onClose,
  onEdit,
}: EntryPreviewModalProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useSettingsStore((s) => s.language);

  if (!entry) return null;

  const dateLabel = new Date(entry.date).toLocaleDateString(
    language === 'tr' ? 'tr-TR' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
  const glowColor = category?.color ?? GLOW_FALLBACK_COLOR;

  return (
    <Modal visible={!!entry} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <Pressable
            hitSlop={10}
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel={t.entryPreview.close}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>

          <View style={styles.cardWrap}>
            <View style={styles.glow} pointerEvents="none">
              <LinearGradient
                colors={[`${glowColor}00`, `${glowColor}4D`, `${glowColor}00`]}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <ShareCard
              entry={entry}
              category={category}
              photoUri={photoUri ?? null}
              format="portrait"
              dateLabel={dateLabel}
              watermarkText={t.welcome.title}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.editButton,
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={onEdit}
          >
            <Ionicons name="pencil" size={18} color={colors.accentText} />
            <Text style={[styles.editButtonText, { color: colors.accentText }]}>
              {t.entryPreview.editButton}
            </Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  cardWrap: {
    width: SHARE_CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  glow: {
    position: 'absolute',
    top: -GLOW_PADDING,
    left: -GLOW_PADDING,
    right: -GLOW_PADDING,
    bottom: -GLOW_PADDING,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
