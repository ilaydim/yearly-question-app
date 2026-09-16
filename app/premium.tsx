import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useTheme } from '../lib/theme';
import { useT } from '../lib/i18n';

// TODO: IAP kurulunca true yap ve handleSubscribe'ı gerçek satın alma akışına bağla
// (bkz. app/(tabs)/map.tsx'teki MAP_VIEW_REQUIRES_PREMIUM ile aynı desen).
const PREMIUM_PURCHASE_ENABLED = false;

export default function PremiumScreen() {
  const { colors } = useTheme();
  const t = useT();

  const benefits = [
    { icon: 'images-outline' as const, text: t.premium.benefitMultiPhoto },
    { icon: 'pricetags-outline' as const, text: t.premium.benefitCategories },
    { icon: 'map-outline' as const, text: t.premium.benefitMap },
    { icon: 'cloud-upload-outline' as const, text: t.premium.benefitBackup },
  ];

  const handleSubscribe = () => {
    if (!PREMIUM_PURCHASE_ENABLED) {
      Alert.alert(t.premium.comingSoonTitle, t.premium.comingSoonMessage);
      return;
    }
  };

  return (
    <Screen colors={colors} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Ionicons name="star" size={32} color={colors.accentText} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t.premium.title}</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>{t.premium.subtitle}</Text>

        <View style={[styles.benefitsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {benefits.map((benefit, i) => (
            <View
              key={benefit.text}
              style={[
                styles.benefitRow,
                i < benefits.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Ionicons name={benefit.icon} size={20} color={colors.accent} />
              <Text style={[styles.benefitText, { color: colors.text }]}>{benefit.text}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.subscribeButton,
            { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleSubscribe}
        >
          <Text style={[styles.subscribeText, { color: colors.accentText }]}>
            {t.premium.subscribeButton}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
  },
  benefitsCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 24,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  benefitText: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  subscribeButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  subscribeText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
