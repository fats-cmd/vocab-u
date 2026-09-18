import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import type { TypeVariant } from '../tokens';

type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'danger' | 'inverse';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: Tone;
  /** Serif display face. Reserved for headlines and headwords. */
  display?: boolean;
  bold?: boolean;
  center?: boolean;
  className?: string;
}

/** Sizes come from the shared ramp, never from a literal. */
const SIZE: Record<TypeVariant, string> = {
  display1: 'text-display1',
  display2: 'text-display2',
  title: 'text-title',
  headline: 'text-headline',
  body: 'text-body',
  label: 'text-label',
  caption: 'text-caption',
};

const TONE: Record<Tone, string> = {
  primary: 'text-ink',
  secondary: 'text-ink-secondary',
  muted: 'text-ink-muted',
  accent: 'text-accent',
  success: 'text-success',
  danger: 'text-danger',
  inverse: 'text-accent-ink',
};

/**
 * The only way to render text.
 *
 * A card label cannot drift when its grid changes density, because the size is
 * chosen from the ramp by name rather than typed as a number at the call site.
 */
export function Text({
  variant = 'body',
  tone = 'primary',
  display = false,
  bold = false,
  center = false,
  className = '',
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      className={`${SIZE[variant]} ${TONE[tone]} ${
        display ? 'font-display font-bold' : bold ? 'font-sans font-bold' : 'font-sans'
      } ${center ? 'text-center' : ''} ${className}`}
    />
  );
}
