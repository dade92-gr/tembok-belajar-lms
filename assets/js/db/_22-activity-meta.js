// assets/js/db/_22-activity-meta.js
// Helper untuk:
// - unit_activities metadata (completion/gating/assessment/scoring)
// - activity_prerequisites
// - activity_timers
// - activity_video_watches
// - rubric_scores
// - unit_remedial_access
// - Multi-attempt submissions

// ============================================
// ACTIVITY METADATA
// ============================================

async function getActivityMeta(activityId, forceRefresh = false) {
  return cache.fetch(`activity_meta_${activityId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('unit_activities')
      .select(`
        id, unit_id, title, type, order_index,
        completion_mode, gating_mode, assessment_mode, scoring_mode,
        time_limit_minutes, metadata
      `)
      .eq('id', activityId)
      .single();
    if (error) throw error;
    return data;
  }, { ttl: 12 * 60 * 60 * 1000, forceRefresh });
}

async function updateActivityMeta(activityId, updates) {
  const client = initSupabase();
  const payload = {};
  ['completion_mode', 'gating_mode', 'assessment_mode', 'scoring_mode', 'time_limit_minutes']
    .forEach(k => { if (updates[k] !== undefined) payload[k] = updates[k]; });
  if (updates.metadata !== undefined) payload.metadata = updates.metadata;

  const { data, error } = await client.from('unit_activities')
    .update(payload).eq('id', activityId).select().single();
  if (error) throw error;

  cache.clearByPrefix('activity_meta_');
  cache.clearByPrefix('unit_acts_');
  cache.clearByPrefix('activity_');
  return data;
}

// ============================================
// ACTIVITY PREREQUISITES (gating require_ids)
// ============================================

async function getActivityPrerequisites(activityId) {
  return cache.fetch(`act_prereq_${activityId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('activity_prerequisites')
      .select(`
        id, activity_id, prerequisite_activity_id,
        prerequisite:unit_activities!activity_prerequisites_prerequisite_activity_id_fkey (
          id, title, type, order_index
        )
      `)
      .eq('activity_id', activityId);
    if (error) throw error;
    return data || [];
  }, { ttl: 12 * 60 * 60 * 1000 });
}

async function setActivityPrerequisites(activityId, prerequisiteIds) {
  const client = initSupabase();

  // Hapus yang lama
  await client.from('activity_prerequisites').delete().eq('activity_id', activityId);

  // Insert yang baru
  if (prerequisiteIds && prerequisiteIds.length > 0) {
    const rows = prerequisiteIds
      .filter(id => String(id) !== String(activityId))
      .map(id => ({
        activity_id: activityId,
        prerequisite_activity_id: id
      }));
    if (rows.length > 0) {
      const { error } = await client.from('activity_prerequisites').insert(rows);
      if (error) throw error;
    }
  }

  cache.remove(`act_prereq_${activityId}`);
  return true;
}

/**
 * Cek apakah siswa sudah memenuhi prasyarat untuk aktivitas.
 * Return: { unlocked: bool, reason: string, missing: [{id, title}] }
 */
