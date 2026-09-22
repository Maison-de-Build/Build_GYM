/**
 * Screen 07 — Nutrition Plan (PT members only).
 * Port of `screen_07_nutrition_plan.html`.
 *
 * Hero card with four macro bars (protein cyan · carbs violet · fat amber ·
 * calories gradient), the trainer's note, then the prescribed meals with their
 * food snapshots and three-way adherence buttons.
 *
 * The macro bars show **adherence-implied** progress, not logged intake — the
 * pack says so in its own footnote, and this app has no food-logging surface.
 * A followed meal counts 1, a partial 0.5, a skipped or unmarked 0. The footnote
 * is kept verbatim so the number is never mistaken for measured intake.
 *
 * Access: PT members only. Freestyle members get null from /nutrition/plan and
 * see the plain no-plan state.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import { LuxuryCard, EmptyState, PrimaryCta } from '../../components/mdb/MdbPrimitives';
import { fetchNutritionPlan, postMealAdherence, completeNutritionDay } from '../../services/nutritionService';
import { isoDate } from '../../utils/mdbWorkout';

const ADHERENCE = [
  { key: 'followed', label: '✓ Followed', color: MC.fresh },
  { key: 'partial', label: 'Partial', color: MC.warm },
  { key: 'skipped', label: 'Skipped', color: MC.workedSolid },
];

const WEIGHT = { followed: 1, partial: 0.5, skipped: 0 };

export default function MdbNutritionScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [date] = useState(() => isoDate(new Date()));
  const [plan, setPlan] = useState(undefined); // undefined = loading, null = none
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    try { setPlan(await fetchNutritionPlan(date) || null); }
    catch { setPlan(null); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const meals = plan?.meals || [];

  // Adherence-implied fill, shared by all four bars (see the header note).
  const progress = useMemo(() => {
    if (!meals.length) return 0;
    const scored = meals.reduce((sum, m) => sum + (WEIGHT[m.adherence] ?? 0), 0);
    return scored / meals.length;
  }, [meals]);

  const followedCount = meals.filter((m) => m.adherence === 'followed').length;
  const locked = !!plan?.dayLocked;
  const allMarked = meals.length > 0 && meals.every((m) => !!m.adherence);

  const mark = async (meal, status) => {
    if (locked) return;
    // Re-tapping the current status used to clear it locally and then return
    // without telling the server — there is no clear verb — so the mark
    // silently came back on the next refresh. A no-op is the honest answer.
    if (meal.adherence === status) return;
    // Optimistic — the row flips instantly, reverts if the write fails.
    setPlan((p) => ({
      ...p,
      meals: p.meals.map((m) => (m.id === meal.id ? { ...m, adherence: status } : m)),
    }));
    try {
      await postMealAdherence({ mealId: meal.id, date, status });
    } catch {
      setPlan((p) => ({
        ...p,
        meals: p.meals.map((m) => (m.id === meal.id ? { ...m, adherence: meal.adherence } : m)),
      }));
    }
  };

  const completeDay = () => {
    Alert.alert(
      'Complete the day?',
      "You won't be able to change today's meals after this.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setCompleting(true);
            try {
              await completeNutritionDay(date);
              await load();
            } catch (e) {
              Alert.alert('Could not complete', e?.response?.data?.message || 'Please try again.');
            } finally {
              setCompleting(false);
            }
          },
        },
      ],
    );
  };

  if (plan === undefined) {
    return (
      <View style={[s.screen, s.center]}>
        <ActivityIndicator color={MC.violetLight} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Nutrition</Text>
        <View style={s.dateChip}>
          <Text style={s.dateText}>
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </Text>
        </View>
      </View>

      {!plan ? (
        <EmptyState
          title="No nutrition plan yet"
          subtitle="Your coach will publish one here when it's ready."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
              tintColor={MC.violetLight}
            />
          }
        >
          {/* ── Daily targets ──────────────────────────────────────────────── */}
          <LuxuryCard style={s.heroCard}>
            <View style={s.heroHead}>
              <Text style={s.eyebrow}>DAILY TARGETS</Text>
              {locked ? (
                <View style={s.lockedChip}>
                  <MdbIcon name="check" size={10} color={MC.fresh} />
                  <Text style={s.lockedChipText}>COMPLETED</Text>
                </View>
              ) : (
                <Text style={s.adherenceCount}>
                  {followedCount} of {meals.length} meals followed
                </Text>
              )}
            </View>

            <View style={s.bars}>
              <MacroBar label="Protein" value={fmtG(plan.targets?.proteinG)} pct={progress} color={MC.cyan} />
              <MacroBar label="Carbs" value={fmtG(plan.targets?.carbsG)} pct={progress} color={MC.violet} />
              <MacroBar label="Fat" value={fmtG(plan.targets?.fatG)} pct={progress} color={MC.warm} />
              <MacroBar
                label="Calories"
                value={plan.targets?.calories != null ? `${Math.round(plan.targets.calories).toLocaleString()} kcal` : '—'}
                pct={progress}
                gradient
              />
            </View>

            <Text style={s.basisNote}>
              * Based on adherence-implied progress (macro snapshot approximation)
            </Text>

            {!!plan.note && (
              <View style={s.trainerNote}>
                <Text style={s.trainerNoteText}>"{plan.note}"</Text>
              </View>
            )}
          </LuxuryCard>

          {/* ── Prescribed meals ───────────────────────────────────────────── */}
          <View style={s.mealsSection}>
            <View style={s.mealsHead}>
              <Text style={s.sectionLabel}>PRESCRIBED MEALS</Text>
              <Text style={s.mealsHint}>
                {locked ? 'Day completed — locked' : 'Tap to mark adherence'}
              </Text>
            </View>

            {meals.map((meal) => (
              <LuxuryCard key={meal.id} style={s.mealCard}>
                <View style={s.mealHead}>
                  <Text style={s.mealName}>{meal.name}</Text>
                  {!!meal.note && <Text style={s.mealNote} numberOfLines={1}>{meal.note}</Text>}
                </View>

                {(meal.foods || []).length > 0 && (
                  <View style={s.foodList}>
                    {meal.foods.map((f, i) => (
                      <View key={f.id} style={[s.foodRow, i > 0 && s.foodDivider]}>
                        <Text style={s.foodName} numberOfLines={1}>
                          {f.name}{f.quantity ? ` — ${portion(f)}` : ''}
                        </Text>
                        <Text style={s.foodMacros}>{macroLine(f)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={s.adherenceRow}>
                  {ADHERENCE.map((opt) => {
                    const on = meal.adherence === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          s.adherenceBtn,
                          on && { borderColor: opt.color, backgroundColor: `${opt.color}1F` },
                          locked && !on && s.adherenceBtnMuted,
                        ]}
                        onPress={() => mark(meal, opt.key)}
                        activeOpacity={locked ? 1 : 0.85}
                        disabled={locked}
                      >
                        <Text style={[s.adherenceText, on && { color: opt.color }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </LuxuryCard>
            ))}
          </View>

          {!locked && meals.length > 0 && (
            <View style={s.completeWrap}>
              <PrimaryCta
                label={completing ? 'COMPLETING…' : 'COMPLETE DAY'}
                onPress={completeDay}
                disabled={!allMarked || completing}
                icon={null}
              />
              {!allMarked && (
                <Text style={s.completeHint}>Mark every meal to finish the day</Text>
              )}
            </View>
          )}

          <View style={{ height: MS.bottomRoom }} />
        </ScrollView>
      )}
    </View>
  );
}

function MacroBar({ label, value, pct, color, gradient }) {
  const width = `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`;
  return (
    <View>
      <View style={s.macroHead}>
        <Text style={s.macroLabel}>{label}</Text>
        <Text style={s.macroValue}>{value}</Text>
      </View>
      <View style={s.macroTrack}>
        {gradient ? (
          <LinearGradient colors={MG.primary} start={MG.startX} end={MG.endX} style={[s.macroFill, { width }]} />
        ) : (
          <View style={[s.macroFill, { width, backgroundColor: color }]} />
        )}
      </View>
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
const fmtG = (v) => (v != null ? `${Math.round(v)}g` : '—');
const trimNum = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : String(n));

/**
 * How much of this food the plan prescribes.
 *
 * The quantity used to be rendered here with a hardcoded "g" while the trainer
 * app rendered the same number as a serving multiplier — so a coach entering
 * "2 servings" showed the member "2g", and a plain 1 read as "Banana — 1g".
 * `unit` comes from the plan now; anything without it predates the column and
 * is a serving count.
 */
const portion = (f) =>
  (f.unit === 'g' ? `${trimNum(f.quantity)} g` : `${trimNum(f.quantity)} serving${Number(f.quantity) === 1 ? '' : 's'}`);

const macroLine = (f) => [
  f.proteinG != null ? `${Math.round(f.proteinG)}g P` : null,
  f.carbsG != null ? `${Math.round(f.carbsG)}g C` : null,
  f.fatG != null ? `${Math.round(f.fatG)}g F` : null,
].filter(Boolean).join(' · ');

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { alignItems: 'center', justifyContent: 'center' },

  topBar: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text, letterSpacing: -0.2 },
  dateChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: MR.button },
  dateText: { fontFamily: MF.medium, fontSize: 13, color: MC.textSecondary },

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 16, gap: 20 },
  eyebrow: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  sectionLabel: {
    fontFamily: MF.semibold, fontSize: 11, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },

  heroCard: { padding: 16, gap: 14 },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adherenceCount: { fontFamily: MF.medium, fontSize: 10, color: MC.fresh },

  bars: { gap: 10 },
  macroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  macroLabel: { fontFamily: MF.medium, fontSize: 13, color: MC.textSecondary },
  macroValue: {
    fontFamily: MF.monoSemi, fontSize: 14, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  macroTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  macroFill: { height: '100%', borderRadius: 2 },

  basisNote: { fontFamily: MF.regular, fontSize: 9, color: MC.textTertiary, letterSpacing: -0.1 },
  trainerNote: { paddingTop: 10, borderTopWidth: 1, borderTopColor: MC.cardBorder },
  trainerNoteText: { fontFamily: MF.regular, fontSize: 11, fontStyle: 'italic', color: MC.textSecondary },

  mealsSection: { gap: 14 },
  mealsHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  mealsHint: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },

  mealCard: { padding: 14, gap: 12 },
  mealHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mealName: { fontFamily: MF.semibold, fontSize: 14, color: MC.text },
  mealNote: {
    flexShrink: 1, textAlign: 'right',
    fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary,
  },

  foodList: { opacity: 0.65 },
  foodRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, paddingVertical: 5,
  },
  foodDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  foodName: { flex: 1, fontFamily: MF.regular, fontSize: 12, color: MC.textSecondary },
  foodMacros: {
    fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary,
    fontVariant: ['tabular-nums'],
  },

  adherenceRow: { flexDirection: 'row', gap: 8 },
  adherenceBtn: {
    flex: 1, height: 32, borderRadius: MR.button,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: MC.cardBorder,
  },
  adherenceText: { fontFamily: MF.medium, fontSize: 11, color: MC.textSecondary },
  adherenceBtnMuted: { opacity: 0.4 },

  lockedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: MR.xs,
    backgroundColor: 'rgba(52,211,153,0.10)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.30)',
  },
  lockedChipText: {
    fontFamily: MF.semibold, fontSize: 9, letterSpacing: 0.8, color: MC.fresh,
  },

  completeWrap: { gap: 8, marginTop: 4 },
  completeHint: {
    fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary, textAlign: 'center',
  },
});
