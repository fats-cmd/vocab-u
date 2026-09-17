import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import type { type as TypeRamp } from '../tokens';

type Variant = keyof typeof TypeRamp;
type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'danger' | 'inverse';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  /** Serif display face. Reserved for headlines and headwords. */
  display?: boolean;
  bold?: boolean;
  center?: boolean;
}

/**
 * The only way to render text. Sizes come from the ramp, never from a literal,
 * so a card label cannot drift when its grid changes density.
 */
export function Text({
  variant = 'body',
  tone = 'primary',
  display = false,
  bold = false,
  center = false,
  style,
  ...rest
}: TextProps) {
  const t = useTheme();
  const colors: Record<Tone, string> = {
    primary: t.colors.textPrimary,
    secondary: t.colors.textSecondary,
    muted: t.colors.textMuted,
    accent: t.colors.accent,
    success: t.colors.success,
    danger: t.colors.danger,
    inverse: t.colors.accentInk,
  };
  const face: TextStyle = display
    ? t.fonts.display
    : bold
      ? t.fonts.textBold
      : t.fonts.text;

  return (
    <RNText
      {...rest}
      style={[t.type[variant], face, { color: colors[tone] }, center && { textAlign: 'center' }, style]}
    />
  );
}