async function checkActivityGating(studentId, activityId) {
  const client = initSupabase();

  // Ambil meta aktivitas
  const { data: activity, error: e1 } = await client.from('unit_activities')
    .select('id, unit_id, order_index, gating_mode, metadata')
    .eq('id', activityId)
    .single();
  if (e1) throw e1;

  const gatingMode = activity.gating_mode || 'none';

  // none → selalu unlocked
  if (gatingMode === 'none') {
    return { unlocked: true, reason: 'no_gating', missing: [] };
  }

  // sequential → cek aktivitas sebelumnya (order_index < current)
  if (gatingMode === 'sequential') {
    const { data: previous } = await client.from('unit_activities')
      .select('id, title, order_index')
      .eq('unit_id', activity.unit_id)
      .lt('order_index', activity.order_index)
      .order('order_index', { ascending: false })
      .limit(1);

    if (!previous || previous.length === 0) {
      // Aktivitas pertama → unlocked
      return { unlocked: true, reason: 'first_activity', missing: [] };
    }

    const prevId = previous[0].id;
    const { data: completed } = await client.from('progress')
      .select('id, status')
      .eq('student_id', studentId)
      .eq('activity_id', prevId)
      .eq('status', 'completed')
      .limit(1);

    if (completed && completed.length > 0) {
      return { unlocked: true, reason: 'sequential_ok', missing: [] };
    }
    return {
      unlocked: false,
      reason: 'sequential_locked',
      missing: [{ id: prevId, title: previous[0].title }]
    };
  }

  // require_ids → cek tabel prerequisites
  if (gatingMode === 'require_ids') {
    const prereqs = await getActivityPrerequisites(activityId);
    if (prereqs.length === 0) {
      return { unlocked: true, reason: 'no_prereqs_defined', missing: [] };
    }

    const prereqIds = prereqs.map(p => p.prerequisite_activity_id);
    const { data: progressRows } = await client.from('progress')
      .select('activity_id, status')
      .eq('student_id', studentId)
      .in('activity_id', prereqIds)
      .eq('status', 'completed');

    const completedIds = new Set((progressRows || []).map(p => String(p.activity_id)));
    const missing = prereqs
      .filter(p => !completedIds.has(String(p.prerequisite_activity_id)))
      .map(p => ({
        id: p.prerequisite_activity_id,
        title: p.prerequisite?.title || '-'
      }));

    return {
      unlocked: missing.length === 0,
      reason: missing.length === 0 ? 'all_prereqs_met' : 'missing_prereqs',
      missing
    };
  }

  return { unlocked: true, reason: 'unknown_mode_fallback', missing: [] };
}

/**
 * Batch check gating untuk semua aktivitas di unit.
 * Return: { [activityId]: { unlocked, reason, missing } }
 */
