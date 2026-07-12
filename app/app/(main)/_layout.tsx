import { Drawer } from 'expo-router/drawer';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { SidebarContent } from '@/components/sidebar/SidebarContent';
import { canEnterMainApp } from '@/legal/gate';
import { useProfileStore } from '@/state/useProfileStore';
import { typography } from '@/theme';
import { useColors } from '@/theme/useColors';

export default function MainLayout() {
  const c = useColors();
  const hydrated = useProfileStore((s) => s.hydrated);
  const onboarded = useProfileStore((s) => s.onboarded);
  const legalAcceptance = useProfileStore((s) => s.legalAcceptance);

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (!canEnterMainApp({ onboarded, acceptance: legalAcceptance })) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Drawer
      drawerContent={(props) => <SidebarContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: c.bg, shadowColor: 'transparent', elevation: 0 },
        headerTintColor: c.text,
        headerTitleStyle: typography.screenTitle,
        drawerStyle: { backgroundColor: c.bgSidebar, width: 300 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'Aether', headerTitle: () => null }} />
      <Drawer.Screen name="chat/[id]" options={{ headerShown: false, drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="settings" options={{ headerShown: false, drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="second-brain" options={{ headerShown: false, drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="library/index" options={{ headerShown: false, drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="library/[id]" options={{ headerShown: false, drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="typography-preview" options={{ headerShown: false, drawerItemStyle: { display: 'none' } }} />
    </Drawer>
  );
}
