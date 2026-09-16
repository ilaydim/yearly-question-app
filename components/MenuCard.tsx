import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Palette } from '../lib/theme';

interface MenuCardProps {
  colors: Palette;
  children: ReactNode;
}

export default function MenuCard({ colors, children }: MenuCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
