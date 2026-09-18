import { Pressable, View } from 'react-native';
import { Text } from '@/design/components';

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
  return (
    <View className="flex-row items-center gap-md px-gutter py-sm">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        hitSlop={12}
        className="min-h-tap min-w-tap justify-center"
      >
        <Text variant="headline">←</Text>
      </Pressable>

      <Text variant="headline" display className="flex-1" numberOfLines={1}>
        {title}
      </Text>

      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={12}
          className="min-h-tap justify-center"
        >
          <Text variant="body" tone="accent" bold>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
