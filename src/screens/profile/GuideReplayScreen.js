/**
 * GuideReplayScreen — Profile > Replay guide.
 *
 * Lists every guide this member is eligible for and runs it again. A replay is
 * identical to a first run: it goes through the same launcher and the same step
 * list, and since no step is built from the member's own data there is nothing
 * that could make the second run differ from the first.
 *
 * Replaying never brings the Get started card back and never changes
 * card_dismissed — a member who hid the card has said they are done with it,
 * and finding a guide from Profile is not a request to undo that.
 */
import React, { useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS, FONTS } from '../../theme';
import SafeBottomBar from '../../components/SafeBottomBar';
import GradientIcon from '../../components/GradientIcon';
import { REPLAY } from '../../guide/copy';
import { useGuideStore } from '../../guide';
import { eligibleGuides } from '../../guide/guideRules';
import { useGuideLauncher, isGuideImplemented } from '../../guide/useGuideLauncher';

export default function GuideReplayScreen({ navigation }) {
  const config = useGuideStore((s) => s.config);
  const resetGuides = useGuideStore((s) => s.reset);
  const launchGuide = useGuideLauncher();

  // The welcome tour is not one of the card's guides, so it is not in
  // eligibleGuides — it leads the replay list on its own switch.
  const rows = useMemo(() => {
    const keys = [];
    if (config.welcome) keys.push('welcome_tour');
    keys.push(...eligibleGuides(config));
    // A guide whose switch is on but which hasn't been built yet would be a row
    // that does nothing when tapped.
    return keys.filter(isGuideImplemented);
  }, [config]);

  const replay = useCallback((key) => {
    // Every guide starts on Home now, so go there first and let the launcher
    // take over. When it ends the member comes back to this list with the whole
    // stack beneath it — list, Profile, Home — so both the back arrow and the
    // phone's back button work. The first version returned to a lone Profile
    // screen with nothing under it, and back went nowhere.
    navigation.navigate('MainTabs');
    setTimeout(() => launchGuide(key, {
      returnStack: ['MainTabs', 'Profile', 'GuideReplay'],
    }), 350);
  }, [launchGuide, navigation]);

  const confirmReset = useCallback(() => {
    Alert.alert(REPLAY.reset.confirmTitle, REPLAY.reset.confirmBody, [
      { text: REPLAY.reset.cancel, style: 'cancel' },
      {
        text: REPLAY.reset.confirm,
        style: 'destructive',
        onPress: async () => {
          try {
            await resetGuides();
            // Straight to Home: the tour starts there exactly as on first launch.
            navigation.navigate('MainTabs');
          } catch {
            Alert.alert(REPLAY.reset.failed);
          }
        },
      },
    ]);
  }, [resetGuides, navigation]);

  return (
    <SafeBottomBar style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <TouchableOpacity style={s.back} onPress={() => navigation.goBack()} hitSlop={10} activeOpacity={0.7}>
        <GradientIcon name="arrow-back" size={24} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.header}>{REPLAY.title.toUpperCase()}</Text>
        <Text style={s.sub}>{REPLAY.subtitle}</Text>

        <View style={s.list}>
          {rows.map((key) => {
            const copy = REPLAY.rows[key];
            if (!copy) return null;
            return (
              <TouchableOpacity
                key={key}
                style={s.row}
                onPress={() => replay(key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={copy.title}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{copy.title}</Text>
                  <Text style={s.rowSub}>{copy.sub}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            );
          })}

          {rows.length === 0 && <Text style={s.empty}>No guides are available right now.</Text>}
        </View>

        {/* Test accounts only. The server refuses a reset from anyone else, so
            this row is a convenience rather than the gate. */}
        {config.isTestAccount && (
          <TouchableOpacity style={s.resetRow} onPress={confirmReset} activeOpacity={0.8}>
            <MaterialIcons name="restart-alt" size={20} color="#F87171" />
            <View style={{ flex: 1 }}>
              <Text style={s.resetTitle}>{REPLAY.reset.title}</Text>
              <Text style={s.rowSub}>{REPLAY.reset.sub}</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeBottomBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  back: { position: 'absolute', top: 52, left: 20, zIndex: 100, padding: 4 },
  scroll: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24 },

  header: {
    fontFamily: FONTS.headline, fontSize: 18, color: COLORS.textPrimary,
    letterSpacing: 5, textAlign: 'center', textTransform: 'uppercase', marginBottom: 8,
  },
  sub: {
    fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted,
    textAlign: 'center', marginBottom: 24,
  },

  list: { gap: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: 16,
  },
  rowTitle: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.white, marginBottom: 2 },
  rowSub: { fontFamily: FONTS.body, fontSize: 11, color: 'rgba(212,193,207,0.6)' },
  empty: {
    fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted,
    textAlign: 'center', paddingVertical: 24,
  },

  resetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(248,113,113,0.08)', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)', marginTop: 24,
  },
  resetTitle: { fontFamily: FONTS.bodyBold, fontSize: 14, color: '#F87171', marginBottom: 2 },
});
