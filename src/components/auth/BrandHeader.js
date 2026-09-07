import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { TYPE } from '../../theme';

const MAISON_LOGO = require('../../../assets/maison-logo.png'); // 1238x1516, transparent (mark + wordmark)
const LOGO_SOLID = MAISON_LOGO;
const LOGO_OUTLINE = MAISON_LOGO;
const OUTLINE_RATIO = 1238 / 1516; // portrait

/**
 * Maison de Build logo + optional title / subtitle.
 *
 * Props:
 *   variant  ('solid' | 'outline')  logo treatment.
 *   logoSize (number)  for 'solid' = square side; for 'outline' = width.
 *   title, subtitle (string)  optional copy below the logo.
 *   style    (style)   wrapper override.
 */
export default function BrandHeader({
  variant = 'solid', logoSize = 88, title, subtitle, style,
}) {
  const isOutline = variant === 'outline';
  const dims = isOutline
    ? { width: logoSize, height: logoSize / OUTLINE_RATIO }
    : { width: logoSize, height: logoSize };

  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={isOutline ? LOGO_OUTLINE : LOGO_SOLID}
        style={{ ...dims, marginBottom: title ? 12 : 0 }}
        resizeMode="contain"
      />
      {!!title && <Text style={[TYPE.headlineMd, styles.title]}>{title}</Text>}
      {!!subtitle && <Text style={[TYPE.bodySm, styles.subtitle]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  title: { textAlign: 'center', marginBottom: 6 },
  subtitle: { textAlign: 'center', maxWidth: 300 },
});
