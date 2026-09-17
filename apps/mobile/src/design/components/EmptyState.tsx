import type { ReactNode } from 'react';
import { View } from 'react-native';
import { CenteredScreen } from './CenteredScreen';
import { Text } from './Text';
import { Button } from './Button';
import { useTheme } from '../theme';

export interface EmptyStateProps {
  title: string;
  body?: string;
  art?: ReactNode;
  /**
   * Required, not optional.
   *
   * An empty state exists to convert into first use. The reference app's "Your
   * own words" screen puts its only action in a 60px text link in the corner,
   * which is the whole screen failing at its one job. Making this prop required
   * means that layout cannot be built here.
   */
  action: { label: string; onPress: () => void };
}

export function EmptyState({ title, body, art, action }: EmptyStateProps) {
  const t = useTheme();
  return (
    <CenteredScreen
      art={art}
      action={<Button label={action.label} onPress={action.onPress} />}
    >
      <View style={{ gap: t.space.md }}>
        <Text variant="title" display center>
          {title}
        </Text>
        {body ? (
          <Text variant="body" tone="secondary" center>
            {body}
          </Text>
        ) : null}
      </View>
    </CenteredScreen>
  );
}
