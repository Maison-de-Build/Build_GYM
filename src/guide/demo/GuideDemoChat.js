/**
 * Demo: the coach chat.
 *
 * Two sample messages and an input the member can see but not send from — the
 * guide never sends, drafts or pre-fills a message, and a working send here
 * would put practice text in a real coach's thread the moment the screens are
 * ever wired to anything.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, FONTS } from '../../theme';
import DemoScaffold from './DemoScaffold';
import GuideTarget from '../GuideTarget';
import { T } from '../targets';
import { DEMO_BANNER } from '../copy';
import { DEMO_COACH, DEMO_MESSAGES } from './demoData';

export default function GuideDemoChat() {
  return (
    <DemoScaffold label={DEMO_BANNER.chat}>
      <View style={s.header}>
        <View style={s.avatar}><Text style={s.avatarText}>{DEMO_COACH.initial}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{DEMO_COACH.name}</Text>
          <Text style={s.status}>Coach</Text>
        </View>
      </View>

      <GuideTarget id={T.DC_THREAD} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {DEMO_MESSAGES.map((m) => (
            <View
              key={m.id}
              style={[s.bubbleRow, { justifyContent: m.mine ? 'flex-end' : 'flex-start' }]}
            >
              <View style={[s.bubble, m.mine ? s.mine : s.theirs]}>
                <Text style={[s.text, m.mine && s.textMine]}>{m.text}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </GuideTarget>

      <GuideTarget id={T.DC_INPUT}>
        <View style={s.inputBar}>
          <View style={s.input}>
            <Text style={s.placeholder}>Message your coach…</Text>
          </View>
          <View style={s.sendBtn}>
            <Ionicons name="send" size={18} color={COLORS.textMuted} />
          </View>
        </View>
      </GuideTarget>
    </DemoScaffold>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.white },
  name: { fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.white },
  status: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, marginTop: 1 },

  scroll: { padding: 16, gap: 10 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  theirs: { backgroundColor: '#1A1A2E', borderBottomLeftRadius: 4 },
  mine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  text: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  textMine: { color: COLORS.white },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    flex: 1, height: 42, borderRadius: 21, justifyContent: 'center', paddingHorizontal: 16,
    backgroundColor: '#1A1A2E',
  },
  placeholder: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A1A2E',
  },
});
