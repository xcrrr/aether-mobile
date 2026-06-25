import { Drawer } from 'expo-router/drawer';
import { SidebarContent } from '@/components/sidebar/SidebarContent';
import { fonts } from '@/theme';
import { useColors } from '@/theme/useColors';

export default function MainLayout() {
  const c = useColors();
  return (
    <Drawer
      drawerContent={(props) => <SidebarContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: c.bg, shadowColor: 'transparent', elevation: 0 },
        headerTintColor: c.text,
        headerTitleStyle: { fontFamily: fonts.sansHeavy, fontSize: 19, letterSpacing: -0.3 },
        drawerStyle: { backgroundColor: c.bgSidebar, width: 300 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'Aether', headerTitle: () => null }} />
      <Drawer.Screen name="chat/[id]" options={{ headerShown: false, drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="settings" options={{ headerShown: false, drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="second-brain" options={{ headerShown: false, drawerItemStyle: { display: 'none' } }} />
    </Drawer>
  );
}
