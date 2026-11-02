// assets/js/db/_16-submissions.js
// Submissions & grades

async function getSubmissionsByActivity(activityId, forceRefresh = false) {
  return cache.fetch(`subs_act_${activityId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('submissions').select(`
      id, assessment_id, activity_id, student_id, status, answers, score, teacher_feedback, submitted_at, created_at,
      profiles!submissions_student_profile_fkey (id, name, email, nisn)
    `).eq('activity_id', activityId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }, { ttl: 2 * 60 * 1000, forceRefresh });
}

async function getSubmissionsByAssessment(assessmentId) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions').select(`
    id, assessment_id, activity_id, student_id, status, answers, score, teacher_feedback, submitted_at, created_at,
    profiles!submissions_student_profile_fkey (id, name, email, nisn)
  `).eq('assessment_id', assessmentId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getSubmissionById(id) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions').select(`
    *,
    profiles!submissions_student_profile_fkey (id, name, email, nisn),
    assessments (id, title, type, duration_minutes, due_date, auto_grade)
  `).eq('id', id).single();
  if (error) throw error;
  return data;
}

async function getSubmissionsByStudent(studentId) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions').select(`
    id, assessment_id, activity_id, status, answers, score, teacher_feedback, submitted_at,
    assessments (id, title, type, unit_id)
  `).eq('student_id', studentId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function submitAssessment({ assessmentId, studentId, answers }) {
  const client = initSupabase();
  const { data: existing } = await client.from('submissions')
    .select('id').eq('assessment_id', assessmentId).eq('student_id', studentId).maybeSingle();

  if (existing) {
    const { data, error } = await client.from('submissions')
      .update({ answers, submitted_at: new Date().toISOString(), status: 'submitted' })
      .eq('id', existing.id).select().single();
    if (error) throw error;
    cache.clearByPrefix('subs_');
    return data;
  } else {
    const { data, error } = await client.from('submissions')
      .insert([{ assessment_id: assessmentId, student_id: studentId, answers, status: 'submitted' }])
      .select().single();
    if (error) throw error;
    cache.clearByPrefix('subs_');
    return data;
  }
}

async function submitActivityAnswers({ activityId, studentId, answers }) {
  const client = initSupabase();
  const { data: existing } = await client.from('submissions')
    .select('id').eq('activity_id', activityId).eq('student_id', studentId).maybeSingle();

  if (existing) {
    const { data, error } = await client.from('submissions')
      .update({ answers, submitted_at: new Date().toISOString(), status: 'submitted' })
      .eq('id', existing.id).select().single();
    if (error) throw error;
    cache.clearByPrefix('subs_');
    return data;
  } else {
    const { data, error } = await client.from('submissions')
      .insert([{ activity_id: activityId, student_id: studentId, answers, status: 'submitted' }])
      .select().single();
    if (error) throw error;
    cache.clearByPrefix('subs_');
    return data;
  }
}

async function updateSubmission(id, updates) {
  const client = initSupabase();
  const payload = {};
  ['status','answers','score','teacher_feedback'].forEach(k => {
    if (updates[k] !== undefined) payload[k] = updates[k];
  });
  const { data, error } = await client.from('submissions')
    .update(payload).eq('id', id).select().single();
  if (error) throw error;
  cache.clearByPrefix('subs_');
  return data;
}

async function gradeSubmission({ submissionId, score, teacherFeedback }) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions')
    .update({
      score,
      teacher_feedback: teacherFeedback || null,
      status: 'graded'
    }).eq('id', submissionId).select().single();
  if (error) throw error;
  cache.clearByPrefix('subs_');
  return data;
}