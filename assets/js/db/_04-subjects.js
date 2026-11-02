// assets/js/db/_04-subjects.js

async function getSubjects(schoolId) {
  return cache.fetch(`subjects_${schoolId || 'all'}`, async () => {
    const client = initSupabase();
    let q = client.from('subjects').select('*').order('name', { ascending: true });
    if (schoolId) q = q.eq('school_id', schoolId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }, { ttl: 24 * 60 * 60 * 1000 });
}

async function createSubject({ name, code, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client.from('subjects')
    .insert([{ name, code, school_id: schoolId }]).select().single();
  if (error) throw error;
  cache.clearByPrefix('subjects_');
  return data;
}

async function updateSubject(id, { name, code }) {
  const client = initSupabase();
  const { data, error } = await client.from('subjects')
    .update({ name, code }).eq('id', id).select().single();
  if (error) throw error;
  cache.clearByPrefix('subjects_');
  return data;
}

async function isSubjectUsed(subjectId) {
  const client = initSupabase();
  const { count, error } = await client.from('teacher_assign')
    .select('*', { count: 'exact', head: true }).eq('subject_id', subjectId);
  if (error) throw error;
  if (count > 0) return { used: true, by: 'penugasan guru', count };
  return { used: false };
}

async function deleteSubject(id) {
  const client = initSupabase();
  const { error } = await client.from('subjects').delete().eq('id', id);
  if (error) throw error;
  cache.clearByPrefix('subjects_');
}