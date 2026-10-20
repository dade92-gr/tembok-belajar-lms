// ============================================
// SUPABASE CLIENT & HELPER — TEMBOK BELAJAR
// ============================================

let supabaseClient = null;

/* Inisialisasi client Supabase (sekali saja) */
function initSupabase() {
  if (supabaseClient) return supabaseClient;
  if (typeof supabase === 'undefined') {
    console.error('Supabase library belum dimuat! Pastikan CDN ada di HTML.');
    return null;
  }
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

/* Ambil profil user yang sedang login */
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

/* Logout & redirect ke halaman login */
async function doLogout() {
  const client = initSupabase();
  await client.auth.signOut();
  sessionStorage.clear();
  window.location.href = '../login.html';
}

/* Redirect ke dashboard sesuai role */
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

/* Proteksi halaman: harus login & role sesuai */
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

/* Ambil semua mapel di sekolah user */
async function getSubjects(schoolId) {
  const client = initSupabase();
  let query = client.from('subjects').select('*').order('name', { ascending: true });
  if (schoolId) query = query.eq('school_id', schoolId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/* Buat mapel baru */
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

/* Update mapel */
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

/* Cek apakah mapel dipakai (di teacher_assign atau classes) */
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

/* Hapus mapel (hanya jika tidak dipakai) */
async function deleteSubject(id) {
  const client = initSupabase();
  const { error } = await client.from('subjects').delete().eq('id', id);
  if (error) throw error;
}