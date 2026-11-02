// assets/js/db/_06-profiles.js
// Guru, Siswa, Wali Kelas (profiles management)

async function getTeachers(schoolId) {
  return cache.fetch(`teachers_${schoolId || 'all'}`, async () => {
    const client = initSupabase();
    let roleQuery = client.from('user_roles')
      .select('user_id')
      .eq('role', 'guru').eq('status', 'active');
    if (schoolId) roleQuery = roleQuery.eq('school_id', schoolId);
    const { data: roleRows, error: roleErr } = await roleQuery;
    if (roleErr) throw roleErr;

    const roleUserIds = new Set((roleRows || []).map(r => r.user_id));

    let profQuery = client.from('profiles').select('*').eq('role', 'guru');
    if (schoolId) profQuery = profQuery.eq('school_id', schoolId);
    const { data: legacyProfiles, error: profErr } = await profQuery;
    if (profErr) throw profErr;

    const legacyIds = new Set((legacyProfiles || []).map(p => p.id));
    const missingIds = [...roleUserIds].filter(id => !legacyIds.has(id));

    let extraProfiles = [];
    if (missingIds.length > 0) {
      const { data: extra, error: e2 } = await client
        .from('profiles').select('*').in('id', missingIds);
      if (e2) throw e2;
      extraProfiles = extra || [];
    }

    const all = [...(legacyProfiles || []), ...extraProfiles];
    const map = new Map();
    all.forEach(p => map.set(p.id, p));
    return [...map.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, { ttl: 24 * 60 * 60 * 1000 });
}

async function updateTeacher(id, { name, email }) {
  const client = initSupabase();
  const { data, error } = await client.from('profiles')
    .update({ name, email }).eq('id', id).select().single();
  if (error) throw error;
  cache.clearByPrefix('teachers_');
  return data;
}

async function isTeacherUsed(teacherId) {
  const client = initSupabase();
  const { count, error } = await client.from('teacher_assign')
    .select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId);
  if (error) throw error;
  if (count > 0) return { used: true, by: 'penugasan guru', count };
  return { used: false };
}

async function deleteTeacher(id) {
  const client = initSupabase();
  const { error } = await client.from('profiles')
    .delete().eq('id', id).eq('role', 'guru');
  if (error) throw error;
  cache.clearByPrefix('teachers_');
}

async function getStudents(schoolId) {
  return cache.fetch(`students_${schoolId || 'all'}`, async () => {
    const client = initSupabase();
    let roleQuery = client.from('user_roles')
      .select('user_id')
      .eq('role', 'siswa').eq('status', 'active');
    if (schoolId) roleQuery = roleQuery.eq('school_id', schoolId);
    const { data: roleRows, error: roleErr } = await roleQuery;
    if (roleErr) throw roleErr;

    const roleUserIds = new Set((roleRows || []).map(r => r.user_id));

    let profQuery = client.from('profiles').select('*').eq('role', 'siswa');
    if (schoolId) profQuery = profQuery.eq('school_id', schoolId);
    const { data: legacyProfiles, error: profErr } = await profQuery;
    if (profErr) throw profErr;

    const legacyIds = new Set((legacyProfiles || []).map(p => p.id));
    const missingIds = [...roleUserIds].filter(id => !legacyIds.has(id));

    let extraProfiles = [];
    if (missingIds.length > 0) {
      const { data: extra, error: e2 } = await client
        .from('profiles').select('*').in('id', missingIds);
      if (e2) throw e2;
      extraProfiles = extra || [];
    }

    const all = [...(legacyProfiles || []), ...extraProfiles];
    const map = new Map();
    all.forEach(p => map.set(p.id, p));
    return [...map.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, { ttl: 24 * 60 * 60 * 1000 });
}

async function updateStudent(id, { name, email }) {
  const client = initSupabase();
  const { data, error } = await client.from('profiles')
    .update({ name, email }).eq('id', id).select().single();
  if (error) throw error;
  cache.clearByPrefix('students_');
  return data;
}

async function isStudentUsed(studentId) {
  const client = initSupabase();
  const { count, error } = await client.from('enrollments')
    .select('*', { count: 'exact', head: true }).eq('student_id', studentId);
  if (error) throw error;
  if (count > 0) return { used: true, by: 'enrollment kelas', count };
  return { used: false };
}