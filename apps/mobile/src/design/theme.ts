import { useColorScheme } from 'react-native';
import { type Colors, type ColorScheme, fonts, palette, radius, space, type } from './tokens';

export interface Theme {
  scheme: ColorScheme;
  colors: Colors;
  type: typeof type;
  space: typeof space;
  radius: typeof radius;
  fonts: typeof fonts;
}

export function themeFor(scheme: ColorScheme): Theme {
  return { scheme, colors: palette[scheme], type, space, radius, fonts };
}

/**
 * Follows the OS. The app also exposes an explicit override in Settings, because
 * "Dark mode" as a three-way choice (System / Light / Dark) is what people
 * actually expect — the reference app's dark mode is a recoloured chrome with
 * light-mode artwork still inside it, which is the thing this codebase avoids by
 * having no raster art in chrome at all.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return themeFor(scheme === 'light' ? 'light' : 'dark');
}
