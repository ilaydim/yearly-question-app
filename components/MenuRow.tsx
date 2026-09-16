import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Palette } from '../lib/theme';

interface MenuRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: Palette;
  tint?: string;
  showChevron?: boolean;
  showDivider?: boolean;
  trailingText?: string;
}

// Profile ve Ayarlar ekranlarında ortak "gruplanmış liste" satırı — her ikisi de
// artık ayrı ayrı kutucuklar yerine tek bir kart içinde bölücü çizgili satırlar kullanıyor.
export default function MenuRow({
  icon,
  label,
  onPress,
  colors,
  tint,
  showChevron = true,
  showDivider = false,
  trailingText,
}: MenuRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        showDivider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.6 },
      ]}
      onPress={onPress}
    >
      <View style={styles.left}>
        <Ionicons name={icon} size={20} color={tint ?? colors.text} />
        <Text style={[styles.label, { color: tint ?? colors.text }]}>{label}</Text>
      </View>
      <View style={styles.right}>
        {trailingText && <Text style={[styles.trailingText, { color: colors.subtext }]}>{trailingText}</Text>}
        {showChevron && <Ionicons name="chevron-forward" size={18} color={colors.subtext} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  trailingText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
