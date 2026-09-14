import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="entry/new"
        options={{ headerShown: true, title: 'Yeni Giriş', presentation: 'modal' }}
      />
      <Stack.Screen name="entry/[id]" options={{ headerShown: true, title: 'Giriş' }} />
    </Stack>
  );
}
