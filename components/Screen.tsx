import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import type { Palette } from '../lib/theme';

interface ScreenProps {
  children?: ReactNode;
  colors: Palette;
  title?: string;
  headerRight?: ReactNode;
  edges?: Edge[];
}

export default function Screen({ children, colors, title, headerRight, edges = ['top'] }: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.container, { backgroundColor: colors.bg }]}>
      {(title || headerRight) && (
        <View style={styles.header}>
          {title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
          {headerRight}
        </View>
      )}
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
});
