/**
 * Screen 10 — Choose a Workout (freestyle members). Multi-select.
 * Port of `screen_10_template_browser.html`, extended for round 4.
 *
 * A freestyle member can pick one or more gym templates, some standalone
 * exercises (an ad-hoc mini-session), or both, for one day — in one visit.
 * Two tabs share one running selection and one sticky commit bar at the
 * bottom:
 *   Templates  — the existing filter system (category/activity_target/
 *                frequency_fit/muscle), cards toggle in/out of the selection;
 *                tapping a card body opens a read-only preview
 *                (MdbTemplateDetail) that can also toggle it.
 *   Exercises  — muscle-group tabs + search over the exercise library, rows
 *                toggle in/out with inline per-exercise Sets/Reps/Weight/Rest
 *                inputs when selected (ported from the trainer app's
 *                exercise picker interaction).
 *
 * Commit calls POST /workout/self-assign/bundle once with everything
 * selected. A 409 SELF_ASSIGN_EXISTS offers the same Replace-day confirm the
 * single-template flow already used.
 *
 * Access: freestyle only. /workout/templates/browse answers 403 for PT
 * members (PRD A.4), which this screen surfaces as a plain explanatory state.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MC, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import { FilterChip, EmptyState, SegmentedRange, PrimaryCta } from '../../components/mdb/MdbPrimitives';
import AdhocExerciseRow, { newAdhocEntry, adhocEntriesToPayload } from '../../components/mdb/AdhocExerciseRow';
import {
  browseTemplates, fetchTemplateTagOptions, fetchExercises, selfAssignBundle,
} from '../../services/workoutService';
import { estimatedMinutes, intensityLabel, titleCase, isoDate } from '../../utils/mdbWorkout';

const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'legs_quads', 'legs_hamstrings_glutes', 'core', 'cardio', 'full_body',
];

const MODES = [{ key: 'templates', label: 'Templates' }, { key: 'exercises', label: 'Exercises' }];

export default function MdbTemplateBrowserScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { date, preselectTemplateId } = route.params || {};

  const [mode, setMode] = useState('templates');

  /* ── Templates tab state ─────────────────────────────────────────────── */
  const [tags, setTags] = useState({ category: [], activity_target: [], frequency_fit: [] });
  const [templates, setTemplates] = useState([]);
  const [category, setCategory] = useState(null);
  const [target, setTarget] = useState(null);
  const [frequency, setFrequency] = useState(null);
  const [muscle, setMuscle] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState(
    () => new Set(preselectTemplateId ? [preselectTemplateId] : []),
  );

  /* ── Exercises tab state ─────────────────────────────────────────────── */
  const [activeMuscle, setActiveMuscle] = useState(MUSCLE_GROUPS[0]);
  const [exercises, setExercises] = useState([]);
  const [exLoading, setExLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adhocMap, setAdhocMap] = useState(() => new Map());

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplateTagOptions()
      .then((g) => g && setTags(g))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const rows = await browseTemplates({
        ...(category ? { category } : {}),
        ...(target ? { activity_target: target } : {}),
        ...(frequency ? { frequency_fit: frequency } : {}),
        ...(muscle ? { muscle } : {}),
      });
      setTemplates(rows || []);
      setBlocked(false);
    } catch (e) {
      if (e?.response?.status === 403) setBlocked(true);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [category, target, frequency, muscle]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    setExLoading(true);
    fetchExercises(activeMuscle)
      .then((rows) => setExercises(rows || []))
      .catch(() => setExercises([]))
      .finally(() => setExLoading(false));
  }, [activeMuscle]);

  const muscleOptions = useMemo(() => {
    const set = new Set();
    templates.forEach((t) => (t.muscleGroups || []).forEach((m) => set.add(m)));
    return [...set].sort();
  }, [templates]);

  const clearAll = () => { setCategory(null); setTarget(null); setFrequency(null); setMuscle(null); };
  const noFilters = !category && !target && !frequency && !muscle;

  const toggleTemplate = (id) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleExercise = (ex) => {
    setAdhocMap((prev) => {
      const next = new Map(prev);
      if (next.has(ex.id)) next.delete(ex.id);
      else next.set(ex.id, { exercise: ex, entry: newAdhocEntry() });
      return next;
    });
  };

  const updateAdhocField = (exerciseId, field, value) => {
    setAdhocMap((prev) => {
      const next = new Map(prev);
      const cur = next.get(exerciseId);
      if (cur) next.set(exerciseId, { ...cur, entry: { ...cur.entry, [field]: value } });
      return next;
    });
  };

  const filteredExercises = exercises.filter((ex) => ex.name.toLowerCase().includes(search.toLowerCase()));
  const count = selectedTemplateIds.size + (adhocMap.size ? 1 : 0);

  const commit = useCallback(async (collisionStrategy = 'add') => {
    if (count === 0 || submitting) return;
    setSubmitting(true);
    try {
      await selfAssignBundle({
        date,
        templateIds: [...selectedTemplateIds],
        exercises: adhocEntriesToPayload(adhocMap),
        collisionStrategy,
      });
      navigation.navigate('MdbTrainingHub');
    } catch (e) {
      const status = e?.response?.status;
      const code = e?.response?.data?.code;
      if (status === 409 && code === 'SELF_ASSIGN_EXISTS') {
        Alert.alert(
          'Replace that day\'s schedule?',
          e?.response?.data?.message || 'You already have workouts scheduled for this day.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Replace', style: 'destructive', onPress: () => commit('replace') },
          ],
        );
      } else {
        Alert.alert('Could not schedule', e?.response?.data?.message || 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [count, submitting, date, selectedTemplateIds, adhocMap, navigation]);

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      {/* ── 44pt top bar ─────────────────────────────────────────────────── */}
      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Choose a Workout</Text>
        <View style={s.backBtn} />
      </View>

      <SegmentedRange options={MODES} value={mode} onChange={setMode} style={s.segment} />

      {blocked ? (
        <EmptyState
          title="Your coach programmes your workouts"
          subtitle="The template library is for members training without a personal trainer."
        />
      ) : mode === 'templates' ? (
        <>
          {/* ── Sticky filter header ───────────────────────────────────── */}
          <View style={s.filterHeader}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              <FilterChip label="All" active={noFilters} onPress={clearAll} />
              {tags.category.map((opt) => (
                <FilterChip
                  key={opt.value} label={opt.displayName} active={category === opt.value}
                  onPress={() => setCategory((c) => (c === opt.value ? null : opt.value))}
                />
              ))}
              <View style={s.chipDivider} />
              {tags.activity_target.map((opt) => (
                <FilterChip
                  key={opt.value} label={opt.displayName} active={target === opt.value}
                  onPress={() => setTarget((t) => (t === opt.value ? null : opt.value))}
                />
              ))}
            </ScrollView>

            <View style={s.metaRow}>
              <TouchableOpacity style={s.moreBtn} onPress={() => setShowMore((v) => !v)} activeOpacity={0.7}>
                <Text style={s.moreText}>{showMore ? 'Fewer filters' : 'More filters'}</Text>
                <MdbIcon name={showMore ? 'chevron-up' : 'chevron-down'} size={12} color={MC.textTertiary} />
              </TouchableOpacity>
              <View style={s.metaRight}>
                <Text style={s.metaLabel}>{templates.length} template{templates.length === 1 ? '' : 's'}</Text>
              </View>
            </View>

            {showMore && (
              <View style={s.drawer}>
                {tags.frequency_fit.length > 0 && (
                  <View>
                    <Text style={s.drawerLabel}>Frequency Fit</Text>
                    <View style={s.drawerChips}>
                      {tags.frequency_fit.map((opt) => (
                        <FilterChip
                          key={opt.value} label={opt.displayName} active={frequency === opt.value}
                          onPress={() => setFrequency((f) => (f === opt.value ? null : opt.value))}
                        />
                      ))}
                    </View>
                  </View>
                )}
                {muscleOptions.length > 0 && (
                  <View>
                    <Text style={s.drawerLabel}>Target Muscle Focus</Text>
                    <View style={s.drawerChips}>
                      {muscleOptions.map((m) => (
                        <FilterChip
                          key={m} label={titleCase(m)} active={muscle === m}
                          onPress={() => setMuscle((x) => (x === m ? null : m))}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {loading ? (
            <View style={s.center}><ActivityIndicator color={MC.violetLight} /></View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.feed}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MC.violetLight} />}
            >
              {templates.length === 0 ? (
                <EmptyState title="No templates match" subtitle="Try adjusting your filters" actionLabel="Reset to All" onAction={clearAll} />
              ) : (
                templates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    selected={selectedTemplateIds.has(t.id)}
                    onToggle={() => toggleTemplate(t.id)}
                    onPreview={() => navigation.navigate('MdbTemplateDetail', {
                      templateId: t.id, template: t,
                      isSelected: selectedTemplateIds.has(t.id),
                      onToggle: toggleTemplate,
                    })}
                  />
                ))
              )}
              <View style={{ height: 100 }} />
            </ScrollView>
          )}
        </>
      ) : (
        <>
          {/* ── Muscle-group tabs ──────────────────────────────────────── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.muscleTabRow}>
            {MUSCLE_GROUPS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[s.muscleTab, activeMuscle === g && s.muscleTabOn]}
                onPress={() => setActiveMuscle(g)}
                activeOpacity={0.8}
              >
                <Text style={[s.muscleTabText, activeMuscle === g && s.muscleTabTextOn]}>{titleCase(g)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Search ─────────────────────────────────────────────────── */}
          <View style={s.searchRow}>
            <MdbIcon name="search" size={14} color={MC.textTertiary} />
            <TextInput
              style={s.searchInput}
              placeholder="Search exercises…"
              placeholderTextColor={MC.textTertiary}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {exLoading ? (
            <View style={s.center}><ActivityIndicator color={MC.violetLight} /></View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
              {filteredExercises.length === 0 ? (
                <EmptyState title="No exercises found" subtitle="Try another muscle group or search term" />
              ) : (
                filteredExercises.map((ex) => (
                  <AdhocExerciseRow
                    key={ex.id}
                    exercise={ex}
                    entry={adhocMap.get(ex.id)?.entry}
                    onToggle={() => toggleExercise(ex)}
                    onChangeField={(field, v) => updateAdhocField(ex.id, field, v)}
                  />
                ))
              )}
            </ScrollView>
          )}
        </>
      )}

      {/* ── Sticky commit bar ────────────────────────────────────────────── */}
      {!blocked && (
        <View style={[s.commitBar, { paddingBottom: 12 + insets.bottom }]}>
          <PrimaryCta
            label={submitting ? 'SCHEDULING…' : `SCHEDULE ${count} FOR ${friendlyDate(date)}`}
            onPress={() => commit('add')}
            disabled={count === 0 || submitting}
            icon={null}
          />
        </View>
      )}
    </View>
  );
}

/* ── One template card ───────────────────────────────────────────────────── */
function TemplateCard({ template, selected, onToggle, onPreview }) {
  const exercises = template.exercises || [];
  const mins = template.estimatedMinutes ?? estimatedMinutes(exercises);
  const intensity = intensityLabel(exercises);
  const muscles = (template.muscleGroups || []).map(titleCase).join(' · ');

  const stats = [
    `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`,
    mins ? `${mins} min` : null,
    intensity ? `${intensity} intensity` : null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={s.card}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} hitSlop={8} style={s.cardToggle}>
        <View style={[s.toggleCircle, selected && s.toggleCircleOn]}>
          {selected && <MdbIcon name="check" size={12} color={MC.white} />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={s.cardBody} onPress={onPreview} activeOpacity={0.85}>
        <View style={s.cardTitleRow}>
          <Text style={s.cardTitle}>{template.name}</Text>
          {!!template.category && (
            <View style={s.tagViolet}><Text style={s.tagVioletText}>{titleCase(template.category)}</Text></View>
          )}
          {!!template.activityTarget && (
            <View style={s.tagCyan}><Text style={s.tagCyanText}>{titleCase(template.activityTarget)}</Text></View>
          )}
        </View>
        <Text style={s.cardStats}>{stats}</Text>
        {!!muscles && <Text style={s.cardMuscles}>{muscles}</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={s.cardChevron} onPress={onPreview} activeOpacity={0.7} hitSlop={8}>
        <MdbIcon name="chevron-right" size={16} color={MC.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

/** "Today" / "Tomorrow" / "Fri 12 Sep" for the commit bar's label. */
function friendlyDate(iso) {
  if (!iso) return 'this day';
  const today = isoDate(new Date());
  if (iso === today) return 'Today';
  const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
  if (iso === isoDate(tmrw)) return 'Tomorrow';
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? 'this day' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text, letterSpacing: -0.2 },

  segment: { marginHorizontal: MS.hMargin, marginTop: 12, marginBottom: 4 },

  filterHeader: { paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: MS.hMargin, paddingVertical: 2 },
  chipDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: MS.hMargin, paddingTop: 8 },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moreText: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaLabel: { fontFamily: MF.mono, fontSize: 10, color: MC.textSecondary, fontVariant: ['tabular-nums'] },

  drawer: { paddingHorizontal: MS.hMargin, paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', gap: 10 },
  drawerLabel: { fontFamily: MF.semibold, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: MC.textTertiary, marginBottom: 6 },
  drawerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  feed: { paddingHorizontal: MS.hMargin, paddingTop: 8, gap: 12 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder, borderRadius: MR.card,
  },
  cardToggle: { paddingLeft: 14, paddingVertical: 16 },
  toggleCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: MC.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleCircleOn: { backgroundColor: MC.violet, borderColor: MC.violet },
  cardBody: { flex: 1, minWidth: 0, gap: 6, paddingVertical: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  cardTitle: { fontFamily: MF.semibold, fontSize: 15, color: MC.text, letterSpacing: -0.2 },
  tagViolet: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: MR.xs,
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.6)', backgroundColor: 'rgba(120,61,236,0.1)',
  },
  tagVioletText: { fontFamily: MF.semibold, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: MC.violetLight },
  tagCyan: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: MR.xs,
    borderWidth: 1, borderColor: 'rgba(6,180,213,0.6)', backgroundColor: 'rgba(6,180,213,0.1)',
  },
  tagCyanText: { fontFamily: MF.semibold, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: MC.cyan },
  cardStats: { fontFamily: MF.medium, fontSize: 12, color: MC.textSecondary },
  cardMuscles: { fontFamily: MF.regular, fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase', color: MC.textTertiary },
  cardChevron: { paddingRight: 14, paddingVertical: 16, paddingLeft: 4 },

  /* Exercises tab */
  muscleTabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: MS.hMargin, paddingVertical: 10 },
  muscleTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: MR.pill, backgroundColor: 'rgba(255,255,255,0.04)' },
  muscleTabOn: { backgroundColor: MC.violet },
  muscleTabText: { fontFamily: MF.medium, fontSize: 12, color: MC.textSecondary },
  muscleTabTextOn: { color: MC.white, fontFamily: MF.semibold },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: MS.hMargin, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: MR.card,
    borderWidth: 1, borderColor: MC.cardBorder,
  },
  searchInput: { flex: 1, fontFamily: MF.regular, fontSize: 13, color: MC.text, padding: 0 },

  /* Sticky commit bar */
  commitBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: MC.bg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: MS.hMargin, paddingTop: 12,
  },
});
