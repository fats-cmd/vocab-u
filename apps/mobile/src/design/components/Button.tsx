import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../theme';
import { MIN_TAP } from '../tokens';

export type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const t = useTheme();
  const surface: Record<ButtonKind, string> = {
    primary: t.colors.accent,
    secondary: t.colors.surface2,
    ghost: 'transparent',
    danger: t.colors.danger,
  };
  const tone = kind === 'primary' ? 'inverse' : kind === 'danger' ? 'inverse' : 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: surface[kind],
          borderRadius: t.radius.pill,
          borderWidth: kind === 'ghost' ? 1 : 0,
          borderColor: t.colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={kind === 'primary' ? t.colors.accentInk : t.colors.textPrimary} />
      ) : (
        <Text variant="headline" bold tone={tone}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TAP + 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
