// ============================================
// SUPABASE CLIENT & HELPER — TEMBOK BELAJAR
// ============================================

let supabaseClient = null;

function initSupabase() {
  if (supabaseClient) return supabaseClient;
  if (typeof supabase === 'undefined') {
    console.error('Supabase library belum dimuat!');
    return null;
  }
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

// ============================================
// AUTH — Multi-Role Support
// ============================================

/**
 * Ambil semua role user dari user_roles
 * Return: array of { role, school_id, status, school_name }
 */
async function getUserRoles(userId) {
  const client = initSupabase();
  const { data, error } = await client
    .from('user_roles')
    .select(`
      id, role, school_id, status,
      schools (id, name)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('role', { ascending: true });

  if (error) {
    console.error('getUserRoles error:', error);
    return [];
  }

  return (data || []).map(r => ({
    id: r.id,
    role: r.role,
    school_id: r.school_id,
    status: r.status,
    school_name: r.schools?.name || null
  }));
}

/**
 * Ambil profil user + semua role + role aktif
 * Role aktif: dari sessionStorage['active_role'] (kalau valid) 
 *            atau role pertama dari user_roles
 * Properti `role` dan `school_id` di-override sesuai active role
 * → kode lama yang pakai `profile.role` TETAP JALAN
 */
async function getProfile() {
  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  // Ambil profil dasar
  const { data: profile, error } = await client
    .from('profiles').select('*').eq('id', user.id).single();
  if (error) { console.error('getProfile error:', error); return null; }

  // Ambil semua role dari user_roles
  const roles = await getUserRoles(user.id);

  // Tentukan role aktif
  let activeRole = null;
  try {
    const stored = sessionStorage.getItem('active_role');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && roles.find(r =>
        r.role === parsed.role &&
        String(r.school_id) === String(parsed.school_id)
      )) {
        activeRole = parsed;
      }
    }
  } catch (e) { /* ignore */ }

  if (!activeRole && roles.length > 0) {
    activeRole = { role: roles[0].role, school_id: roles[0].school_id };
  }

  // Fallback ke profiles.role kalau user_roles kosong (data lama belum migrasi)
  if (roles.length === 0 && profile.role) {
    activeRole = { role: profile.role, school_id: profile.school_id };
  }

  return {
    ...profile,
    roles: roles.length > 0 ? roles : [{ role: profile.role, school_id: profile.school_id }],
    activeRole,
    // Override `role` dan `school_id` sesuai role aktif
    role: activeRole?.role || profile.role,
    school_id: activeRole?.school_id ?? profile.school_id
  };
}

async function doLogout() {
  const client = initSupabase();
  await client.auth.signOut();
  sessionStorage.clear(); // include active_role
  window.location.href = '../login.html';
}

/**
 * Redirect user berdasarkan role
 * Kalau >1 role → tampil modal pilih role
 * Kalau 1 role → redirect langsung
 */
function redirectByRole(roleOrProfile) {
  const profile = typeof roleOrProfile === 'string'
    ? { role: roleOrProfile, roles: [{ role: roleOrProfile, school_id: null, school_name: null }] }
    : roleOrProfile;

  const base = window.location.pathname.includes('/operator/')
    || window.location.pathname.includes('/guru/')
    || window.location.pathname.includes('/siswa/')
    || window.location.pathname.includes('/admin/')
    ? '../' : '';

  // Kalau user punya >1 role → tampil modal
  if (profile.roles && profile.roles.length > 1) {
    showRolePicker(profile.roles, base);
    return;
  }

  const role = profile.role;
  if (role === 'admin') window.location.href = base + 'admin/dashboard.html';
  else if (role === 'operator') window.location.href = base + 'operator/dashboard.html';
  else if (role === 'guru') window.location.href = base + 'guru/dashboard.html';
  else if (role === 'siswa') window.location.href = base + 'siswa/dashboard.html';
  else window.location.href = base + 'login.html';
}

/**
 * Modal pilih role (muncul kalau user punya >1 role)
 */
function showRolePicker(roles, base) {
  const old = document.getElementById('rolePickerModal');
  if (old) old.remove();

  const roleLabels = {
    admin: { label: 'Super Admin', icon: 'fa-crown', color: '#8b5cf6', desc: 'Kelola semua sekolah' },
    operator: { label: 'Operator', icon: 'fa-user-shield', color: '#3b82f6', desc: 'Kelola guru, siswa, kelas, mapel' },
    guru: { label: 'Guru', icon: 'fa-chalkboard-teacher', color: '#10b981', desc: 'Kelola materi, aktivitas, nilai' },
    siswa: { label: 'Siswa', icon: 'fa-user-graduate', color: '#f59e0b', desc: 'Belajar, kerjakan tugas, lihat nilai' }
  };

  const modal = document.createElement('div');
  modal.id = 'rolePickerModal';
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(15,23,42,0.85);
    display: flex; align-items: center; justify-content: center;
    padding: 1rem; backdrop-filter: blur(4px);
    font-family: 'Inter', -apple-system, sans-serif;
  `;

  const cards = roles.map(r => {
    const info = roleLabels[r.role] || { label: r.role, icon: 'fa-user', color: '#64748b', desc: '' };
    return `
      <div class="role-card" data-role="${r.role}" data-school="${r.school_id || ''}"
           style="
             background: white; border-radius: 12px; padding: 1.5rem 1.2rem;
             cursor: pointer; transition: all 0.2s;
             border: 2px solid transparent; text-align: center;
           "
           onmouseover="this.style.borderColor='${info.color}'; this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.1)'"
           onmouseout="this.style.borderColor='transparent'; this.style.transform='none'; this.style.boxShadow='none'"
      >
        <div style="
          width: 60px; height: 60px; border-radius: 16px;
          background: ${info.color}20; color: ${info.color};
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 0.8rem; font-size: 1.8rem;
        ">
          <i class="fas ${info.icon}"></i>
        </div>
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.3rem; font-size: 0.95rem;">
          ${info.label}
        </div>
        <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 0.5rem; line-height: 1.4;">
          ${info.desc}
        </div>
        ${r.school_name ? `<div style="
          font-size: 0.7rem; color: ${info.color}; font-weight: 600;
          padding: 3px 10px; background: ${info.color}15; border-radius: 8px;
          display: inline-block;
        "><i class="fas fa-school"></i> ${r.school_name}</div>` : '<div style="height: 22px;"></div>'}
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div style="
      background: #f8fafc; border-radius: 20px; padding: 2rem;
      max-width: 720px; width: 100%; max-height: 90vh; overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    ">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="
          width: 60px; height: 60px; border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          color: white; display: inline-flex; align-items: center; justify-content: center;
          font-size: 1.5rem; margin-bottom: 0.8rem;
        ">
          <i class="fas fa-users"></i>
        </div>
        <h2 style="font-size: 1.3rem; color: #0f172a; margin-bottom: 0.3rem; font-weight: 800;">
          Pilih Peran
        </h2>
        <p style="font-size: 0.85rem; color: #64748b; margin: 0;">
          Anda punya akses ke beberapa panel. Pilih salah satu untuk melanjutkan.
        </p>
      </div>
      <div style="
        display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 0.8rem;
      ">
        ${cards}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll('.role-card').forEach(card => {
    card.addEventListener('click', () => {
      const role = card.dataset.role;
      const schoolId = card.dataset.school ? parseInt(card.dataset.school) : null;

      sessionStorage.setItem('active_role', JSON.stringify({ role, school_id: schoolId }));

      if (role === 'admin') window.location.href = base + 'admin/dashboard.html';
      else if (role === 'operator') window.location.href = base + 'operator/dashboard.html';
      else if (role === 'guru') window.location.href = base + 'guru/dashboard.html';
      else if (role === 'siswa') window.location.href = base + 'siswa/dashboard.html';
    });
  });
}

/**
 * Cek auth + role
 * Kalau user punya role yang diharapkan (di user_roles), tapi bukan active role
 * → otomatis set active role ke role yang match
 */
async function requireAuth(expectedRole) {
  const profile = await getProfile();
  if (!profile) {
    alert('Silakan login terlebih dahulu.');
    window.location.href = '../login.html';
    return null;
  }

  // Cek apakah user punya role yang diharapkan
  const hasRole = profile.roles && profile.roles.some(r => r.role === expectedRole);

  if (expectedRole && !hasRole) {
    alert('Anda tidak punya akses ke halaman ini.');
    redirectByRole(profile);
    return null;
  }

  // Kalau punya role tapi bukan active → set active
  if (expectedRole && profile.role !== expectedRole) {
    const matchingRole = profile.roles.find(r => r.role === expectedRole);
    if (matchingRole) {
      sessionStorage.setItem('active_role', JSON.stringify({
        role: matchingRole.role,
        school_id: matchingRole.school_id
      }));
      profile.role = matchingRole.role;
      profile.school_id = matchingRole.school_id;
      profile.activeRole = matchingRole;
    }
  }

  return profile;
}

/**
 * Ganti role aktif (dipanggil dari tombol "Ganti Peran" di topbar)
 * Hapus active_role → tampil modal picker
 */
async function switchRole() {
  const profile = await getProfile();
  if (!profile || !profile.roles || profile.roles.length <= 1) {
    alert('Anda hanya punya 1 role.');
    return;
  }
  sessionStorage.removeItem('active_role');
  redirectByRole(profile);
}

/* ============================================================
   SEKOLAH
   ============================================================ */
async function getSchool(schoolId) {
  const client = initSupabase();
  const { data, error } = await client
    .from('schools').select('*').eq('id', schoolId).single();
  if (error) throw error;
  return data;
}

/* ============================================================
   MAPEL
   ============================================================ */
async function getSubjects(schoolId) {
  const client = initSupabase();
  let q = client.from('subjects').select('*').order('name', { ascending: true });
  if (schoolId) q = q.eq('school_id', schoolId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function createSubject({ name, code, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client.from('subjects')
    .insert([{ name, code, school_id: schoolId }]).select().single();
  if (error) throw error;
  return data;
}

async function updateSubject(id, { name, code }) {
  const client = initSupabase();
  const { data, error } = await client.from('subjects')
    .update({ name, code }).eq('id', id).select().single();
  if (error) throw error;
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
}

/* ============================================================
   KELAS
   ============================================================ */
async function getClasses(schoolId) {
  const client = initSupabase();
  let q = client.from('classes').select('*').order('name', { ascending: true });
  if (schoolId) q = q.eq('school_id', schoolId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function createClass({ name, grade, room, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client.from('classes')
    .insert([{ name, grade, room, school_id: schoolId }]).select().single();
  if (error) throw error;
  return data;
}

async function updateClass(id, { name, grade, room }) {
  const client = initSupabase();
  const { data, error } = await client.from('classes')
    .update({ name, grade, room }).eq('id', id).select().single();
  if (error) throw error;
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
}

/* ============================================================
   GURU — Multi-Role Aware (PATCHED)
   ============================================================
   Sumber guru = gabungan:
   1) user_roles.role = 'guru' (multi-role, data baru)
   2) profiles.role = 'guru'  (legacy, data lama)
   → guru lama tidak hilang, guru baru (via create-teacher multi-role) muncul
   ============================================================ */
async function getTeachers(schoolId) {
  const client = initSupabase();

  // 1) Dari user_roles (multi-role)
  let roleQuery = client
    .from('user_roles')
    .select('user_id')
    .eq('role', 'guru')
    .eq('status', 'active');
  if (schoolId) roleQuery = roleQuery.eq('school_id', schoolId);

  const { data: roleRows, error: roleErr } = await roleQuery;
  if (roleErr) throw roleErr;

  const roleUserIds = new Set((roleRows || []).map(r => r.user_id));

  // 2) Dari profiles.role (legacy)
  let profQuery = client.from('profiles').select('*').eq('role', 'guru');
  if (schoolId) profQuery = profQuery.eq('school_id', schoolId);
  const { data: legacyProfiles, error: profErr } = await profQuery;
  if (profErr) throw profErr;

  const legacyIds = new Set((legacyProfiles || []).map(p => p.id));

  // 3) Ambil profil user dari user_roles yang belum ada di legacyProfiles
  const missingIds = [...roleUserIds].filter(id => !legacyIds.has(id));
  let extraProfiles = [];
  if (missingIds.length > 0) {
    const { data: extra, error: e2 } = await client
      .from('profiles')
      .select('*')
      .in('id', missingIds);
    if (e2) throw e2;
    extraProfiles = extra || [];
  }

  // 4) Gabung + dedupe by id + urut nama
  const all = [...(legacyProfiles || []), ...extraProfiles];
  const map = new Map();
  all.forEach(p => map.set(p.id, p));
  return [...map.values()].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );
}

async function updateTeacher(id, { name, email }) {
  const client = initSupabase();
  const { data, error } = await client.from('profiles')
    .update({ name, email }).eq('id', id).select().single();
  if (error) throw error;
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
}

/* ============================================================
   SISWA
   ============================================================ */
async function getStudents(schoolId) {
  const client = initSupabase();
  let q = client.from('profiles').select('*').eq('role', 'siswa').order('name', { ascending: true });
  if (schoolId) q = q.eq('school_id', schoolId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function updateStudent(id, { name, email }) {
  const client = initSupabase();
  const { data, error } = await client.from('profiles')
    .update({ name, email }).eq('id', id).eq('role', 'siswa').select().single();
  if (error) throw error;
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

/* ============================================================
   PENUGASAN GURU
   ============================================================ */
async function getTeacherAssignments(schoolId) {
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
}

async function createTeacherAssignment({ teacherId, subjectId, classId, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client.from('teacher_assign')
    .insert([{ teacher_id: teacherId, subject_id: subjectId, class_id: classId, school_id: schoolId }])
    .select().single();
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
  const { count, error } = await client.from('teacher_assign')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId).eq('subject_id', subjectId).eq('class_id', classId);
  if (error) throw error;
  return count > 0;
}

/* ============================================================
   ENROLLMENT
   ============================================================ */
async function getEnrollments(schoolId) {
  const client = initSupabase();
  let q = client.from('enrollments').select(`
    id, status, enrolled_at, student_id, class_id,
    profiles!enrollments_student_id_fkey (id, name, email),
    classes (id, name, grade)
  `).order('enrolled_at', { ascending: false });
  if (schoolId) q = q.eq('school_id', schoolId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function createEnrollment({ studentId, classId, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client.from('enrollments')
    .insert([{ student_id: studentId, class_id: classId, school_id: schoolId, status: 'active' }])
    .select().single();
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
  const { count, error } = await client.from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId).eq('class_id', classId);
  if (error) throw error;
  return count > 0;
}

async function getStudentClasses(studentId) {
  const client = initSupabase();
  const { data, error } = await client.from('enrollments')
    .select(`id, classes (id, name, grade, room)`)
    .eq('student_id', studentId).eq('status', 'active');
  if (error) throw error;
  return data || [];
}

async function getClassSubjects(classId) {
  const client = initSupabase();
  const { data, error } = await client.from('teacher_assign')
    .select(`id, subjects (id, name, code), profiles!teacher_assign_teacher_id_fkey (id, name)`)
    .eq('class_id', classId);
  if (error) throw error;
  return data || [];
}

/* ============================================================
   GURU: MAPEL & KELAS
   ============================================================ */
async function getMyTeachingAssignments(teacherId) {
  const client = initSupabase();
  const { data, error } = await client.from('teacher_assign')
    .select(`id, subjects (id, name, code), classes (id, name, grade, room)`)
    .eq('teacher_id', teacherId);
  if (error) throw error;
  return data || [];
}

async function getClassStudentCounts(classIds) {
  if (!classIds || classIds.length === 0) return {};
  const client = initSupabase();
  const { data, error } = await client.from('enrollments')
    .select('class_id').in('class_id', classIds).eq('status', 'active');
  if (error) throw error;
  const counts = {};
  (data || []).forEach(row => {
    counts[row.class_id] = (counts[row.class_id] || 0) + 1;
  });
  return counts;
}

async function getStudentsInClass(classId) {
  const client = initSupabase();
  const { data, error } = await client.from('enrollments')
    .select(`id, student_id, status, profiles!enrollments_student_id_fkey (id, name, email)`)
    .eq('class_id', classId).eq('status', 'active');
  if (error) throw error;
  return data || [];
}

/* ============================================================
   PAGES & BLOCKS
   ============================================================ */
async function getPages(classId, subjectId) {
  const client = initSupabase();
  const { data, error } = await client.from('pages')
    .select('*').eq('class_id', classId).eq('subject_id', subjectId)
    .order('page_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function createPage({ classId, subjectId, title, authorId, theme }) {
  const client = initSupabase();
  const { data: existing } = await client.from('pages')
    .select('page_order').eq('class_id', classId).eq('subject_id', subjectId)
    .order('page_order', { ascending: false }).limit(1);
  const nextOrder = (existing && existing[0] ? existing[0].page_order : 0) + 1;

  const { data, error } = await client.from('pages')
    .insert([{
      class_id: classId, subject_id: subjectId, title,
      author_id: authorId, status: 'published',
      page_order: nextOrder, theme: theme || {}
    }]).select().single();
  if (error) throw error;
  return data;
}

async function updatePage(id, { title, status }) {
  const client = initSupabase();
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (status !== undefined) updates.status = status;
  updates.updated_at = new Date().toISOString();
  const { data, error } = await client.from('pages')
    .update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deletePage(id) {
  const client = initSupabase();
  const { error } = await client.from('pages').delete().eq('id', id);
  if (error) throw error;
}

async function getBlocks(pageId) {
  const client = initSupabase();
  const { data, error } = await client.from('blocks')
    .select('*').eq('page_id', pageId).order('block_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function createBlock({ pageId, type, data, order }) {
  const client = initSupabase();
  const { data: created, error } = await client.from('blocks')
    .insert([{ page_id: pageId, type, data: data || {}, block_order: order || 0 }])
    .select().single();
  if (error) throw error;
  return created;
}

async function updateBlock(id, { type, data, order }) {
  const client = initSupabase();
  const updates = {};
  if (type !== undefined) updates.type = type;
  if (data !== undefined) updates.data = data;
  if (order !== undefined) updates.block_order = order;
  const { data: updated, error } = await client.from('blocks')
    .update(updates).eq('id', id).select().single();
  if (error) throw error;
  return updated;
}

async function deleteBlock(id) {
  const client = initSupabase();
  const { error } = await client.from('blocks').delete().eq('id', id);
  if (error) throw error;
}

/* ============================================================
   AKTIVITAS
   ============================================================ */
async function getActivities(classId, subjectId) {
  const client = initSupabase();
  const { data, error } = await client.from('activities')
    .select('*').eq('class_id', classId).eq('subject_id', subjectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createActivity({ classId, subjectId, type, title, description, deadline, maxScore, authorId }) {
  const client = initSupabase();
  const { data, error } = await client.from('activities')
    .insert([{
      class_id: classId, subject_id: subjectId, type, title,
      description, deadline, max_score: maxScore || 100, author_id: authorId
    }]).select().single();
  if (error) throw error;
  return data;
}

async function deleteActivity(id) {
  const client = initSupabase();
  const { error } = await client.from('activities').delete().eq('id', id);
  if (error) throw error;
}

/* ============================================================
   SUBMISSIONS & GRADES
   ============================================================ */
async function getSubmissionsByActivity(activityId) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions')
    .select(`id, content, file_url, submitted_at, status, student_id,
      profiles!submissions_student_id_fkey (id, name, email)`)
    .eq('activity_id', activityId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getGradesByActivity(activityId) {
  const client = initSupabase();
  const { data, error } = await client
    .from('grades')
    .select(`
      id, submission_id, student_id, score, feedback, graded_by, graded_at,
      submissions!inner (activity_id)
    `)
    .eq('submissions.activity_id', activityId);
  if (error) throw error;
  return data || [];
}

async function saveGrade({ submissionId, activityId, studentId, score, feedback, gradedBy }) {
  const client = initSupabase();
  const { data: existing } = await client.from('grades')
    .select('id').eq('submission_id', submissionId).maybeSingle();

  if (existing) {
    const { data, error } = await client.from('grades')
      .update({ score, feedback, graded_by: gradedBy, graded_at: new Date().toISOString() })
      .eq('id', existing.id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await client.from('grades')
      .insert([{
        submission_id: submissionId,
        student_id: studentId,
        score,
        feedback,
        graded_by: gradedBy
      }])
      .select().single();
    if (error) throw error;
    return data;
  }
}

/* ============================================================
   GRADE BOOK
   ============================================================ */
async function getGradeBook(classId) {
  const client = initSupabase();
  const { data: activities, error: e1 } = await client.from('activities')
    .select('id, title, type, max_score, deadline, subject_id')
    .eq('class_id', classId).order('created_at', { ascending: true });
  if (e1) throw e1;

  const { data: enrolls, error: e2 } = await client.from('enrollments')
    .select(`student_id, profiles!enrollments_student_id_fkey (id, name, email)`)
    .eq('class_id', classId).eq('status', 'active');
  if (e2) throw e2;

  const activityIds = (activities || []).map(a => a.id);
  let submissions = [], grades = [];
  if (activityIds.length > 0) {
    const { data: subs } = await client.from('submissions')
      .select('id, activity_id, student_id, submitted_at, status')
      .in('activity_id', activityIds);
    submissions = subs || [];

    const { data: grs } = await client.from('grades')
      .select(`
        submission_id, student_id, score, feedback,
        submissions!inner (activity_id)
      `)
      .in('submissions.activity_id', activityIds);

    grades = (grs || []).map(g => ({
      submission_id: g.submission_id,
      student_id: g.student_id,
      score: g.score,
      feedback: g.feedback,
      activity_id: g.submissions?.activity_id
    }));
  }

  return {
    activities: activities || [],
    students: (enrolls || []).map(e => e.profiles).filter(Boolean),
    submissions, grades
  };
}

/* ============================================================
   FORUM
   ============================================================ */
async function getForumPosts(classId, subjectId) {
  const client = initSupabase();
  const { data, error } = await client.from('forum_posts')
    .select(`id, title, body, parent_id, created_at, author_id,
      profiles!forum_posts_author_id_fkey (id, name, role)`)
    .eq('class_id', classId).eq('subject_id', subjectId)
    .is('parent_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getForumReplies(parentId) {
  const client = initSupabase();
  const { data, error } = await client.from('forum_posts')
    .select(`id, title, body, created_at, author_id,
      profiles!forum_posts_author_id_fkey (id, name, role)`)
    .eq('parent_id', parentId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function createForumPost({ classId, subjectId, authorId, title, body, parentId }) {
  const client = initSupabase();
  const { data, error } = await client.from('forum_posts')
    .insert([{ class_id: classId, subject_id: subjectId, author_id: authorId, title, body, parent_id: parentId || null }])
    .select().single();
  if (error) throw error;
  return data;
}

async function deleteForumPost(id) {
  const client = initSupabase();
  const { error } = await client.from('forum_posts').delete().eq('id', id);
  if (error) throw error;
}

/* ============================================================
   PROGRESS SISWA (Guru)
   ============================================================ */
async function getStudentProgress(classId, subjectId) {
  const client = initSupabase();
  const { data: activities, error: e1 } = await client.from('activities')
    .select('id, title, max_score').eq('class_id', classId).eq('subject_id', subjectId);
  if (e1) throw e1;

  const { data: enrolls, error: e2 } = await client.from('enrollments')
    .select(`student_id, profiles!enrollments_student_id_fkey (id, name, email)`)
    .eq('class_id', classId).eq('status', 'active');
  if (e2) throw e2;

  const activityIds = (activities || []).map(a => a.id);
  let submissions = [], grades = [];
  if (activityIds.length > 0) {
    const { data: subs } = await client.from('submissions')
      .select('id, activity_id, student_id').in('activity_id', activityIds);
    submissions = subs || [];

    const { data: grs } = await client.from('grades')
      .select(`
        student_id, score,
        submissions!inner (activity_id)
      `)
      .in('submissions.activity_id', activityIds);

    grades = (grs || []).map(g => ({
      student_id: g.student_id,
      score: g.score,
      activity_id: g.submissions?.activity_id
    }));
  }

  const subSet = new Set();
  submissions.forEach(s => subSet.add(s.activity_id + ':' + s.student_id));
  const gradeMap = {};
  grades.forEach(g => { gradeMap[g.activity_id + ':' + g.student_id] = parseFloat(g.score); });

  const students = (enrolls || []).map(e => e.profiles).filter(Boolean);
  return students.map(st => {
    let totalScore = 0, scored = 0, submitted = 0, notSubmitted = 0;
    activities.forEach(a => {
      const key = a.id + ':' + st.id;
      if (subSet.has(key)) submitted++; else notSubmitted++;
      if (gradeMap[key] !== undefined) { totalScore += gradeMap[key]; scored++; }
    });
    const avg = scored > 0 ? (totalScore / scored).toFixed(1) : '-';
    const submitPercent = activities.length > 0 ? ((submitted / activities.length) * 100).toFixed(0) : 0;
    return { student: st, totalActivities: activities.length, submitted, notSubmitted, graded: scored, avg, submitPercent };
  });
}

/* ============================================================
   RAPOR
   ============================================================ */
async function getStudentReport(studentId, classId, subjectId) {
  const client = initSupabase();
  const { data: activities, error: e1 } = await client.from('activities')
    .select('id, title, type, max_score').eq('class_id', classId).eq('subject_id', subjectId)
    .order('created_at', { ascending: true });
  if (e1) throw e1;

  const activityIds = (activities || []).map(a => a.id);
  if (activityIds.length === 0) return { activities: [], avg: '-', totalScore: 0, totalMax: 0, scored: 0 };

  const { data: rawGrades, error: e2 } = await client.from('grades')
    .select(`
      score, feedback,
      submissions!inner (activity_id)
    `)
    .eq('student_id', studentId)
    .in('submissions.activity_id', activityIds);
  if (e2) throw e2;

  const grades = (rawGrades || []).map(g => ({
    score: g.score,
    feedback: g.feedback,
    activity_id: g.submissions?.activity_id
  }));

  const gradeMap = {};
  (grades || []).forEach(g => { gradeMap[g.activity_id] = g; });

  let totalScore = 0, totalMax = 0, scored = 0;
  const activityDetails = activities.map(a => {
    const g = gradeMap[a.id];
    if (g && g.score !== null) {
      totalScore += parseFloat(g.score);
      totalMax += parseFloat(a.max_score);
      scored++;
    }
    return { ...a, grade: g };
  });

  const avg = scored > 0 && totalMax > 0 ? ((totalScore / totalMax) * 100).toFixed(1) : '-';
  return { activities: activityDetails, avg, totalScore: totalScore.toFixed(1), totalMax: totalMax.toFixed(1), scored };
}

async function getStudentsForReport(classId) {
  const client = initSupabase();
  const { data, error } = await client.from('enrollments')
    .select(`student_id, profiles!enrollments_student_id_fkey (id, name, email)`)
    .eq('class_id', classId).eq('status', 'active');
  if (error) throw error;
  return (data || []).map(e => e.profiles).filter(Boolean);
}

/* ============================================================
   LAPORAN MASTER (Operator)
   ============================================================ */
async function getMasterReport(schoolId) {
  const client = initSupabase();
  const [
    { data: profiles }, { data: subjects }, { data: classes },
    { data: assigns }, { data: enrolls }
  ] = await Promise.all([
    client.from('profiles').select('id, name, role, status').eq('school_id', schoolId),
    client.from('subjects').select('id, name, code').eq('school_id', schoolId),
    client.from('classes').select('id, name, grade').eq('school_id', schoolId),
    client.from('teacher_assign').select('teacher_id, subject_id, class_id').eq('school_id', schoolId),
    client.from('enrollments').select('student_id, class_id, status').eq('school_id', schoolId)
  ]);

  const allP = profiles || [], allS = subjects || [], allC = classes || [];
  const allA = assigns || [], allE = (enrolls || []).filter(e => e.status === 'active');
  const teachers = allP.filter(p => p.role === 'guru');
  const students = allP.filter(p => p.role === 'siswa');
  const enrolledIds = new Set(allE.map(e => e.student_id));
  const assignedIds = new Set(allA.map(a => a.teacher_id));
  const studentsPerClass = {};
  allE.forEach(e => { studentsPerClass[e.class_id] = (studentsPerClass[e.class_id] || 0) + 1; });
  const assignPerTeacher = {};
  allA.forEach(a => { assignPerTeacher[a.teacher_id] = (assignPerTeacher[a.teacher_id] || 0) + 1; });
  const subjectUsage = {};
  allA.forEach(a => { subjectUsage[a.subject_id] = (subjectUsage[a.subject_id] || 0) + 1; });

  return {
    totalStudents: students.length, totalTeachers: teachers.length,
    totalClasses: allC.length, totalSubjects: allS.length,
    totalAssignments: allA.length, totalEnrollments: allE.length,
    avgStudentsPerClass: allC.length > 0 ? (allE.length / allC.length).toFixed(1) : '0',
    avgClassesPerTeacher: teachers.length > 0 ? (allA.length / teachers.length).toFixed(1) : '0',
    topTeachers: teachers.map(t => ({ ...t, assignCount: assignPerTeacher[t.id] || 0 }))
      .filter(t => t.assignCount > 0).sort((a, b) => b.assignCount - a.assignCount).slice(0, 5),
    topClasses: allC.map(c => ({ ...c, studentCount: studentsPerClass[c.id] || 0 }))
      .sort((a, b) => b.studentCount - a.studentCount).slice(0, 5),
    popularSubjects: allS.map(s => ({ ...s, usageCount: subjectUsage[s.id] || 0 }))
      .filter(s => s.usageCount > 0).sort((a, b) => b.usageCount - a.usageCount).slice(0, 5),
    studentsWithoutClass: students.filter(s => !enrolledIds.has(s.id)).length,
    teachersWithoutAssign: teachers.filter(t => !assignedIds.has(t.id)).length,
    classesWithoutStudents: allC.filter(c => !studentsPerClass[c.id]).length
  };
}

/* ============================================================
   SISWA-SPECIFIC HELPERS
   ============================================================ */

async function getMyEnrolledSubjects(studentId) {
  const client = initSupabase();
  const { data: enrolls, error: e1 } = await client.from('enrollments')
    .select(`class_id, classes (id, name, grade, room)`)
    .eq('student_id', studentId).eq('status', 'active');
  if (e1) throw e1;

  if (!enrolls || enrolls.length === 0) return [];

  const classIds = enrolls.map(e => e.class_id);

  const { data: assigns, error: e2 } = await client.from('teacher_assign')
    .select(`
      subject_id,
      class_id,
      subjects (id, name, code),
      profiles!teacher_assign_teacher_id_fkey (id, name),
      classes (id, name, grade)
    `)
    .in('class_id', classIds);
  if (e2) throw e2;

  return assigns || [];
}

async function getMyActivities(studentId, classId, subjectId) {
  const client = initSupabase();

  const { data: activities, error: e1 } = await client.from('activities')
    .select('*').eq('class_id', classId).eq('subject_id', subjectId)
    .order('deadline', { ascending: true });
  if (e1) throw e1;

  if (!activities || activities.length === 0) return [];

  const activityIds = activities.map(a => a.id);

  const { data: mySubs, error: e2 } = await client.from('submissions')
    .select('*').eq('student_id', studentId).in('activity_id', activityIds);
  if (e2) throw e2;

  const { data: rawGrades, error: e3 } = await client.from('grades')
    .select(`
      id, submission_id, student_id, score, feedback, graded_at,
      submissions!inner (activity_id)
    `)
    .eq('student_id', studentId)
    .in('submissions.activity_id', activityIds);
  if (e3) throw e3;

  const myGrades = (rawGrades || []).map(g => ({
    id: g.id,
    submission_id: g.submission_id,
    student_id: g.student_id,
    score: g.score,
    feedback: g.feedback,
    graded_at: g.graded_at,
    activity_id: g.submissions?.activity_id
  }));

  const subMap = {};
  (mySubs || []).forEach(s => { subMap[s.activity_id] = s; });
  const gradeMap = {};
  myGrades.forEach(g => {
    if (g.activity_id !== undefined && g.activity_id !== null) {
      gradeMap[g.activity_id] = g;
    }
  });

  return activities.map(a => ({
    ...a,
    submission: subMap[a.id] || null,
    grade: gradeMap[a.id] || null
  }));
}

async function getMyGrades(studentId) {
  const client = initSupabase();

  const { data: rawGrades, error: e1 } = await client.from('grades')
    .select(`
      id, score, feedback, graded_at, submission_id,
      submissions!inner (activity_id)
    `)
    .eq('student_id', studentId)
    .order('graded_at', { ascending: false });
  if (e1) throw e1;

  const grades = (rawGrades || []).map(g => ({
    id: g.id,
    score: g.score,
    feedback: g.feedback,
    graded_at: g.graded_at,
    submission_id: g.submission_id,
    activity_id: g.submissions?.activity_id
  }));

  if (grades.length === 0) return [];

  const activityIds = [...new Set(grades.map(g => g.activity_id).filter(id => id != null))];
  if (activityIds.length === 0) return grades.map(g => ({ ...g, activities: null }));

  const { data: activities, error: e2 } = await client.from('activities')
    .select(`
      id, title, type, max_score, subject_id, class_id,
      subjects (id, name, code),
      classes (id, name)
    `)
    .in('id', activityIds);
  if (e2) throw e2;

  const actMap = {};
  (activities || []).forEach(a => { actMap[a.id] = a; });

  return grades.map(g => ({
    ...g,
    activities: actMap[g.activity_id] || null
  }));
}

async function submitActivity({ activityId, studentId, content, fileUrl }) {
  const client = initSupabase();
  const { data: existing } = await client.from('submissions')
    .select('id').eq('activity_id', activityId).eq('student_id', studentId).maybeSingle();

  if (existing) {
    const { data, error } = await client.from('submissions')
      .update({ content, file_url: fileUrl, submitted_at: new Date().toISOString(), status: 'submitted' })
      .eq('id', existing.id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await client.from('submissions')
      .insert([{ activity_id: activityId, student_id: studentId, content, file_url: fileUrl, status: 'submitted' }])
      .select().single();
    if (error) throw error;
    return data;
  }
}

async function getMyProgress(studentId) {
  const client = initSupabase();

  const enrolls = await getStudentClasses(studentId);
  if (!enrolls || enrolls.length === 0) return [];

  const classIds = enrolls.map(e => e.classes.id);

  const { data: assigns, error: e1 } = await client.from('teacher_assign')
    .select(`subject_id, class_id, subjects (id, name, code), classes (id, name)`)
    .in('class_id', classIds);
  if (e1) throw e1;

  const result = [];
  for (const a of (assigns || [])) {
    if (!a.subjects || !a.classes) continue;

    const { data: acts } = await client.from('activities')
      .select('id').eq('class_id', a.class_id).eq('subject_id', a.subject_id);
    const actIds = (acts || []).map(x => x.id);

    if (actIds.length === 0) {
      result.push({
        subject: a.subjects, classInfo: a.classes,
        totalActivities: 0, submitted: 0, graded: 0, percent: 0, avgScore: '-'
      });
      continue;
    }

    const { data: subs } = await client.from('submissions')
      .select('id, activity_id').eq('student_id', studentId).in('activity_id', actIds);
    const submitted = (subs || []).length;

    const { data: rawGrs, error: e2 } = await client.from('grades')
      .select(`
        score,
        submissions!inner (activity_id)
      `)
      .eq('student_id', studentId)
      .in('submissions.activity_id', actIds);
    if (e2) throw e2;

    const grs = (rawGrs || []).map(g => ({ score: g.score }));
    const graded = grs.length;
    const totalScore = grs.reduce((s, g) => s + parseFloat(g.score || 0), 0);
    const avgScore = graded > 0 ? (totalScore / graded).toFixed(1) : '-';
    const percent = Math.round((submitted / actIds.length) * 100);

    result.push({
      subject: a.subjects, classInfo: a.classes,
      totalActivities: actIds.length, submitted, graded, percent, avgScore
    });
  }
  return result;
}