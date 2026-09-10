/**
 * GradientText — the pack's `.gradient-timer-text` (background-clip: text).
 *
 * The handoff is explicit that this treatment appears exactly once per screen
 * (screen 03's live session timer), so keep its use rare. Implemented with
 * MaskedView + LinearGradient, which is the RN equivalent of clipping a
 * gradient to the glyphs.
 */
import React from 'react';
import { Text, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { MG } from '../../theme/mdbKit';

export default function GradientText({ style, children, colors = MG.primary }) {
  return (
    <MaskedView
      maskElement={
        // The mask is drawn from the glyph alpha, so the colour here is arbitrary.
        <Text style={[style, { backgroundColor: 'transparent' }]}>{children}</Text>
      }
    >
      <LinearGradient colors={colors} start={MG.start} end={MG.end}>
        {/* Same text again, made invisible — it only sizes the gradient box. */}
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
