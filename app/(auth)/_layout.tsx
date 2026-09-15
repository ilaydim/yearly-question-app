import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../lib/store/authStore';

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);

  if (session) return <Redirect href="/settings" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
