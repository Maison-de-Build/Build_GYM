/**
 * MdbIcon — the handoff pack's icons, ported path-for-path from the source SVGs.
 *
 * The pack draws every glyph inline rather than pulling an icon font, and the
 * stroke widths / view boxes are part of the look (e.g. the back chevron is
 * stroke-2.2, the date-strip tick is a filled 16-box Bootstrap check). Rendering
 * these through @expo/vector-icons would approximate them; react-native-svg
 * reproduces them exactly.
 *
 * Usage: <MdbIcon name="chevron-left" size={20} color={MC.text} />
 */
import React from 'react';
import Svg, { Path, Polyline, Circle, Rect, G } from 'react-native-svg';

// Stroked icons — 24×24 view box unless noted.
const STROKE = {
  'chevron-left': { w: 2.2, el: <Polyline points="15 18 9 12 15 6" /> },
  'chevron-right': { w: 2.2, el: <Polyline points="9 18 15 12 9 6" /> },
  'chevron-down': { w: 2, el: <Polyline points="6 9 12 15 18 9" /> },
  'chevron-up': { w: 2, el: <Polyline points="18 15 12 9 6 15" /> },
  'list': { w: 2, el: <Path d="M4 6h16M4 12h16M4 18h7" /> },
  'clock': { w: 2, el: <G><Circle cx="12" cy="12" r="9" /><Polyline points="12 7 12 12 15 15" /></G> },
  'bolt': { w: 2, el: <Path d="M13 10V3L4 14h7v7l9-11h-7z" /> },
  'target': { w: 2, el: <G><Circle cx="12" cy="12" r="3" /><Path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></G> },
  'plus': { w: 2.2, el: <Path d="M12 5v14M5 12h14" /> },
  'x': { w: 2, el: <Path d="M18 6L6 18M6 6l12 12" /> },
  'arrow-right': { w: 2, el: <G><Path d="M5 12h14" /><Polyline points="12 5 19 12 12 19" /></G> },
  'arrow-up': { w: 2, el: <G><Path d="M12 19V5" /><Polyline points="5 12 12 5 19 12" /></G> },
  'arrow-down': { w: 2, el: <G><Path d="M12 5v14" /><Polyline points="19 12 12 19 5 12" /></G> },
  'search': { w: 2, el: <G><Circle cx="11" cy="11" r="7" /><Path d="M20 20l-3.5-3.5" /></G> },
  'sliders': { w: 2, el: <G><Path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><Circle cx="16" cy="6" r="2" /><Circle cx="10" cy="12" r="2" /><Circle cx="18" cy="18" r="2" /></G> },
  'calendar': { w: 2, el: <G><Rect x="3" y="5" width="18" height="16" rx="2" /><Path d="M3 10h18M8 3v4M16 3v4" /></G> },
  'camera': { w: 2, el: <G><Path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /><Circle cx="12" cy="12.5" r="3.5" /></G> },
  'trending-up': { w: 2, el: <G><Polyline points="3 17 9 11 13 15 21 7" /><Polyline points="15 7 21 7 21 13" /></G> },
  'share': { w: 2, el: <G><Path d="M12 15V3" /><Polyline points="8 7 12 3 16 7" /><Path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" /></G> },
  'heart': { w: 2, el: <Path d="M20.8 6.6a5 5 0 00-7.1 0L12 8.3l-1.7-1.7a5 5 0 10-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 000-7.1z" /> },
  'moon': { w: 2, el: <Path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /> },
  'activity': { w: 2, el: <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /> },
  'flame': { w: 2, el: <Path d="M12 2s4 4.5 4 8a4 4 0 01-8 0c0-1.2.5-2.3 1-3-2 1.5-4 4-4 7a7 7 0 0014 0c0-5-7-12-7-12z" /> },
  'watch': { w: 2, el: <G><Circle cx="12" cy="12" r="6" /><Path d="M9 3h6l.5 3M9 21h6l.5-3" /></G> },
  'settings': { w: 2, el: <G><Circle cx="12" cy="12" r="3" /><Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></G> },
  'trash': { w: 2, el: <G><Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></G> },
  'edit': { w: 2, el: <G><Path d="M11 4H4v16h16v-7" /><Path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" /></G> },
  'info': { w: 2, el: <G><Circle cx="12" cy="12" r="9" /><Path d="M12 16v-4M12 8h.01" /></G> },
  'lock': { w: 2, el: <G><Rect x="4" y="10" width="16" height="11" rx="2" /><Path d="M8 10V7a4 4 0 018 0v3" /></G> },
  'refresh': { w: 2, el: <G><Polyline points="21 3 21 9 15 9" /><Path d="M20 13a8 8 0 11-2.3-5.7L21 9" /></G> },
  'zap-off': { w: 2, el: <Path d="M13 10V3L8 9m-3 5h6v7l3-3.6" /> },
};

// Filled icons — each with its own view box.
const FILL = {
  // Bootstrap check, 16-box. Date-strip completion ticks + exercise-row ticks.
  'check': { box: 16, d: 'M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z' },
  // Heroicons solid check, 20-box. CTA "COMPLETED" state.
  'check-bold': { box: 20, d: 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' },
  'heart-solid': { box: 24, d: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
  'star-solid': { box: 24, d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  // Overflow "…" affordance on a workout card. Filled dots rather than a
  // stroked glyph so it stays legible at the 18px the card uses.
  'more-vertical': { box: 24, d: 'M12 7.5a2 2 0 110-4 2 2 0 010 4zm0 6.5a2 2 0 110-4 2 2 0 010 4zm0 6.5a2 2 0 110-4 2 2 0 010 4z' },
};

export default function MdbIcon({ name, size = 20, color = '#F1F2F3', strokeWidth }) {
  const filled = FILL[name];
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${filled.box} ${filled.box}`} fill={color}>
        <Path d={filled.d} fillRule="evenodd" clipRule="evenodd" />
      </Svg>
    );
  }

  const stroked = STROKE[name];
  if (!stroked) return null;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth ?? stroked.w}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {stroked.el}
    </Svg>
  );
}
