import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
 * at the top with the button pinned to the bottom — roughly a third of every such
 * screen in the reference app is dead space.
 */
export function CenteredScreen({ art, children, action, secondaryAction }: CenteredScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="flex-[3] items-center justify-center">{art}</View>
      <View className="flex-[2] items-start justify-start px-gutter">{children}</View>
      <View className="flex-1 justify-center gap-md px-gutter">
        {action}
        {secondaryAction}
      </View>
    </SafeAreaView>
  );
}
