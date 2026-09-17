import { View, type ViewStyle, type StyleProp } from 'react-native';

const STEPS = 12;

/**
 * A vertical gradient built from stacked translucent views.
 *
 * Deliberately not `expo-linear-gradient`: this is the only gradient the app
 * needs, and a dependency-free version keeps the Android build reproducible for
 * F-Droid, which is fussy about native modules it cannot verify.
 */
export function LinearGradientLike({
  from,
  to,
  style,
}: {
  from: string;
  to: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style} pointerEvents="none">
      {Array.from({ length: STEPS }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: i < STEPS / 2 ? from : to,
            opacity: i / (STEPS - 1),
          }}
        />
      ))}
    </View>
  );
}
