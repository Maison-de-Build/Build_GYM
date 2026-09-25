/**
 * coachChat.js — Guide 4, two steps on a demo chat.
 *
 * Only ever offered to a member who has a coach; the row that launches it does
 * not exist otherwise. The guide never sends, drafts or pre-fills a message.
 */
import { T } from '../targets';
import { ACTIONS, ENTRY } from '../copy';

const CHAT = 'GuideDemoChat';

export function coachChatSteps() {
  return [
    // Starts on the real MY COACH card on Home. Optional: the card only draws
    // once the chat thread exists, and a coach assigned minutes ago may not
    // have one yet — the guide goes straight to the chat rather than stall.
    {
      id: 'C0', screen: 'MainTabs', target: T.HOME_COACH, optional: true,
      ...ENTRY.coach,
    },
    {
      id: 'C1', screen: CHAT, target: T.DC_THREAD,
      title: 'Your chat',
      body: 'Questions about a session, your form or your plan? Message your coach here.',
    },
    {
      id: 'C2', screen: CHAT, target: T.DC_INPUT,
      title: 'Say hello',
      body: 'Messages go straight to your coach.',
      primaryLabel: ACTIONS.done,
    },
  ].map((step) => ({
    mode: 'passive',
    advanceOn: 'tap',
    primaryLabel: ACTIONS.next,
    exitLabel: ACTIONS.skip,
    ...step,
  }));
}
