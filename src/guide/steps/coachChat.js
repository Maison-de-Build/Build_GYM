/**
 * coachChat.js — Guide 4, two steps on a demo chat.
 *
 * Only ever offered to a member who has a coach; the row that launches it does
 * not exist otherwise. The guide never sends, drafts or pre-fills a message.
 */
import { T } from '../targets';
import { ACTIONS } from '../copy';

const CHAT = 'GuideDemoChat';

export function coachChatSteps() {
  return [
    {
      id: 'C1', screen: CHAT, target: T.DC_THREAD,
      title: 'Your coach',
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
