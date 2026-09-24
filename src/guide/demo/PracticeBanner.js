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

import { MC, MF } from '../../theme/mdbKit';

export default function PracticeBanner({ label, style }) {
  const insets = useSafeAreaInsets();
  // StatusBar.currentHeight is available on the very first render; the safe-area
  // inset resolves a frame or two later. Taking the larger of the two keeps the
  // banner's height stable from the start, which matters because the guide
  // measures its target as soon as the screen appears — a banner that grows
  // afterwards pushes the whole screen down and leaves the cutout above it.
  const top = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  return (
    <View style={[s.banner, { paddingTop: top + 8 }, style]} pointerEvents="none">
      <Text style={s.text} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: MC.violet, paddingHorizontal: 16, paddingBottom: 8 },
  text: {
    fontFamily: MF.semibold, fontSize: 12, color: MC.text,
    letterSpacing: 0.2, textAlign: 'center',
  },
});
