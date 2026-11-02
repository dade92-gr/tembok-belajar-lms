// assets/js/db/_05-classes.js

async function getClasses(schoolId) {
  return cache.fetch(`classes_${schoolId || 'all'}`, async () => {
    const client = initSupabase();
    let q = client.from('classes').select('*').order('name', { ascending: true });
    if (schoolId) q = q.eq('school_id', schoolId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }, { ttl: 24 * 60 * 60 * 1000 });
}

async function createClass({ name, grade, room, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client.from('classes')
    .insert([{ name, grade, room, school_id: schoolId }]).select().single();
  if (error) throw error;
  cache.clearByPrefix('classes_');
  return data;
}

async function updateClass(id, { name, grade, room }) {
  const client = initSupabase();
  const { data, error } = await client.from('classes')
    .update({ name, grade, room }).eq('id', id).select().single();
  if (error) throw error;
  cache.clearByPrefix('classes_');
  return data;
}

async function isClassUsed(classId) {
  const client = initSupabase();
  const { count: ac, error: e1 } = await client.from('teacher_assign')
    .select('*', { count: 'exact', head: true }).eq('class_id', classId);
  if (e1) throw e1;
  if (ac > 0) return { used: true, by: 'penugasan guru', count: ac };
  const { count: ec, error: e2 } = await client.from('enrollments')
    .select('*', { count: 'exact', head: true }).eq('class_id', classId);
  if (e2) throw e2;
  if (ec > 0) return { used: true, by: 'enrollment siswa', count: ec };
  return { used: false };
}

async function deleteClass(id) {
  const client = initSupabase();
  const { error } = await client.from('classes').delete().eq('id', id);
  if (error) throw error;
  cache.clearByPrefix('classes_');
  cache.clearByPrefix('assignments_');
}