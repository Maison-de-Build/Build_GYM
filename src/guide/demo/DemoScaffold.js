/**
 * DemoScaffold — the frame every demo screen sits in.
 *
 * Its job is the practice banner: pinned under the status bar on every screen of
 * a run, solid violet behind near-white text, so it cannot be mistaken for the
 * real thing at a glance. The spec is firm that this must be impossible to miss,
 * and a member who is about to see coins come off a balance is exactly who needs
 * to know the balance isn't theirs.
 *
 * Nothing in here or below it imports the API client, a data hook or a payment
 * SDK. That is the safety net: a demo screen cannot book, charge or log
 * anything because the code that would do it isn't on these screens.
 */
import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MC, MF } from '../../theme/mdbKit';

export default function DemoScaffold({ label, children, style }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.screen, style]}>
      <StatusBar barStyle="light-content" backgroundColor={MC.violet} />
      <View style={[s.banner, { paddingTop: insets.top + 8 }]}>
        <Text style={s.bannerText} numberOfLines={2}>{label}</Text>
      </View>
      <View style={s.body}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  banner: {
    backgroundColor: MC.violet,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  bannerText: {
    fontFamily: MF.semibold, fontSize: 12, color: MC.text,
    letterSpacing: 0.2, textAlign: 'center',
  },
  body: { flex: 1 },
});
