import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '@/design/theme';
import { useLearner } from '@/features/progress/learnerStore';

export default function RootLayout() {
  const t = useTheme();
  const loadLearner = useLearner((s) => s.load);

  useEffect(() => {
    void loadLearner();
  }, [loadLearner]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: t.colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="play/[mode]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="play/results" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="level-test/index" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="topic/[id]" />
          <Stack.Screen name="word/[id]" />
          <Stack.Screen name="list/[kind]" />
          <Stack.Screen name="own-words/index" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
