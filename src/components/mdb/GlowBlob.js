/**
 * GlowBlob — the pack's `bg-[#783DEC]/10 rounded-full blur-2xl` ambient blobs
 * that sit behind card corners.
 *
 * CSS gets this from a blurred solid circle; RN has no box-blur, so it is drawn
 * as an SVG radial gradient fading opaque-centre → transparent-edge, which is
 * what the blur actually produces.
 */
import React from 'react';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

export default function GlowBlob({ size = 112, color = '#783DEC', opacity = 0.10, style }) {
  const id = `glow-${color.replace('#', '')}-${Math.round(opacity * 100)}`;
  return (
    <Svg width={size} height={size} style={style} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="55%" stopColor={color} stopOpacity={opacity * 0.55} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}
