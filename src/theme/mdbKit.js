/**
 * mdbKit.js — "Maison de Build" design system.
 *
 * Direct port of the developer-handoff pack (`maison-de-build-mobile`):
 *   tokens/design-tokens.json + tokens/theme.ts + tailwind.config.js.
 *
 * These tokens back the NEW MDB screens only (src/screens/mdb/**). The rest of
 * the app keeps src/theme/colors.js (Elite Noir) and src/theme/stitchKit.js
 * (Forge Tokyo V3) — nothing existing is re-themed by this file.
 *
 * Reference frame for every screen in the pack: iPhone 15 Pro, 390 × 844 pt,
 * 16px horizontal margin, 80px bottom breathing room.
 */

// ── Colours ────────────────────────────────────────────────────────────────
export const MC = {
  // Canvas
  bg: '#08060B',            // near-black with a violet undertone
  bgDeep: '#040306',        // page ground behind the device frame
  card: 'rgba(255,255,255,0.04)',
  cardAlt: 'rgba(255,255,255,0.03)',
  cardBorder: 'rgba(255,255,255,0.06)',
  cardBorderHover: 'rgba(255,255,255,0.12)',
  completedCta: '#1A1A1E',
  surfaceRaised: '#1A1622',

  // Text
  text: '#F1F2F3',          // primary
  textSecondary: '#B9B2BA', // muted lavender-grey
  textTertiary: '#8E828D',  // dark mauve

  // Accent
  violet: '#783DEC',
  violetLight: '#A77BFF',
  cyan: '#06B4D5',
  warm: '#F5A623',          // amber gold

  // Status
  fresh: '#34D399',
  moderate: '#F5A623',
  worked: 'rgba(239,68,68,0.60)',
  workedSolid: '#EF4444',

  // Extra chart hues used by the analytics + wellness screens
  magenta: '#EC4899',
  zone1: '#4A4652',
  zone4: '#9F6BFF',

  white: '#FFFFFF',
  black: '#000000',
};

// Primary gradient — `linear-gradient(135deg, #783DEC 0%, #06B4D5 100%)`.
// LinearGradient equivalent: top-left → bottom-right.
export const MG = {
  primary: [MC.violet, MC.cyan],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
  // Horizontal variant (progress bars, underlines, segmented strips).
  startX: { x: 0, y: 0 },
  endX: { x: 1, y: 0 },
  // Vertical variant (volume bars grow bottom→top).
  startY: { x: 0, y: 1 },
  endY: { x: 0, y: 0 },
};

// ── Typography ─────────────────────────────────────────────────────────────
// Montserrat for everything; JetBrains Mono strictly for tabular figures
// (the pack's `.font-mono-nums` class).
export const MF = {
  light: 'Montserrat_300Light',
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',

  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemi: 'JetBrainsMono_600SemiBold',
};

export const MR = { card: 12, button: 8, pill: 9999, sm: 6, xs: 4 };

export const MS = {
  hMargin: 16,
  bottomRoom: 80,
  screenW: 390,
  screenH: 844,
};

// ── Shared style fragments ─────────────────────────────────────────────────
// Import these into a screen's StyleSheet so every MDB screen shares the exact
// card / header / chip / CTA treatment described in the handoff README.
export const MKIT = {
  screen: { flex: 1, backgroundColor: MC.bg },

  // Fixed 44pt top nav: back chevron · centred title · right slot.
  topBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
  },
  topBarTitle: {
    fontFamily: MF.semibold,
    fontSize: 16,
    color: MC.text,
  },
  // 44×44 touch target for the chevron.
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -12 },

  // Luxury card surface.
  card: {
    backgroundColor: MC.card,
    borderWidth: 1,
    borderColor: MC.cardBorder,
    borderRadius: MR.card,
  },

  // 10px uppercase tracked label ("KG TOTAL VOLUME", "TODAY'S WORKOUT").
  eyebrow: {
    fontFamily: MF.semibold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: MC.textTertiary,
  },

  // Tabular figures.
  mono: { fontFamily: MF.mono, fontVariant: ['tabular-nums'] },

  // Pill / chip.
  chip: {
    height: 20,
    paddingHorizontal: 10,
    borderRadius: MR.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: MC.cardBorder,
  },
  chipText: {
    fontFamily: MF.medium,
    fontSize: 10,
    letterSpacing: 0.5,
    color: MC.textTertiary,
    textTransform: 'uppercase',
  },

  // Primary CTA (wrap in a LinearGradient) and its completed counterpart.
  cta: { height: 48, borderRadius: MR.button, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: MF.semibold, fontSize: 13, letterSpacing: 1.5, color: MC.white },
  ctaDone: {
    height: 48,
    borderRadius: MR.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: MC.completedCta,
    borderWidth: 1,
    borderColor: MC.cardBorder,
  },
  ctaDoneText: { fontFamily: MF.semibold, fontSize: 13, letterSpacing: 1.5, color: MC.textSecondary },

  // Exactly 80px of breathing room before the home indicator.
  bottomRoom: { height: MS.bottomRoom },
};

// Muscle recovery status → colour + label, per PRD A.7 (labels only, never advice).
export const RECOVERY = {
  fresh: { color: MC.fresh, label: 'Fresh' },
  moderate: { color: MC.moderate, label: 'Moderate' },
  worked: { color: MC.worked, label: 'Worked' },
};

/** Map a 0–100 recovery score to its status key. */
export const recoveryStatus = (score) =>
  score >= 85 ? 'fresh' : score >= 65 ? 'moderate' : 'worked';

export default { MC, MG, MF, MR, MS, MKIT, RECOVERY, recoveryStatus };
