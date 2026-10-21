// ============================================
// SUPABASE CLIENT & HELPER — TEMBOK BELAJAR
// ============================================

let supabaseClient = null;

function initSupabase() {
  if (supabaseClient) return supabaseClient;
  if (typeof supabase === 'undefined') {
    console.error('Supabase library belum dimuat! Pastikan CDN ada di HTML.');
    return null;
  }
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

async function getProfile() {
  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) {
    console.error('getProfile error:', error);
    return null;
  }
  return data;
}

async function doLogout() {
  const client = initSupabase();
  await client.auth.signOut();
  sessionStorage.clear();
  window.location.href = '../login.html';
}

function redirectByRole(role) {
  const base = window.location.pathname.includes('/operator/')
    || window.location.pathname.includes('/guru/')
    || window.location.pathname.includes('/siswa/')
    ? '../' : '';
  if (role === 'operator') window.location.href = base + 'operator/dashboard.html';
  else if (role === 'guru') window.location.href = base + 'guru/dashboard.html';
  else if (role === 'siswa') window.location.href = base + 'siswa/dashboard.html';
  else window.location.href = base + 'login.html';
}

async function requireAuth(expectedRole) {
  const profile = await getProfile();
  if (!profile) {
    alert('Silakan login terlebih dahulu.');
    window.location.href = '../login.html';
    return null;
  }
  if (expectedRole && profile.role !== expectedRole) {
    alert('Anda tidak punya akses ke halaman ini.');
    redirectByRole(profile.role);
    return null;
  }
  return profile;
}

/* ============================================================
   SEKOLAH (SCHOOLS)
   ============================================================ */

async function getSchool(schoolId) {
  const client = initSupabase();
  const { data, error } = await client
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .single();
  if (error) throw error;
  return data;
}

/* ============================================================
   CRUD MAPEL (SUBJECTS)
   ============================================================ */

