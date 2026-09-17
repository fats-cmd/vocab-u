import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../theme';
import { MIN_TAP } from '../tokens';

/**
 * `kind` decides the affordance, so a row cannot end up looking navigable while
 * behaving like an action, or lose its chevron the way the reference app's
 * "Share Vocabulary" row does among nine identical siblings.
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
  const t = useTheme();
  const trailing = kind === 'navigate' ? '›' : kind === 'action' ? '↗' : value ?? '';

  return (
    <Pressable
      accessibilityRole={kind === 'toggle' ? 'switch' : 'button'}
      accessibilityLabel={label}
      accessibilityHint={detail}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TAP + 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.lg,
        paddingHorizontal: t.space.lg,
        paddingVertical: t.space.md,
        backgroundColor: pressed ? t.colors.surface2 : t.colors.surface1,
        borderTopLeftRadius: first ? t.radius.lg : 0,
        borderTopRightRadius: first ? t.radius.lg : 0,
        borderBottomLeftRadius: last ? t.radius.lg : 0,
        borderBottomRightRadius: last ? t.radius.lg : 0,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.colors.border,
      })}
    >
      {icon ? (
        <Text variant="headline" tone="accent">
          {icon}
        </Text>
      ) : null}
      <View style={{ flex: 1 }}>
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
