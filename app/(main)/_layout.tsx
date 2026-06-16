import { Drawer } from 'expo-router/drawer';
import { SidebarContent } from '@/components/sidebar/SidebarContent';
import { colors } from '@/theme';

export default function MainLayout() {
  return (
    <Drawer
      drawerContent={(props) => <SidebarContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitle: 'Aether',
        drawerStyle: { backgroundColor: colors.bgCard, width: 300 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'Aether' }} />
      <Drawer.Screen name="chat/[id]" options={{ title: 'Chat', drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings', drawerItemStyle: { display: 'none' } }} />
    </Drawer>
  );
}
