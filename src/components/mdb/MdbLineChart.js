/**
 * MdbLineChart — the pack's trend curve (screens 16 and 09).
 *
 * A smooth violet→cyan stroke over a hairline baseline and a dashed mid-line,
 * terminating in a glowing cyan endpoint dot. The HTML hard-codes a hand-drawn
 * bezier; this fits a Catmull-Rom spline through the real points and converts it
 * to cubic segments, which is the same visual language driven by actual data.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Path, Line, Circle } from 'react-native-svg';

import { MC, MF } from '../../theme/mdbKit';

const VB_W = 320; // view box units — the SVG scales to the container width
const PAD_X = 10;
const PAD_TOP = 8;

export default function MdbLineChart({
  points = [],          // [{ x?: any, y: number }] or [number]
  height = 120,
  gradientId = 'mdbLine',
  emptyLabel = 'Not enough data yet',
  // Fixed scale for charts that share an axis (the 1–5 wellness lines must all
  // be plotted against the same range, or five auto-scaled lines would each fill
  // the box and the comparison would be meaningless).
  min: minProp,
  max: maxProp,
  color,                // solid stroke instead of the violet→cyan gradient
  showGrid = true,
  showDot = true,
}) {
  const ys = points.map((p) => (typeof p === 'number' ? p : p.y)).filter((n) => Number.isFinite(n));

  if (ys.length < 2) {
    return (
      <View style={[s.empty, { height }]}>
        <Text style={s.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  const vbH = 80;
  const min = minProp != null ? minProp : Math.min(...ys);
  const max = maxProp != null ? maxProp : Math.max(...ys);
  const span = max - min || 1;
  const plotH = vbH - PAD_TOP - 10;

  const coords = ys.map((y, i) => ({
    x: PAD_X + (i / (ys.length - 1)) * (VB_W - PAD_X * 2),
    y: PAD_TOP + (1 - (y - min) / span) * plotH,
  }));

  const last = coords[coords.length - 1];

  return (
    <View style={{ height }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${vbH}`} preserveAspectRatio="none">
        <Defs>
          <SvgGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={MC.violet} />
            <Stop offset="100%" stopColor={MC.cyan} />
          </SvgGradient>
        </Defs>

        {showGrid && (
          <>
            <Line x1="0" y1={vbH - 10} x2={VB_W} y2={vbH - 10} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <Line
              x1="0" y1={vbH / 2} x2={VB_W} y2={vbH / 2}
              stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 3"
            />
          </>
        )}

        <Path
          d={smoothPath(coords)}
          fill="none"
          stroke={color || `url(#${gradientId})`}
          strokeWidth={color ? '2' : '2.5'}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {showDot && (
          <>
            <Circle cx={last.x} cy={last.y} r="6" fill={color || MC.cyan} fillOpacity={0.18} />
            <Circle cx={last.x} cy={last.y} r="4" fill={color || MC.cyan} />
          </>
        )}
      </Svg>
    </View>
  );
}

/**
 * Catmull-Rom → cubic bezier. Gives the pack's soft curve without overshooting
 * past the real data points the way a naive quadratic smoothing does.
 */
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const s = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary },
});
