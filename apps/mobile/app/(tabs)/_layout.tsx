import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Text } from '@/design/components';
import { useTheme } from '@/design/theme';

/**
 * Four destinations, every one labelled.
 *
 * The reference app runs three targets and labels only the middle one, then
 * buries Favorites, Collections, History and Your own words inside the topic
 * catalogue. Saved material gets a home here instead.
 */
export default function TabsLayout() {
  const t = useTheme();
  const icon = (glyph: string) =>
    function TabIcon({ color }: { color: ColorValue }) {
      return (
        <Text variant="headline" style={{ color }}>
          {glyph}
        </Text>
      );
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.accent,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarStyle: {
          backgroundColor: t.colors.surface1,
          borderTopColor: t.colors.border,
        },
        tabBarLabelStyle: { fontSize: t.type.caption.fontSize },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: icon('⊞') }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice', tabBarIcon: icon('◎') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('◫') }} />
    </Tabs>
  );
}
