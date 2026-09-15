import { View, type ColorValue, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { useT } from '../../lib/i18n';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  focused,
  name,
  activeName,
  color,
  accent,
}: {
  focused: boolean;
  name: IconName;
  activeName: IconName;
  color: ColorValue;
  accent: string;
}) {
  const pillStyle: ViewStyle = {
    width: 46,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: focused ? `${accent}26` : 'transparent',
  };
  return (
    <View style={pillStyle}>
      <Ionicons name={focused ? activeName : name} size={22} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -3 },
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.home,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} name="home-outline" activeName="home" color={color} accent={colors.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="question"
        options={{
          title: t.tabs.question,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} name="bulb-outline" activeName="bulb" color={color} accent={colors.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t.tabs.calendar,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              name="calendar-outline"
              activeName="calendar"
              color={color}
              accent={colors.accent}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t.tabs.map,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} name="map-outline" activeName="map" color={color} accent={colors.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              name="person-circle-outline"
              activeName="person-circle"
              color={color}
              accent={colors.accent}
            />
          ),
        }}
      />
    </Tabs>
  );
}
