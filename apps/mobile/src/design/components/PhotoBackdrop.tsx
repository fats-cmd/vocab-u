import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { LinearGradientLike } from './LinearGradientLike';
import { useTheme } from '../theme';

export interface PhotoBackdropProps {
  source: ImageSourcePropType;
  children: ReactNode;
  /**
   * Dim the photograph without dimming the content on top of it. Used when a
   * detail sheet opens: the reference app dims the headword along with the
   * background, so the word you are reading about becomes the least legible
   * thing on screen.
   */
  dimmed?: boolean;
}

/**
 * A photograph with text on it. There is deliberately no way to use this
 * component without a scrim — white type on bare photography is legible on the
 * one image the designer tested and illegible on the next.
 */
export function PhotoBackdrop({ source, children, dimmed = false }: PhotoBackdropProps) {
  const t = useTheme();
  return (
    <ImageBackground source={source} style={styles.fill} resizeMode="cover">
      <LinearGradientLike
        from={t.colors.scrimTop}
        to={t.colors.scrimBottom}
        style={StyleSheet.absoluteFill}
      />
      {dimmed ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.scrimBottom }]} />
      ) : null}
      {/* Content sits above both the scrim and the dim layer, by construction. */}
      <View style={styles.fill}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
