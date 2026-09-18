import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../theme';

export type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * Styling is NativeWind classes; the colour values behind them come from
 * src/design/theme.json, the same file `useTheme()` reads. `minHeight: tap`
 * keeps every button at the minimum comfortable target size.
 */
const SURFACE: Record<ButtonKind, string> = {
  primary: 'bg-accent',
  secondary: 'bg-surface-2',
  ghost: 'border border-line',
  danger: 'bg-danger',
};

const TONE: Record<ButtonKind, 'inverse' | 'primary'> = {
  primary: 'inverse',
  secondary: 'primary',
  ghost: 'primary',
  danger: 'inverse',
};

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled = false,
  loading = false,
  className = '',
}: ButtonProps) {
  const t = useTheme();
  const busy = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy }}
      onPress={onPress}
      disabled={busy}
      className={`min-h-tap items-center justify-center rounded-pill px-xl py-md active:opacity-80 ${
        SURFACE[kind]
      } ${disabled ? 'opacity-40' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={kind === 'primary' ? t.colors.accentInk : t.colors.textPrimary} />
      ) : (
        <Text variant="headline" bold tone={TONE[kind]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Kept so callers that passed a style object still typecheck during the migration. */
export const ButtonRow = View;
