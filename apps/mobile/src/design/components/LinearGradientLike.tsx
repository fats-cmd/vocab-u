import { View, type StyleProp, type ViewStyle } from 'react-native';

const STEPS = 12;

/**
 * A vertical scrim built from stacked translucent views.
 *
 * Deliberately not `expo-linear-gradient`: this is the only gradient the app
 * needs, and a dependency-free version keeps the Android build reproducible for
 * F-Droid, which is fussy about native modules it cannot verify.
 */
export function LinearGradientLike({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style} pointerEvents="none">
      {Array.from({ length: STEPS }, (_, i) => (
        <View
          key={i}
          className="flex-1 bg-bg"
          style={{ opacity: (i / (STEPS - 1)) * 0.9 }}
        />
      ))}
    </View>
  );
}
