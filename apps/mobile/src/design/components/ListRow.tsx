import { Pressable, View } from 'react-native';
import { Text } from './Text';

/**
 * `kind` decides the affordance, so a row cannot look navigable while behaving
 * like an action, or lose its chevron the way the reference app's "Share
 * Vocabulary" row does among nine identical siblings.
 */
export type RowKind = 'navigate' | 'action' | 'toggle' | 'value';

export interface ListRowProps {
  label: string;
  kind: RowKind;
  onPress: () => void;
  icon?: string;
  value?: string;
  /** Shown under the label. Use it to state scope, never to repeat the label. */
  detail?: string;
  first?: boolean;
  last?: boolean;
}

export function ListRow({ label, kind, onPress, icon, value, detail, first, last }: ListRowProps) {
  const trailing = kind === 'navigate' ? '›' : kind === 'action' ? '↗' : (value ?? '');

  return (
    <Pressable
      accessibilityRole={kind === 'toggle' ? 'switch' : 'button'}
      accessibilityLabel={label}
      accessibilityHint={detail}
      onPress={onPress}
      className={`min-h-[60px] flex-row items-center gap-lg bg-surface-1 px-lg py-md active:bg-surface-2 ${
        first ? 'rounded-t-lg' : ''
      } ${last ? 'rounded-b-lg' : 'border-b border-line'}`}
    >
      {icon ? (
        <Text variant="headline" tone="accent">
          {icon}
        </Text>
      ) : null}
      <View className="flex-1">
        <Text variant="body">{label}</Text>
        {detail ? (
          <Text variant="caption" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      <Text variant="body" tone="muted">
        {trailing}
      </Text>
    </Pressable>
  );
}
