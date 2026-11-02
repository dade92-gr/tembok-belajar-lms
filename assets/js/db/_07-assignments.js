// assets/js/db/_07-assignments.js
// Penugasan guru (teacher_assign)

async function getTeacherAssignments(schoolId) {
  return cache.fetch(`assignments_all_${schoolId || 'all'}`, async () => {
    const client = initSupabase();
    let q = client.from('teacher_assign').select(`
      id, created_at, teacher_id, subject_id, class_id,
      profiles!teacher_assign_teacher_id_fkey (id, name, email),
      subjects (id, name, code),
      classes (id, name, grade)
    `).order('created_at', { ascending: false });
    if (schoolId) q = q.eq('school_id', schoolId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }, { ttl: 24 * 60 * 60 * 1000 });
}

async function createTeacherAssignment({ teacherId, subjectId, classId, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client.from('teacher_assign')
    .insert([{ teacher_id: teacherId, subject_id: subjectId, class_id: classId, school_id: schoolId }])
    .select().single();
  if (error) throw error;
  cache.clearByPrefix('assignments_');
  return data;
}

async function deleteTeacherAssignment(id) {
  const client = initSupabase();
  const { error } = await client.from('teacher_assign').delete().eq('id', id);
  if (error) throw error;
  cache.clearByPrefix('assignments_');
}

async function isAssignmentDuplicate(teacherId, subjectId, classId) {
  const client = initSupabase();
  const { count, error } = await client.from('teacher_assign')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId).eq('subject_id', subjectId).eq('class_id', classId);
  if (error) throw error;
  return count > 0;
}

async function getMyTeachingAssignments(teacherId, forceRefresh = false) {
  return cache.fetch(`my_assignments_${teacherId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('teacher_assign')
      .select(`id, subject_id, class_id, school_id, created_at, subjects (id, name, code), classes (id, name, grade, room)`)
      .eq('teacher_id', teacherId);
    if (error) throw error;
    return data || [];
  }, { ttl: 24 * 60 * 60 * 1000, forceRefresh });
}