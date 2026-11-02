// assets/js/db/_18-progress.js
// Progress siswa

async function getProgressByStudent(studentId) {
  const client = initSupabase();
  const { data, error } = await client.from('progress').select(`
    id, student_id, unit_id, activity_id, status, completed_at,
    units (id, title),
    unit_activities (id, title, type)
  `).eq('student_id', studentId)
    .order('completed_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

async function upsertProgress({ studentId, unitId, activityId, status, completedAt }) {
  const client = initSupabase();
  const { data, error } = await client.from('progress')
    .upsert([{
      student_id: studentId,
      unit_id: unitId || null,
      activity_id: activityId || null,
      status: status || 'in_progress',
      completed_at: completedAt || null,
      last_update: new Date().toISOString()
    }], { onConflict: 'student_id,activity_id' }).select().single();
  if (error) throw error;
  return data;
}