async function getSubjects(schoolId) {
  const client = initSupabase();
  let query = client.from('subjects').select('*').order('name', { ascending: true });
  if (schoolId) query = query.eq('school_id', schoolId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function createSubject({ name, code, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client
    .from('subjects')
    .insert([{ name, code, school_id: schoolId }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateSubject(id, { name, code }) {
  const client = initSupabase();
  const { data, error } = await client
    .from('subjects')
    .update({ name, code })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function isSubjectUsed(subjectId) {
  const client = initSupabase();
  const { count: assignCount, error: err1 } = await client
    .from('teacher_assign')
    .select('*', { count: 'exact', head: true })
    .eq('subject_id', subjectId);
  if (err1) throw err1;
  if (assignCount > 0) return { used: true, by: 'penugasan guru', count: assignCount };
  return { used: false };
}

async function deleteSubject(id) {
  const client = initSupabase();
  const { error } = await client.from('subjects').delete().eq('id', id);
  if (error) throw error;
}

/* ============================================================
   CRUD KELAS (CLASSES)
   ============================================================ */

async function getClasses(schoolId) {
  const client = initSupabase();
  let query = client.from('classes').select('*').order('name', { ascending: true });
  if (schoolId) query = query.eq('school_id', schoolId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function createClass({ name, grade, room, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client
    .from('classes')
    .insert([{ name, grade, room, school_id: schoolId }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateClass(id, { name, grade, room }) {
  const client = initSupabase();
  const { data, error } = await client
    .from('classes')
    .update({ name, grade, room })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function isClassUsed(classId) {
  const client = initSupabase();

  const { count: assignCount, error: err1 } = await client
    .from('teacher_assign')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId);
  if (err1) throw err1;
  if (assignCount > 0) return { used: true, by: 'penugasan guru', count: assignCount };

  const { count: enrollCount, error: err2 } = await client
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId);
  if (err2) throw err2;
  if (enrollCount > 0) return { used: true, by: 'enrollment siswa', count: enrollCount };

  return { used: false };
}

async function deleteClass(id) {
  const client = initSupabase();
  const { error } = await client.from('classes').delete().eq('id', id);
  if (error) throw error;
}

/* ============================================================
   CRUD GURU (PROFILES role=guru)
   ============================================================ */

async function getTeachers(schoolId) {
  const client = initSupabase();
  let query = client
    .from('profiles')
    .select('*')
    .eq('role', 'guru')
    .order('name', { ascending: true });
  if (schoolId) query = query.eq('school_id', schoolId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function updateTeacher(id, { name, email }) {
  const client = initSupabase();
  const { data, error } = await client
    .from('profiles')
    .update({ name, email })
    .eq('id', id)
    .eq('role', 'guru')
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function isTeacherUsed(teacherId) {
  const client = initSupabase();
  const { count, error } = await client
    .from('teacher_assign')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId);
  if (error) throw error;
  if (count > 0) return { used: true, by: 'penugasan guru', count };
  return { used: false };
}

async function deleteTeacher(id) {
  const client = initSupabase();
  const { error } = await client
    .from('profiles')
    .delete()
    .eq('id', id)
    .eq('role', 'guru');
  if (error) throw error;
}

/* ============================================================
   CRUD SISWA (PROFILES role=siswa)
   ============================================================ */

async function getStudents(schoolId) {
  const client = initSupabase();
  let query = client
    .from('profiles')
    .select('*')
    .eq('role', 'siswa')
    .order('name', { ascending: true });
  if (schoolId) query = query.eq('school_id', schoolId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function updateStudent(id, { name, email }) {
  const client = initSupabase();
  const { data, error } = await client
    .from('profiles')
    .update({ name, email })
    .eq('id', id)
    .eq('role', 'siswa')
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function isStudentUsed(studentId) {
  const client = initSupabase();
  const { count, error } = await client
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId);
  if (error) throw error;
  if (count > 0) return { used: true, by: 'enrollment kelas', count };
  return { used: false };
}

/* ============================================================
   PENUGASAN GURU (TEACHER_ASSIGN)
   ============================================================ */

async function getTeacherAssignments(schoolId) {
  const client = initSupabase();
  let query = client
    .from('teacher_assign')
    .select(`
      id,
      created_at,
      teacher_id,
      subject_id,
      class_id,
      profiles!teacher_assign_teacher_id_fkey (id, name, email),
      subjects (id, name, code),
      classes (id, name, grade)
    `)
    .order('created_at', { ascending: false });
  if (schoolId) query = query.eq('school_id', schoolId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function createTeacherAssignment({ teacherId, subjectId, classId, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client
    .from('teacher_assign')
    .insert([{
      teacher_id: teacherId,
      subject_id: subjectId,
      class_id: classId,
      school_id: schoolId
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteTeacherAssignment(id) {
  const client = initSupabase();
  const { error } = await client.from('teacher_assign').delete().eq('id', id);
  if (error) throw error;
}

async function isAssignmentDuplicate(teacherId, subjectId, classId) {
  const client = initSupabase();
  const { count, error } = await client
    .from('teacher_assign')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('subject_id', subjectId)
    .eq('class_id', classId);
  if (error) throw error;
  return count > 0;
}

/* ============================================================
   ENROLLMENT SISWA (ENROLLMENTS)
   ============================================================ */

async function getEnrollments(schoolId) {
  const client = initSupabase();
  let query = client
    .from('enrollments')
    .select(`
      id,
      status,
      enrolled_at,
      student_id,
      class_id,
      profiles!enrollments_student_id_fkey (id, name, email),
      classes (id, name, grade)
    `)
    .order('enrolled_at', { ascending: false });
  if (schoolId) query = query.eq('school_id', schoolId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function createEnrollment({ studentId, classId, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client
    .from('enrollments')
    .insert([{
      student_id: studentId,
      class_id: classId,
      school_id: schoolId,
      status: 'active'
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteEnrollment(id) {
  const client = initSupabase();
  const { error } = await client.from('enrollments').delete().eq('id', id);
  if (error) throw error;
}

async function isEnrollmentDuplicate(studentId, classId) {
  const client = initSupabase();
  const { count, error } = await client
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('class_id', classId);
  if (error) throw error;
  return count > 0;
}

async function getStudentClasses(studentId) {
  const client = initSupabase();
  const { data, error } = await client
    .from('enrollments')
    .select(`
      id,
      classes (id, name, grade, room)
    `)
    .eq('student_id', studentId)
    .eq('status', 'active');
  if (error) throw error;
  return data || [];
}

async function getClassSubjects(classId) {
  const client = initSupabase();
  const { data, error } = await client
    .from('teacher_assign')
    .select(`
      id,
      subjects (id, name, code),
      profiles!teacher_assign_teacher_id_fkey (id, name)
    `)
    .eq('class_id', classId);
  if (error) throw error;
  return data || [];
}