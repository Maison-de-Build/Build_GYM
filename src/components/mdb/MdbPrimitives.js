/**
 * Shared MDB building blocks — the fragments the handoff pack repeats across
 * screens (`.luxury-card`, `.gradient-border-circle`, the 40px floating back
 * pill, the segmented range selector, the section header row).
 *
 * Keeping them here means a token tweak lands on every MDB screen at once.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MC, MG, MF, MR } from '../../theme/mdbKit';
import MdbIcon from './MdbIcon';

/* ── .luxury-card ────────────────────────────────────────────────────────── */
export function LuxuryCard({ style, children, ...rest }) {
  return <View style={[s.card, style]} {...rest}>{children}</View>;
}

/* ── 40px floating back pill (fixed top-left, sits above content) ────────── */
export function BackPill({ onPress }) {
  return (
    <TouchableOpacity
      style={s.backPill}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
    >
      <MdbIcon name="chevron-left" size={20} color={MC.text} />
    </TouchableOpacity>
  );
}

/* ── .gradient-border-circle — 1px violet→cyan ring around a bg-filled disc ─ */
export function GradientRing({ size = 28, children, style }) {
  return (
    <LinearGradient
      colors={MG.primary}
      start={MG.start}
      end={MG.end}
      style={[{ width: size, height: size, borderRadius: size / 2, padding: 1 }, style]}
    >
      <View
        style={{
          flex: 1,
          borderRadius: size / 2,
          backgroundColor: MC.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

/* ── Exercise-sequence letter bubble (A–F) ───────────────────────────────── */
export function ExerciseLetter({ letter, size = 28 }) {
  return (
    <GradientRing size={size}>
      <Text style={s.letter}>{letter}</Text>
    </GradientRing>
  );
}

/* ── Fixed 44pt top nav: chevron · centred title · right slot ────────────── */
export function TopBar({ title, onBack, right = null, style }) {
  return (
    <View style={[s.topBar, style]}>
      <TouchableOpacity style={s.navBtn} onPress={onBack} activeOpacity={0.7} hitSlop={8}>
        <MdbIcon name="chevron-left" size={22} color={MC.textSecondary} />
      </TouchableOpacity>
      <Text style={s.topBarTitle} numberOfLines={1}>{title}</Text>
      <View style={s.navRight}>{right}</View>
    </View>
  );
}

/* ── Segmented range selector (Week | Month | All) ───────────────────────── */
export function SegmentedRange({ options, value, onChange, style }) {
  return (
    <View style={[s.segment, style]}>
      {options.map((opt) => {
        const on = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[s.segmentBtn, on && s.segmentBtnOn]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.8}
          >
            <Text style={[s.segmentText, on && s.segmentTextOn]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── Section header: uppercase label (+ optional meta) and a right slot ──── */
export function SectionHeader({ label, meta, right, style }) {
  return (
    <View style={[s.sectionHead, style]}>
      <View style={s.sectionHeadLeft}>
        <Text style={s.sectionLabel}>{label}</Text>
        {!!meta && <Text style={s.sectionMeta}>{meta}</Text>}
      </View>
      {right}
    </View>
  );
}

/* ── Small tinted tag (category = violet, target = cyan) ─────────────────── */
export function Tag({ label, tone = 'violet', style }) {
  const color = tone === 'cyan' ? MC.cyan : tone === 'warm' ? MC.warm : MC.violetLight;
  const border = tone === 'cyan' ? 'rgba(6,180,213,0.6)' : tone === 'warm' ? 'rgba(245,166,35,0.6)' : 'rgba(120,61,236,0.6)';
  const bg = tone === 'cyan' ? 'rgba(6,180,213,0.1)' : tone === 'warm' ? 'rgba(245,166,35,0.1)' : 'rgba(120,61,236,0.1)';
  return (
    <View style={[s.tag, { borderColor: border, backgroundColor: bg }, style]}>
      <Text style={[s.tagText, { color }]}>{label}</Text>
    </View>
  );
}

/* ── Horizontal filter-chip rail ─────────────────────────────────────────── */
export function ChipRail({ children, style, contentStyle }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, contentStyle]}
    >
      {children}
    </ScrollView>
  );
}

/* ── Filter chip with a gradient border when active ──────────────────────── */
export function FilterChip({ label, active, onPress }) {
  if (active) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <LinearGradient colors={MG.primary} start={MG.startX} end={MG.endX} style={s.chipActiveWrap}>
          <View style={s.chipActiveInner}>
            <Text style={s.chipTextOn}>{label}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={s.chip} onPress={onPress} activeOpacity={0.85}>
      <Text style={s.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Full-width gradient CTA / its "completed" counterpart ───────────────── */
export function PrimaryCta({ label, onPress, height = 46, icon = 'chevron-right', disabled }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={disabled} style={{ opacity: disabled ? 0.5 : 1 }}>
      <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={[s.cta, { height }]}>
        <Text style={s.ctaText}>{label}</Text>
        {!!icon && <MdbIcon name={icon} size={16} color={MC.white} />}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function CompletedCta({ label = 'COMPLETED', onPress, height = 46 }) {
  return (
    <TouchableOpacity style={[s.ctaDone, { height }]} onPress={onPress} activeOpacity={0.9}>
      <Text style={s.ctaDoneText}>{label}</Text>
      <MdbIcon name="check-bold" size={16} color={MC.warm} />
    </TouchableOpacity>
  );
}

/* ── Minimal empty state (no illustrations, per the pack's copy rules) ───── */
export function EmptyState({ title, subtitle, actionLabel, onAction, style }) {
  return (
    <View style={[s.empty, style]}>
      <Text style={s.emptyTitle}>{title}</Text>
      {!!subtitle && <Text style={s.emptySub}>{subtitle}</Text>}
      {!!actionLabel && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7} style={{ marginTop: 12 }}>
          <Text style={s.emptyAction}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ── Brand footer note ("Maison de Build • Private PT Agenda") ───────────── */
export function BrandFooter({ note }) {
  return (
    <View style={s.brandFooter}>
      <Text style={s.brandFooterText}>Maison de Build</Text>
      <Text style={s.brandFooterText}>•</Text>
      <Text style={s.brandFooterText}>{note}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: MC.card,
    borderWidth: 1,
    borderColor: MC.cardBorder,
    borderRadius: MR.card,
  },

  backPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  letter: { fontFamily: MF.semibold, fontSize: 12, color: MC.text },

  topBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navRight: { minWidth: 44, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 12 },
  topBarTitle: { flex: 1, textAlign: 'center', fontFamily: MF.semibold, fontSize: 16, color: MC.text },

  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: MR.sm,
    padding: 2,
  },
  segmentBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: MR.xs },
  segmentBtnOn: {
    backgroundColor: MC.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(120,61,236,0.3)',
  },
  segmentText: {
    fontFamily: MF.medium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: MC.textTertiary,
  },
  segmentTextOn: { color: MC.text },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: {
    fontFamily: MF.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: MC.textTertiary,
  },
  sectionMeta: { fontFamily: MF.medium, fontSize: 11, color: MC.textSecondary },

  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: MR.xs,
    borderWidth: 1,
  },
  tagText: { fontFamily: MF.semibold, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase' },

  // .chip-inactive / .chip-active from the pack: 22px pill, 8px radius; active
  // gets a 1px violet→cyan ring over a violet-15% fill (a ::before gradient in
  // CSS, a LinearGradient wrapper here).
  chip: {
    height: 22,
    paddingHorizontal: 10,
    borderRadius: MR.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: MC.cardBorder,
  },
  chipText: { fontFamily: MF.medium, fontSize: 11, color: MC.textSecondary },
  chipActiveWrap: { height: 22, borderRadius: MR.button, padding: 1 },
  chipActiveInner: {
    flex: 1,
    paddingHorizontal: 9,
    borderRadius: MR.button - 1,
    backgroundColor: 'rgba(120,61,236,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTextOn: { fontFamily: MF.medium, fontSize: 11, color: MC.text },

  cta: {
    borderRadius: MR.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontFamily: MF.semibold,
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: MC.white,
  },
  ctaDone: {
    borderRadius: MR.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: MC.completedCta,
    borderWidth: 1,
    borderColor: MC.cardBorder,
  },
  ctaDoneText: {
    fontFamily: MF.semibold,
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: MC.textSecondary,
  },

  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: MF.medium, fontSize: 14, color: MC.textSecondary, textAlign: 'center' },
  emptySub: { fontFamily: MF.regular, fontSize: 12, color: MC.textTertiary, marginTop: 6, textAlign: 'center' },
  emptyAction: { fontFamily: MF.semibold, fontSize: 12, color: MC.cyan },

  brandFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 8 },
  brandFooterText: {
    fontFamily: MF.regular,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: MC.textTertiary,
  },
});
