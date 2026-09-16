import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';
import { getCurrentCapsuleWindow } from '../lib/capsule';
import { useIsPremiumUser } from '../lib/premium';

export default function CapsuleSection() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const isPremiumUser = useIsPremiumUser();

  // Profile her odaklandığında (useFocusEffect değil, basit render) yeniden hesaplanır —
  // gün sınırını aşan çok nadir bir an dışında pratikte sorun yaratmaz, ekstra bir
  // state/interval kurmaya değmez.
  const capsuleWindow = useMemo(() => getCurrentCapsuleWindow(new Date()), []);
  const canAccess = capsuleWindow.isOpen || isPremiumUser;

  const subtitle = canAccess
    ? t.capsule.openSubtitle
    : (capsuleWindow.daysUntilOpen ?? 0) <= 0
      ? t.capsule.lockedMessageSoon
      : `${capsuleWindow.daysUntilOpen} ${t.capsule.lockedMessageSuffix}`;

  const handlePress = () => {
    if (canAccess) {
      router.push('/capsule');
      return;
    }
    Alert.alert(t.capsule.lockedInfoTitle, `${subtitle}\n\n${t.capsule.lockedInfoMessage}`);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
      onPress={handlePress}
    >
      <View style={[styles.iconWrap, { backgroundColor: canAccess ? colors.accent : colors.border }]}>
        <Ionicons
          name={canAccess ? 'gift-outline' : 'lock-closed-outline'}
          size={22}
          color={canAccess ? colors.accentText : colors.subtext}
        />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.text }]}>{t.capsule.title}</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
});
