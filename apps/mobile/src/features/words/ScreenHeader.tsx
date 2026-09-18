import { Pressable, View } from 'react-native';
import { Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { MIN_TAP } from '@/design/tokens';

/** Back arrow, title, optional trailing action. One primary action per screen. */
export function ScreenHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        paddingHorizontal: t.space.gutter,
        paddingVertical: t.space.sm,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        hitSlop={12}
        style={{ minWidth: MIN_TAP, minHeight: MIN_TAP, justifyContent: 'center' }}
      >
        <Text variant="headline">←</Text>
      </Pressable>

      <Text variant="headline" display style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>

      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={12}
          style={{ minHeight: MIN_TAP, justifyContent: 'center' }}
        >
          <Text variant="body" tone="accent" bold>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