async function checkAllActivitiesGating(studentId, unitId) {
  const client = initSupabase();
  const { data: activities, error } = await client.from('unit_activities')
    .select('id, title, order_index, gating_mode')
    .eq('unit_id', unitId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  if (!activities || activities.length === 0) return {};

  // Ambil semua progress completed
  const activityIds = activities.map(a => a.id);
  const { data: progressRows } = await client.from('progress')
    .select('activity_id, status')
    .eq('student_id', studentId)
    .in('activity_id', activityIds)
    .eq('status', 'completed');
  const completedIds = new Set((progressRows || []).map(p => String(p.activity_id)));

  // Ambil semua prerequisites (kalau ada require_ids)
  let prereqMap = {};
  const { data: allPrereqs } = await client.from('activity_prerequisites')
    .select(`
      activity_id, prerequisite_activity_id,
      prerequisite:unit_activities!activity_prerequisites_prerequisite_activity_id_fkey (id, title)
    `)
    .in('activity_id', activityIds);

  (allPrereqs || []).forEach(p => {
    if (!prereqMap[p.activity_id]) prereqMap[p.activity_id] = [];
    prereqMap[p.activity_id].push(p);
  });

  const result = {};
  activities.forEach((a, idx) => {
    const mode = a.gating_mode || 'none';

    if (mode === 'none') {
      result[a.id] = { unlocked: true, reason: 'no_gating', missing: [] };
      return;
    }

    if (mode === 'sequential') {
      if (idx === 0) {
        result[a.id] = { unlocked: true, reason: 'first_activity', missing: [] };
        return;
      }
      const prev = activities[idx - 1];
      if (completedIds.has(String(prev.id))) {
        result[a.id] = { unlocked: true, reason: 'sequential_ok', missing: [] };
      } else {
        result[a.id] = {
          unlocked: false,
          reason: 'sequential_locked',
          missing: [{ id: prev.id, title: prev.title }]
        };
      }
      return;
    }

    if (mode === 'require_ids') {
      const prereqs = prereqMap[a.id] || [];
      if (prereqs.length === 0) {
        result[a.id] = { unlocked: true, reason: 'no_prereqs_defined', missing: [] };
        return;
      }
      const missing = prereqs
        .filter(p => !completedIds.has(String(p.prerequisite_activity_id)))
        .map(p => ({
          id: p.prerequisite_activity_id,
          title: p.prerequisite?.title || '-'
        }));
      result[a.id] = {
        unlocked: missing.length === 0,
        reason: missing.length === 0 ? 'all_prereqs_met' : 'missing_prereqs',
        missing
      };
      return;
    }

    result[a.id] = { unlocked: true, reason: 'unknown_mode_fallback', missing: [] };
  });

  return result;
}

// ============================================
// ACTIVITY TIMERS (untuk time_limit_minutes)
// ============================================

async function getOrCreateTimer(studentId, activityId, attemptNumber = 1) {
  const client = initSupabase();

  // Cek timer existing
  const { data: existing } = await client.from('activity_timers')
    .select('*')
    .eq('student_id', studentId)
    .eq('activity_id', activityId)
    .eq('attempt_number', attemptNumber)
    .maybeSingle();

  if (existing) return existing;

  // Buat baru — ambil time_limit dari aktivitas
  const { data: activity } = await client.from('unit_activities')
    .select('time_limit_minutes')
    .eq('id', activityId)
    .single();

  if (!activity || !activity.time_limit_minutes) return null;

  const now = new Date();
  const deadline = new Date(now.getTime() + activity.time_limit_minutes * 60 * 1000);

  const { data: created, error } = await client.from('activity_timers')
    .insert([{
      student_id: studentId,
      activity_id: activityId,
      attempt_number: attemptNumber,
      started_at: now.toISOString(),
      deadline_at: deadline.toISOString(),
      status: 'running'
    }])
    .select()
    .single();
  if (error) throw error;
  return created;
}

async function finishTimer(timerId, expired = false) {
  const client = initSupabase();
  const { error } = await client.from('activity_timers')
    .update({
      submitted_at: new Date().toISOString(),
      status: expired ? 'expired' : 'finished'
    })
    .eq('id', timerId);
  if (error) throw error;
  return true;
}

async function getActiveTimer(studentId, activityId, attemptNumber = 1) {
  const client = initSupabase();
  const { data } = await client.from('activity_timers')
    .select('*')
    .eq('student_id', studentId)
    .eq('activity_id', activityId)
    .eq('attempt_number', attemptNumber)
    .eq('status', 'running')
    .maybeSingle();
  return data;
}

// ============================================
// VIDEO WATCH TRACKING
// ============================================

async function getVideoWatch(studentId, activityId, componentId, attemptNumber = 1) {
  const client = initSupabase();
  const { data } = await client.from('activity_video_watches')
    .select('*')
    .eq('student_id', studentId)
    .eq('activity_id', activityId)
    .eq('component_id', componentId)
    .eq('attempt_number', attemptNumber)
    .maybeSingle();
  return data;
}

async function upsertVideoWatch({
  studentId, activityId, componentId, attemptNumber = 1,
  watchedSeconds, totalSeconds, lastPosition, playbackRate = 1,
  positionsWatched, completed = false
}) {
  const client = initSupabase();
  const percent = totalSeconds > 0 ? Math.round((watchedSeconds / totalSeconds) * 100) : 0;

  const payload = {
    student_id: studentId,
    activity_id: activityId,
    component_id: componentId,
    attempt_number: attemptNumber,
    watched_seconds: watchedSeconds,
    total_seconds: totalSeconds,
    watched_percent: percent,
    last_position: lastPosition,
    playback_rate: playbackRate,
    positions_watched: positionsWatched || [],
    updated_at: new Date().toISOString()
  };
  if (completed) payload.completed_at = new Date().toISOString();

  const { data, error } = await client.from('activity_video_watches')
    .upsert(payload, {
      onConflict: 'student_id,activity_id,component_id,attempt_number'
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function markVideoCompleted(studentId, activityId, componentId, attemptNumber = 1) {
  const client = initSupabase();
  const { error } = await client.from('activity_video_watches')
    .update({ completed_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('activity_id', activityId)
    .eq('component_id', componentId)
    .eq('attempt_number', attemptNumber);
  if (error) throw error;
  return true;
}

// ============================================
// COMPLETION TRACKING (progress.completion_data)
// ============================================

async function getCompletionData(studentId, activityId) {
  const client = initSupabase();
  const { data } = await client.from('progress')
    .select('*')
    .eq('student_id', studentId)
    .eq('activity_id', activityId)
    .maybeSingle();
  return data || null;
}

async function updateCompletionData({
  studentId, unitId, activityId, status, completionData, completed = false
}) {
  const client = initSupabase();

  // Cek existing
  const { data: existing } = await client.from('progress')
    .select('id, completion_data')
    .eq('student_id', studentId)
    .eq('activity_id', activityId)
    .maybeSingle();

  const merged = {
    ...(existing && existing.completion_data ? existing.completion_data : {}),
    ...(completionData || {})
  };

  const payload = {
    student_id: studentId,
    unit_id: unitId,
    activity_id: activityId,
    status: status || 'in_progress',
    completion_data: merged,
    last_update: new Date().toISOString()
  };
  if (completed) payload.completed_at = new Date().toISOString();

  const { data, error } = await client.from('progress')
    .upsert(payload, { onConflict: 'student_id,activity_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================
// RUBRIK SCORES
// ============================================

async function getRubricScores(submissionId) {
  const client = initSupabase();
  const { data, error } = await client.from('rubric_scores')
    .select('*')
    .eq('submission_id', submissionId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function saveRubricScores(submissionId, criteria) {
  const client = initSupabase();

  // Hapus yang lama
  await client.from('rubric_scores').delete().eq('submission_id', submissionId);

  // Insert baru
  if (criteria && criteria.length > 0) {
    const rows = criteria.map((c, idx) => ({
      submission_id: submissionId,
      criterion_name: c.name,
      criterion_max: c.max,
      score: c.score,
      note: c.note || null,
      order_index: idx
    }));
    const { error } = await client.from('rubric_scores').insert(rows);
    if (error) throw error;
  }

  // Hitung nilai total
  const totalScore = criteria.reduce((s, c) => s + parseFloat(c.score || 0), 0);
  const totalMax = criteria.reduce((s, c) => s + parseFloat(c.max || 0), 0);
  const finalScore = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

  // Update submission score
  await client.from('submissions')
    .update({ score: finalScore, status: 'graded' })
    .eq('id', submissionId);

  return { finalScore, totalScore, totalMax };
}

// ============================================
// UNIT ACCESS (window normal & remedial)
// ============================================

async function getUnitAccess(unitId) {
  return cache.fetch(`unit_access_${unitId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('units')
      .select(`
        id, title,
        access_start_at, access_end_at,
        remedial_enabled, remedial_open_at, remedial_close_at,
        remedial_condition, remedial_metadata,
        required_unit_ids
      `)
      .eq('id', unitId)
      .single();
    if (error) throw error;
    return data;
  }, { ttl: 5 * 60 * 1000 });
}

/**
 * Cek akses siswa ke unit.
 * Return: { access: 'full'|'read_only'|'remedial'|'locked', reason: string }
 */
async function checkStudentUnitAccess(studentId, unitId) {
  const unit = await getUnitAccess(unitId);
  if (!unit) return { access: 'locked', reason: 'unit_not_found' };

  const now = new Date();
  const start = unit.access_start_at ? new Date(unit.access_start_at) : null;
  const end = unit.access_end_at ? new Date(unit.access_end_at) : null;
  const remedialStart = unit.remedial_open_at ? new Date(unit.remedial_open_at) : null;
  const remedialEnd = unit.remedial_close_at ? new Date(unit.remedial_close_at) : null;

  // Cek window normal
  if (start && now < start) {
    return { access: 'locked', reason: 'before_start', opensAt: start.toISOString() };
  }

  if (!end || now <= end) {
    // Dalam window normal
    return { access: 'full', reason: 'in_normal_window' };
  }

  // Setelah window normal → cek remedial
  if (!unit.remedial_enabled) {
    return { access: 'read_only', reason: 'unit_closed_no_remedial' };
  }

  // Cek window remedial
  if (remedialStart && now < remedialStart) {
    return { access: 'read_only', reason: 'remedial_not_started', opensAt: remedialStart.toISOString() };
  }
  if (remedialEnd && now > remedialEnd) {
    return { access: 'read_only', reason: 'remedial_closed' };
  }

  // Dalam window remedial → cek syarat
  const granted = await checkRemedialAccess(studentId, unitId, unit);
  if (granted.allowed) {
    return { access: 'remedial', reason: granted.reason, metadata: unit.remedial_metadata };
  }

  return { access: 'read_only', reason: granted.reason || 'remedial_not_granted' };
}

async function checkRemedialAccess(studentId, unitId, unit) {
  const client = initSupabase();
  const condition = unit.remedial_condition || 'score_below_passing';
  const meta = unit.remedial_metadata || {};
  const passingGrade = meta.passing_grade || 70;

  // 1. Cek manual access
  const { data: manualAccess } = await client.from('unit_remedial_access')
    .select('*')
    .eq('student_id', studentId)
    .eq('unit_id', unitId)
    .maybeSingle();

  if (manualAccess) {
    // Cek expiry
    if (manualAccess.expires_at && new Date(manualAccess.expires_at) < new Date()) {
      // Expired — tapi kalau condition != manual, cek condition lain
      if (condition !== 'manual' && condition !== 'any') {
        // lanjut ke cek otomatis
      } else {
        return { allowed: false, reason: 'manual_access_expired' };
      }
    } else {
      return { allowed: true, reason: 'manual_access' };
    }
  }

  // 2. Cek berdasarkan condition
  if (condition === 'any') {
    return { allowed: true, reason: 'any_allowed' };
  }

  if (condition === 'manual') {
    return { allowed: false, reason: 'manual_required' };
  }

  if (condition === 'request') {
    // Harus ada di unit_remedial_access (sudah dicek di atas)
    return { allowed: false, reason: 'request_pending' };
  }

  if (condition === 'score_below_passing') {
    // Cek nilai sumatif di unit
    const { data: activities } = await client.from('unit_activities')
      .select('id, assessment_mode')
      .eq('unit_id', unitId)
      .eq('assessment_mode', 'summative');
    if (!activities || activities.length === 0) {
      return { allowed: false, reason: 'no_summative_activity' };
    }
    const actIds = activities.map(a => a.id);
    const { data: subs } = await client.from('submissions')
      .select('activity_id, score, is_final_score')
      .eq('student_id', studentId)
      .in('activity_id', actIds)
      .eq('is_final_score', true);

    const hasBelowPassing = (subs || []).some(s =>
      s.score !== null && parseFloat(s.score) < passingGrade
    );
    return hasPassingGradeHelper(hasBelowPassing, passingGrade);
  }

  if (condition === 'all_sumatif_below_passing') {
    const { data: activities } = await client.from('unit_activities')
      .select('id')
      .eq('unit_id', unitId)
      .eq('assessment_mode', 'summative');
    if (!activities || activities.length === 0) {
      return { allowed: false, reason: 'no_summative_activity' };
    }
    const actIds = activities.map(a => a.id);
    const { data: subs } = await client.from('submissions')
      .select('activity_id, score')
      .eq('student_id', studentId)
      .in('activity_id', actIds)
      .eq('is_final_score', true);

    const allBelow = (subs || []).length > 0 &&
      subs.every(s => s.score !== null && parseFloat(s.score) < passingGrade);
    if (allBelow) return { allowed: true, reason: 'all_sumatif_below_passing' };
    return { allowed: false, reason: 'not_all_below_passing' };
  }

  if (condition === 'incomplete') {
    const { data: activities } = await client.from('unit_activities')
      .select('id').eq('unit_id', unitId);
    if (!activities || activities.length === 0) {
      return { allowed: false, reason: 'no_activities' };
    }
    const actIds = activities.map(a => a.id);
    const { data: progress } = await client.from('progress')
      .select('activity_id, status')
      .eq('student_id', studentId)
      .in('activity_id', actIds)
      .eq('status', 'completed');

    const completedCount = (progress || []).length;
    if (completedCount < actIds.length) {
      return { allowed: true, reason: 'has_incomplete' };
    }
    return { allowed: false, reason: 'all_completed' };
  }

  return { allowed: false, reason: 'unknown_condition' };
}

function hasPassingGradeHelper(hasBelow, passingGrade) {
  if (hasBelow) return { allowed: true, reason: 'score_below_passing' };
  return { allowed: false, reason: 'all_passing' };
}

/**
 * Grant manual remedial access (guru → siswa)
 */
async function grantRemedialAccess({
  studentId, unitId, grantedBy, expiresAt, reason, notes
}) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_remedial_access')
    .upsert([{
      student_id: studentId,
      unit_id: unitId,
      granted_by: grantedBy || null,
      granted_at: new Date().toISOString(),
      expires_at: expiresAt || null,
      reason: reason || 'manual',
      notes: notes || null
    }], { onConflict: 'student_id,unit_id' })
    .select()
    .single();
  if (error) throw error;
  cache.clearByPrefix('unit_remedial_');
  return data;
}

async function revokeRemedialAccess(studentId, unitId) {
  const client = initSupabase();
  const { error } = await client.from('unit_remedial_access')
    .delete()
    .eq('student_id', studentId)
    .eq('unit_id', unitId);
  if (error) throw error;
  cache.clearByPrefix('unit_remedial_');
  return true;
}

/**
 * Ambil semua remedial access siswa (untuk banner dashboard)
 */
async function getMyRemedialAccess(studentId) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_remedial_access')
    .select(`
      id, unit_id, granted_at, expires_at, reason,
      units (id, title, remedial_open_at, remedial_close_at, remedial_metadata,
        annual_plans (id, subjects (id, name), classes (id, name)))
    `)
    .eq('student_id', studentId);
  if (error) throw error;
  return data || [];
}

// ============================================
// MULTI-ATTEMPT SUBMISSIONS
// ============================================

async function getStudentAttempts(studentId, activityId) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions')
    .select('id, attempt_number, status, score, is_remedial, is_final_score, submitted_at, created_at')
    .eq('student_id', studentId)
    .eq('activity_id', activityId)
    .order('attempt_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getNextAttemptNumber(studentId, activityId) {
  const client = initSupabase();
  const { data } = await client.from('submissions')
    .select('attempt_number')
    .eq('student_id', studentId)
    .eq('activity_id', activityId)
    .order('attempt_number', { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return 1;
  return (data[0].attempt_number || 0) + 1;
}

async function getFinalScore(studentId, activityId) {
  const client = initSupabase();
  const { data } = await client.from('submissions')
    .select('score, attempt_number')
    .eq('student_id', studentId)
    .eq('activity_id', activityId)
    .eq('is_final_score', true)
    .maybeSingle();
  return data;
}

/**
 * Hitung agregasi nilai dari semua attempt (kecuali is_final_score di-set manual)
 * @param {string} aggregation - 'latest' | 'highest' | 'average' | 'first'
 * @param {number} capAt - nilai maksimum (capped), misal passing grade saat remedial
 */
async function aggregateAttemptScores(studentId, activityId, aggregation = 'highest', capAt = null) {
  const attempts = await getStudentAttempts(studentId, activityId);
  if (attempts.length === 0) return null;

  // Filter attempt yang punya nilai
  const scored = attempts.filter(a => a.score !== null && a.score !== undefined);
  if (scored.length === 0) return null;

  let finalScore;
  if (aggregation === 'latest') {
    finalScore = parseFloat(scored[scored.length - 1].score);
  } else if (aggregation === 'first') {
    finalScore = parseFloat(scored[0].score);
  } else if (aggregation === 'average') {
    finalScore = scored.reduce((s, a) => s + parseFloat(a.score), 0) / scored.length;
  } else {
    // highest
    finalScore = Math.max(...scored.map(a => parseFloat(a.score)));
  }

  if (capAt !== null && finalScore > capAt) finalScore = capAt;
  return {
    score: finalScore,
    attempts: attempts.length,
    aggregation,
    cappedAt: capAt
  };
}

/**
 * Tandai submission sebagai final score (un-set yang lain)
 */
async function setFinalSubmission(studentId, activityId, submissionId) {
  const client = initSupabase();
  // Un-set semua dulu
  await client.from('submissions')
    .update({ is_final_score: false })
    .eq('student_id', studentId)
    .eq('activity_id', activityId);

  // Set yang baru
  const { data, error } = await client.from('submissions')
    .update({ is_final_score: true })
    .eq('id', submissionId)
    .select()
    .single();
  if (error) throw error;
  cache.clearByPrefix('subs_');
  return data;
}

// ============================================
// EXPORT (untuk build.js)
// ============================================

console.log('[db/_22-activity-meta] loaded');