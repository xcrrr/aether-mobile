import { Drawer } from 'expo-router/drawer';
import { SidebarContent } from '@/components/sidebar/SidebarContent';
import { colors, fonts } from '@/theme';

export default function MainLayout() {
  return (
    <Drawer
      drawerContent={(props) => <SidebarContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg, shadowColor: 'transparent', elevation: 0 },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.sansHeavy, fontSize: 19, letterSpacing: -0.3 },
        drawerStyle: { backgroundColor: colors.bgSidebar, width: 300 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'Aether', headerTitle: () => null }} />
      <Drawer.Screen name="chat/[id]" options={{ headerShown: false, drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="settings" options={{ headerShown: false, drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="second-brain" options={{ headerShown: false, drawerItemStyle: { display: 'none' } }} />
    </Drawer>
  );
}
