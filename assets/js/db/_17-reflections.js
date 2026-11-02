// assets/js/db/_17-reflections.js
// Reflections (refleksi siswa)

async function getReflectionsByActivity(activityId) {
  const client = initSupabase();
  const { data, error } = await client.from('reflections').select(`
    id, activity_id, student_id, answers, submitted_at, created_at,
    profiles!reflections_student_id_fkey (id, name, email)
  `).eq('activity_id', activityId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getReflectionByStudent(activityId, studentId) {
  const client = initSupabase();
  const { data, error } = await client.from('reflections')
    .select('*').eq('activity_id', activityId).eq('student_id', studentId).maybeSingle();
  if (error) throw error;
  return data;
}

async function submitReflection({ activityId, studentId, answers }) {
  const client = initSupabase();
  const { data, error } = await client.from('reflections')
    .upsert([{
      activity_id: activityId, student_id: studentId,
      answers, submitted_at: new Date().toISOString()
    }], { onConflict: 'activity_id,student_id' }).select().single();
  if (error) throw error;
  return data;
}

async function deleteReflection(id) {
  const client = initSupabase();
  const { error } = await client.from('reflections').delete().eq('id', id);
  if (error) throw error;
}