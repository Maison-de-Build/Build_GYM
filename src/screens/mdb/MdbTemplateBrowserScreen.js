/**
 * Screen 10 — Template Browser (freestyle members).
 * Port of `screen_10_template_browser.html`.
 *
 * Fixed 44pt bar ("Choose a Workout", empty right slot per spec), then a sticky
 * filter header: one horizontally scrolling row of 22px pills — All, the
 * category chips, a 1px divider, then the activity-target chips — with a
 * "More filters" drawer holding Frequency Fit and Target Muscle Focus. Exactly
 * one category and one target may be active at a time; tapping an active chip
 * clears it.
 *
 * Chip vocabularies come from /template-tag-options, which is admin-editable —
 * hard-coding the pack's list would freeze it.
 *
 * Access: freestyle only. /workout/templates/browse answers 403 for PT members
 * (PRD A.4), which this screen surfaces as a plain explanatory state.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MC, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import { FilterChip, EmptyState } from '../../components/mdb/MdbPrimitives';
import { browseTemplates, fetchTemplateTagOptions } from '../../services/workoutService';
import { estimatedMinutes, intensityLabel, titleCase } from '../../utils/mdbWorkout';

export default function MdbTemplateBrowserScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { date } = route.params || {};

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

  // Muscle-focus chips are auto-derived from what the current results actually
  // train, so the drawer never offers a filter that returns nothing.
  const muscleOptions = useMemo(() => {
    const set = new Set();
    templates.forEach((t) => (t.muscleGroups || []).forEach((m) => set.add(m)));
    return [...set].sort();
  }, [templates]);

  const clearAll = () => { setCategory(null); setTarget(null); setFrequency(null); setMuscle(null); };
  const noFilters = !category && !target && !frequency && !muscle;

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

      {/* ── Sticky filter header ─────────────────────────────────────────── */}
      <View style={s.filterHeader}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipRow}
        >
          <FilterChip label="All" active={noFilters} onPress={clearAll} />

          {tags.category.map((opt) => (
            <FilterChip
              key={opt.value}
              label={opt.displayName}
              active={category === opt.value}
              onPress={() => setCategory((c) => (c === opt.value ? null : opt.value))}
            />
          ))}

          <View style={s.chipDivider} />

          {tags.activity_target.map((opt) => (
            <FilterChip
              key={opt.value}
              label={opt.displayName}
              active={target === opt.value}
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
            <Text style={s.metaLabel}>Sorted by relevance</Text>
            <Text style={s.metaLabel}>•</Text>
            <Text style={s.metaCount}>
              {templates.length} template{templates.length === 1 ? '' : 's'}
            </Text>
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
                      key={opt.value}
                      label={opt.displayName}
                      active={frequency === opt.value}
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
                      key={m}
                      label={titleCase(m)}
                      active={muscle === m}
                      onPress={() => setMuscle((x) => (x === m ? null : m))}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Template feed ────────────────────────────────────────────────── */}
      {blocked ? (
        <EmptyState
          title="Your coach programmes your workouts"
          subtitle="The template library is for members training without a personal trainer."
        />
      ) : loading ? (
        <View style={s.center}><ActivityIndicator color={MC.violetLight} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.feed}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MC.violetLight} />
          }
        >
          {templates.length === 0 ? (
            <EmptyState
              title="No templates match"
              subtitle="Try adjusting your filters"
              actionLabel="Reset to All"
              onAction={clearAll}
            />
          ) : (
            templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onPress={() => navigation.navigate('MdbTemplateDetail', { templateId: t.id, template: t, date })}
              />
            ))
          )}
          <View style={{ height: MS.bottomRoom }} />
        </ScrollView>
      )}
    </View>
  );
}

/* ── One template card ───────────────────────────────────────────────────── */
function TemplateCard({ template, onPress }) {
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
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      <View style={s.cardBody}>
        <View style={s.cardTitleRow}>
          <Text style={s.cardTitle}>{template.name}</Text>
          {!!template.category && (
            <View style={s.tagViolet}>
              <Text style={s.tagVioletText}>{titleCase(template.category)}</Text>
            </View>
          )}
          {!!template.activityTarget && (
            <View style={s.tagCyan}>
              <Text style={s.tagCyanText}>{titleCase(template.activityTarget)}</Text>
            </View>
          )}
        </View>

        <Text style={s.cardStats}>{stats}</Text>
        {!!muscles && <Text style={s.cardMuscles}>{muscles}</Text>}
      </View>

      <View style={s.cardChevron}>
        <MdbIcon name="chevron-right" size={16} color={MC.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text, letterSpacing: -0.2 },

  filterHeader: {
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: MS.hMargin,
    paddingVertical: 2,
  },
  chipDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    paddingTop: 8,
  },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moreText: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaLabel: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },
  metaCount: {
    fontFamily: MF.mono, fontSize: 10, color: MC.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  drawer: {
    paddingHorizontal: MS.hMargin,
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    gap: 10,
  },
  drawerLabel: {
    fontFamily: MF.semibold, fontSize: 9, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary, marginBottom: 6,
  },
  drawerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  feed: { paddingHorizontal: MS.hMargin, paddingTop: 8, gap: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: MC.card,
    borderWidth: 1,
    borderColor: MC.cardBorder,
    borderRadius: MR.card,
  },
  cardBody: { flex: 1, gap: 6 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  cardTitle: { fontFamily: MF.semibold, fontSize: 15, color: MC.text, letterSpacing: -0.2 },
  tagViolet: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: MR.xs,
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.6)', backgroundColor: 'rgba(120,61,236,0.1)',
  },
  tagVioletText: {
    fontFamily: MF.semibold, fontSize: 9, letterSpacing: 0.8,
    textTransform: 'uppercase', color: MC.violetLight,
  },
  tagCyan: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: MR.xs,
    borderWidth: 1, borderColor: 'rgba(6,180,213,0.6)', backgroundColor: 'rgba(6,180,213,0.1)',
  },
  tagCyanText: {
    fontFamily: MF.semibold, fontSize: 9, letterSpacing: 0.8,
    textTransform: 'uppercase', color: MC.cyan,
  },
  cardStats: { fontFamily: MF.medium, fontSize: 12, color: MC.textSecondary },
  cardMuscles: {
    fontFamily: MF.regular, fontSize: 9, letterSpacing: 0.6,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  cardChevron: { paddingTop: 4 },
});
