/**
 * PracticeBanner — the strip that says none of this is real.
 *
 * Rendered twice on purpose, from one component so the two can't drift: the
 * demo screen draws it so the screen is correct on its own, and the guide
 * overlay draws it again on top of the dim. Without the second one the single
 * most important thing on the screen — the reason a balance is allowed to drop
 * — would be the one element sitting at 15% brightness.
 */
import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MF } from '../../theme/mdbKit';

/**
 * `withExit` leaves room on the right for the guide's exit control, which lives
 * in this strip on practice screens: the top-right corner under it is where real
 * screens put their own controls (the Activities coin balance, for one), and an
 * exit drawn there sat on top of them. Both copies of the banner — the screen's
 * and the overlay's — pass it, so they wrap identically and stay the same height.
 */
export default function PracticeBanner({ label, style, withExit = false }) {
  const insets = useSafeAreaInsets();
  // StatusBar.currentHeight is available on the very first render; the safe-area
  // inset resolves a frame or two later. Taking the larger of the two keeps the
  // banner's height stable from the start, which matters because the guide
  // measures its target as soon as the screen appears — a banner that grows
  // afterwards pushes the whole screen down and leaves the cutout above it.
  const top = bannerTopInset(insets);
  return (
    <View style={[s.banner, { paddingTop: top + 8 }, withExit && s.bannerWithExit, style]} pointerEvents="none">
      <Text style={[s.text, withExit && s.textWithExit]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

/** Space above the banner's text: the status bar, on the very first render. */
export function bannerTopInset(insets) {
  return Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
}

/** Room kept on the right of the strip for the exit control. */
export const BANNER_EXIT_ROOM = 112;

const BANNER_EXIT_ROOM_STYLE = 112;

// A soft violet tint rather than solid violet. The solid strip, stacked on the
// dim, made the practice screens read as heavy and dark; this still marks every
// screen as practice without shouting over the screen it sits on.
const s = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(120,61,236,0.30)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(167,123,255,0.35)',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  bannerWithExit: { paddingRight: BANNER_EXIT_ROOM_STYLE },
  text: {
    fontFamily: MF.medium, fontSize: 12, color: '#E4D8FF',
    letterSpacing: 0.2, textAlign: 'center',
  },
  textWithExit: { textAlign: 'left' },
});
