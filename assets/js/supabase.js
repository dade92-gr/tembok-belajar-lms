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

/* Ambil semua guru di sekolah user */
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

/* Buat profil guru baru (user Auth harus dibuat manual di Supabase) */
async function createTeacher({ id, email, name, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client
    .from('profiles')
    .insert([{
      id,
      email,
      name,
      role: 'guru',
      school_id: schoolId,
      status: 'active'
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* Update profil guru (name, email — id & role tidak diubah) */
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

/* Cek apakah guru dipakai (di teacher_assign) */
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

/* Hapus profil guru — user Auth tetap ada, harus dihapus manual di Supabase */
async function deleteTeacher(id) {
  const client = initSupabase();
  const { error } = await client
    .from('profiles')
    .delete()
    .eq('id', id)
    .eq('role', 'guru');
  if (error) throw error;
}