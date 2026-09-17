import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export interface CenteredScreenProps {
  /** Illustration or icon. Optional. */
  art?: ReactNode;
  children: ReactNode;
  /** The single primary action. One per screen — never two "Start" buttons. */
  action: ReactNode;
  secondaryAction?: ReactNode;
}

/**
 * The layout for every full-screen moment: mode intro, run summary, empty state,
 * level test intro.
 *
 * Art, copy and action are distributed across the height rather than clustered
 * at the top with the button pinned to the bottom. Roughly a third of every such
 * screen in the reference app is dead space.
 */
export function CenteredScreen({ art, children, action, secondaryAction }: CenteredScreenProps) {
  const t = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.colors.bg }]} edges={['top', 'bottom']}>
      <View style={styles.art}>{art}</View>
      <View style={[styles.body, { paddingHorizontal: t.space.gutter }]}>{children}</View>
      <View style={[styles.actions, { paddingHorizontal: t.space.gutter, gap: t.space.md }]}>
        {action}
        {secondaryAction}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  art: { flex: 3, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 2, alignItems: 'center', justifyContent: 'flex-start' },
  actions: { flex: 1, justifyContent: 'center' },
});
