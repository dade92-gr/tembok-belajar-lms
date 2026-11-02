// ============================================
// SUPABASE.JS — TEMBOK BELAJAR (AUTO-GENERATED)
// JANGAN EDIT FILE INI LANGSUNG!
// Edit file di assets/js/db/*.js lalu jalankan: node build.js
// Generated: 2026-11-02T07:05:42.091Z
// ============================================

// Cache WAJIB di-load via <script src="../assets/js/core/cache.js"></script> SEBELUM supabase.js
// (tidak ada fallback di sini — kalau cache.js tidak termuat, akan error saat runtime)

// assets/js/db/_01-client.js
// Supabase client initialization

let supabaseClient = null;

function initSupabase() {
  if (supabaseClient) return supabaseClient;
  if (typeof supabase === 'undefined') {
    console.error('Supabase library belum dimuat!');
    return null;
  }
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
    console.error('config.js belum dimuat!');
    return null;
  }
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

function getSupabase() {
  if (!supabaseClient) return initSupabase();
  return supabaseClient;
}

// assets/js/db/_02-auth.js
// Auth & multi-role

async function getUserRoles(userId) {
  const client = initSupabase();
  const { data, error } = await client
    .from('user_roles')
    .select(`id, role, school_id, status, schools (id, name)`)
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

async function getProfile() {
  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await client
    .from('profiles').select('*').eq('id', user.id).single();
  if (error) { console.error('getProfile error:', error); return null; }

  const roles = await getUserRoles(user.id);

  let activeRole = null;
  try {
    const stored = sessionStorage.getItem('active_role');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && roles.find(r =>
        r.role === parsed.role && String(r.school_id) === String(parsed.school_id)
      )) {
        activeRole = parsed;
      }
    }
  } catch (e) {}

  if (!activeRole && roles.length > 0) {
    activeRole = { role: roles[0].role, school_id: roles[0].school_id };
  }

  if (roles.length === 0 && profile.role) {
    activeRole = { role: profile.role, school_id: profile.school_id };
  }

  const resolvedRole = activeRole?.role || profile.role;
  const resolvedSchool = activeRole?.school_id ?? profile.school_id;

  try {
    sessionStorage.setItem('active_role', JSON.stringify({
      role: resolvedRole,
      school_id: resolvedSchool,
      user_id: user.id
    }));
  } catch (e) {}

  return {
    ...profile,
    roles: roles.length > 0 ? roles : [{ role: profile.role, school_id: profile.school_id }],
    activeRole: { role: resolvedRole, school_id: resolvedSchool },
    role: resolvedRole,
    school_id: resolvedSchool
  };
}

async function doLogout() {
  const client = initSupabase();
  try { cache.clearAll(); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  await client.auth.signOut();
  window.location.href = '../login.html';
}

function redirectByRole(roleOrProfile) {
  const profile = typeof roleOrProfile === 'string'
    ? { role: roleOrProfile, roles: [{ role: roleOrProfile, school_id: null, school_name: null }] }
    : roleOrProfile;

  const base = window.location.pathname.includes('/operator/')
    || window.location.pathname.includes('/guru/')
    || window.location.pathname.includes('/siswa/')
    || window.location.pathname.includes('/admin/')
    || window.location.pathname.includes('/wali-kelas/')
    ? '../' : '';

  if (profile.roles && profile.roles.length > 1) {
    showRolePicker(profile.roles, base, profile.id);
    return;
  }

  const role = profile.role;
  if (role === 'admin') window.location.href = base + 'admin/dashboard.html';
  else if (role === 'operator') window.location.href = base + 'operator/dashboard.html';
  else if (role === 'guru') window.location.href = base + 'guru/dashboard.html';
  else if (role === 'wali_kelas') window.location.href = base + 'wali-kelas/dashboard.html';
  else if (role === 'siswa') window.location.href = base + 'siswa/dashboard.html';
  else window.location.href = base + 'login.html';
}

function showRolePicker(roles, base, userId) {
  const old = document.getElementById('rolePickerModal');
  if (old) old.remove();

  const roleLabels = {
    admin: { label: 'Super Admin', icon: 'fa-crown', color: '#8b5cf6', desc: 'Kelola semua sekolah' },
    operator: { label: 'Operator', icon: 'fa-user-shield', color: '#3b82f6', desc: 'Kelola guru, siswa, kelas, mapel' },
    guru: { label: 'Guru', icon: 'fa-chalkboard-teacher', color: '#10b981', desc: 'Kelola materi, aktivitas, nilai' },
    wali_kelas: { label: 'Wali Kelas', icon: 'fa-users-rectangle', color: '#ec4899', desc: 'Pantau siswa, nilai, dan forum' },
    siswa: { label: 'Siswa', icon: 'fa-user-graduate', color: '#f59e0b', desc: 'Belajar, kerjakan tugas, lihat nilai' }
  };

  const modal = document.createElement('div');
  modal.id = 'rolePickerModal';
  modal.style.cssText = `position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.85);display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px);font-family:'Inter',-apple-system,sans-serif;`;

  const cards = roles.map(r => {
    const info = roleLabels[r.role] || { label: r.role, icon: 'fa-user', color: '#64748b', desc: '' };
    return `
      <div class="role-card" data-role="${r.role}" data-school="${r.school_id || ''}"
           style="background:white;border-radius:12px;padding:1.5rem 1.2rem;cursor:pointer;transition:all 0.2s;border:2px solid transparent;text-align:center;"
           onmouseover="this.style.borderColor='${info.color}';this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 20px rgba(0,0,0,0.1)'"
           onmouseout="this.style.borderColor='transparent';this.style.transform='none';this.style.boxShadow='none'">
        <div style="width:60px;height:60px;border-radius:16px;background:${info.color}20;color:${info.color};display:flex;align-items:center;justify-content:center;margin:0 auto 0.8rem;font-size:1.8rem;">
          <i class="fas ${info.icon}"></i>
        </div>
        <div style="font-weight:700;color:#0f172a;margin-bottom:0.3rem;font-size:0.95rem;">${info.label}</div>
        <div style="font-size:0.72rem;color:#64748b;margin-bottom:0.5rem;line-height:1.4;">${info.desc}</div>
        ${r.school_name ? `<div style="font-size:0.7rem;color:${info.color};font-weight:600;padding:3px 10px;background:${info.color}15;border-radius:8px;display:inline-block;"><i class="fas fa-school"></i> ${r.school_name}</div>` : '<div style="height:22px;"></div>'}
      </div>`;
  }).join('');

  modal.innerHTML = `
    <div style="background:#f8fafc;border-radius:20px;padding:2rem;max-width:720px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:white;display:inline-flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:0.8rem;">
          <i class="fas fa-users"></i>
        </div>
        <h2 style="font-size:1.3rem;color:#0f172a;margin-bottom:0.3rem;font-weight:800;">Pilih Peran</h2>
        <p style="font-size:0.85rem;color:#64748b;margin:0;">Pilih salah satu panel.</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.8rem;">${cards}</div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelectorAll('.role-card').forEach(card => {
    card.addEventListener('click', () => {
      const role = card.dataset.role;
      const schoolId = card.dataset.school ? parseInt(card.dataset.school) : null;
      sessionStorage.setItem('active_role', JSON.stringify({
        role, school_id: schoolId, user_id: userId || null
      }));
      if (role === 'admin') window.location.href = base + 'admin/dashboard.html';
      else if (role === 'operator') window.location.href = base + 'operator/dashboard.html';
      else if (role === 'guru') window.location.href = base + 'guru/dashboard.html';
      else if (role === 'wali_kelas') window.location.href = base + 'wali-kelas/dashboard.html';
      else if (role === 'siswa') window.location.href = base + 'siswa/dashboard.html';
    });
  });
}

async function requireAuth(expectedRole) {
  const profile = await getProfile();
  if (!profile) {
    alert('Silakan login terlebih dahulu.');
    window.location.href = '../login.html';
    return null;
  }

  const hasRole = profile.roles && profile.roles.some(r => r.role === expectedRole);

  if (expectedRole && !hasRole) {
    alert('Anda tidak punya akses ke halaman ini.');
    redirectByRole(profile);
    return null;
  }

  if (expectedRole && profile.role !== expectedRole) {
    const matchingRole = profile.roles.find(r => r.role === expectedRole);
    if (matchingRole) {
      sessionStorage.setItem('active_role', JSON.stringify({
        role: matchingRole.role,
        school_id: matchingRole.school_id,
        user_id: profile.id
      }));
      profile.role = matchingRole.role;
      profile.school_id = matchingRole.school_id;
      profile.activeRole = matchingRole;
    }
  }

  return profile;
}

async function switchRole() {
  const profile = await getProfile();
  if (!profile || !profile.roles || profile.roles.length <= 1) {
    alert('Anda hanya punya 1 role.');
    return;
  }
  sessionStorage.removeItem('active_role');
  redirectByRole(profile);
}

// assets/js/db/_03-schools.js

async function getSchool(schoolId) {
  return cache.fetch(`school_${schoolId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('schools').select('*').eq('id', schoolId).single();
    if (error) throw error;
    return data;
  }, { ttl: 24 * 60 * 60 * 1000 });
}

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

// assets/js/db/_08-enrollments.js
// Enrollment siswa ke kelas

async function getEnrollments(schoolId) {
  return cache.fetch(`enrollments_${schoolId || 'all'}`, async () => {
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
  }, { ttl: 12 * 60 * 60 * 1000 });
}

async function createEnrollment({ studentId, classId, schoolId }) {
  const client = initSupabase();
  const { data, error } = await client.from('enrollments')
    .insert([{ student_id: studentId, class_id: classId, school_id: schoolId, status: 'active' }])
    .select().single();
  if (error) throw error;
  cache.clearByPrefix('enrollments_');
  cache.clearByPrefix('students_in_class_');
  return data;
}

async function deleteEnrollment(id) {
  const client = initSupabase();
  const { error } = await client.from('enrollments').delete().eq('id', id);
  if (error) throw error;
  cache.clearByPrefix('enrollments_');
  cache.clearByPrefix('students_in_class_');
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
  return cache.fetch(`student_classes_${studentId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('enrollments')
      .select(`id, classes (id, name, grade, room)`)
      .eq('student_id', studentId).eq('status', 'active');
    if (error) throw error;
    return data || [];
  }, { ttl: 12 * 60 * 60 * 1000 });
}

async function getClassSubjects(classId) {
  const client = initSupabase();
  const { data, error } = await client.from('teacher_assign')
    .select(`id, subjects (id, name, code), profiles!teacher_assign_teacher_id_fkey (id, name)`)
    .eq('class_id', classId);
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
  return cache.fetch(`students_in_class_${classId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('enrollments')
      .select(`id, student_id, status, profiles!enrollments_student_id_fkey (id, name, email, status, nisn, nis, nik, jenis_kelamin, tempat_lahir, tanggal_lahir, agama, alamat, no_hp, nama_ayah, nama_ibu, nama_wali)`)
      .eq('class_id', classId).eq('status', 'active');
    if (error) throw error;
    return data || [];
  }, { ttl: 12 * 60 * 60 * 1000 });
}

// assets/js/db/_09-homeroom.js
// Wali kelas (homeroom_teachers)

async function getHomeroomAssignments(schoolId) {
  return cache.fetch(`homeroom_all_${schoolId || 'all'}`, async () => {
    const client = initSupabase();
    let q = client.from('homeroom_teachers').select(`
      id, teacher_id, class_id, school_id, status, created_at,
      profiles!homeroom_teachers_teacher_id_fkey (id, name, email),
      classes (id, name, grade)
    `).order('created_at', { ascending: false });
    if (schoolId) q = q.eq('school_id', schoolId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }, { ttl: 24 * 60 * 60 * 1000 });
}

async function getClassesWithWaliCount(schoolId) {
  const client = initSupabase();
  let cq = client.from('classes').select('id, name, grade, room').order('name');
  if (schoolId) cq = cq.eq('school_id', schoolId);
  const { data: classes, error: ce } = await cq;
  if (ce) throw ce;

  const assigns = await getHomeroomAssignments(schoolId);
  const byClass = {};
  assigns.forEach(a => {
    if (!byClass[a.class_id]) byClass[a.class_id] = [];
    byClass[a.class_id].push(a);
  });

  return (classes || []).map(c => ({
    ...c,
    waliCount: (byClass[c.id] || []).filter(a => a.status === 'active').length,
    waliList: (byClass[c.id] || []).filter(a => a.status === 'active')
  }));
}

async function getTeacherOtherHomerooms(teacherId, excludeClassId, schoolId) {
  const client = initSupabase();
  let q = client.from('homeroom_teachers')
    .select(`id, class_id, classes (id, name)`)
    .eq('teacher_id', teacherId).eq('status', 'active');
  if (schoolId) q = q.eq('school_id', schoolId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || [])
    .filter(r => String(r.class_id) !== String(excludeClassId))
    .map(r => ({ class_id: r.class_id, class_name: r.classes?.name || '-' }));
}

async function assignHomeroomTeacher(classId, teacherId, schoolId) {
  const client = initSupabase();
  const { data: assignment, error: assignErr } = await client
    .from('homeroom_teachers')
    .insert([{ teacher_id: teacherId, class_id: classId, school_id: schoolId, status: 'active' }])
    .select().single();
  if (assignErr) throw assignErr;

  let roleAdded = false;
  try {
    const { data: existing } = await client.from('user_roles')
      .select('id, status').eq('user_id', teacherId)
      .eq('role', 'wali_kelas').eq('school_id', schoolId).maybeSingle();

    if (existing) {
      if (existing.status !== 'active') {
        await client.from('user_roles').update({ status: 'active' }).eq('id', existing.id);
        roleAdded = true;
      }
    } else {
      const { error: roleErr } = await client.from('user_roles').insert([{
        user_id: teacherId, role: 'wali_kelas', school_id: schoolId, status: 'active'
      }]);
      if (roleErr) throw roleErr;
      roleAdded = true;
    }
  } catch (e) {
    console.warn('Gagal upsert role wali_kelas:', e);
  }

  cache.clearByPrefix('homeroom_');
  cache.clearByPrefix('my_homeroom_');
  return { assignment, roleAdded };
}

async function removeHomeroomAssignment(assignmentId, teacherId, schoolId) {
  const client = initSupabase();
  const { error: delErr } = await client.from('homeroom_teachers').delete().eq('id', assignmentId);
  if (delErr) throw delErr;

  let roleDeactivated = false;
  try {
    const { data: remaining } = await client.from('homeroom_teachers')
      .select('id').eq('teacher_id', teacherId).eq('school_id', schoolId)
      .eq('status', 'active').limit(1);
    if (!remaining || remaining.length === 0) {
      await client.from('user_roles')
        .update({ status: 'inactive' })
        .eq('user_id', teacherId).eq('role', 'wali_kelas').eq('school_id', schoolId);
      roleDeactivated = true;
    }
  } catch (e) { console.warn('Gagal update status role wali_kelas:', e); }

  cache.clearByPrefix('homeroom_');
  cache.clearByPrefix('my_homeroom_');
  return { success: true, roleDeactivated };
}

async function getMyHomeroomClasses(teacherId) {
  return cache.fetch(`my_homeroom_${teacherId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('homeroom_teachers')
      .select(`id, class_id, classes (id, name, grade, room)`)
      .eq('teacher_id', teacherId).eq('status', 'active');
    if (error) throw error;
    return (data || []).map(r => ({
      assignment_id: r.id,
      class_id: r.class_id,
      class_name: r.classes?.name || '-',
      grade: r.classes?.grade,
      room: r.classes?.room
    }));
  }, { ttl: 12 * 60 * 60 * 1000 });
}

// assets/js/db/_10-plans.js
// Annual plans (perencanaan tahunan)

async function getMyAnnualPlans(teacherId, forceRefresh = false) {
  return cache.fetch(`annual_plans_${teacherId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('annual_plans').select(`
      id, teacher_id, subject_id, class_id, academic_year, semester, cp_text, created_at,
      subjects (id, name, code),
      classes (id, name, grade, room)
    `).eq('teacher_id', teacherId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }, { ttl: 24 * 60 * 60 * 1000, forceRefresh });
}

async function getAnnualPlanById(id, forceRefresh = false) {
  return cache.fetch(`annual_plan_${id}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('annual_plans').select(`
      id, teacher_id, subject_id, class_id, academic_year, semester, cp_text, created_at,
      subjects (id, name, code),
      classes (id, name, grade, room)
    `).eq('id', id).single();
    if (error) throw error;
    return data;
  }, { ttl: 24 * 60 * 60 * 1000, forceRefresh });
}

async function createAnnualPlan({ teacherId, subjectId, classId, academicYear, semester, cpText }) {
  const client = initSupabase();
  const { data, error } = await client.from('annual_plans')
    .insert([{
      teacher_id: teacherId, subject_id: subjectId, class_id: classId,
      academic_year: academicYear, semester: semester, cp_text: cpText || null
    }]).select().single();
  if (error) throw error;
  cache.clearByPrefix('annual_plan');
  return data;
}

async function updateAnnualPlan(id, updates) {
  const client = initSupabase();
  const payload = {};
  ['academic_year','semester','cp_text'].forEach(k => {
    if (updates[k] !== undefined) payload[k] = updates[k];
  });
  const { data, error } = await client.from('annual_plans')
    .update(payload).eq('id', id).select().single();
  if (error) throw error;
  cache.clearByPrefix('annual_plan');
  return data;
}

async function deleteAnnualPlan(id) {
  const client = initSupabase();
  const { error } = await client.from('annual_plans').delete().eq('id', id);
  if (error) throw error;
  cache.clearByPrefix('annual_plan');
  cache.clearByPrefix('units_');
}

// assets/js/db/_11-objectives.js
// Learning objectives (TP - Tujuan Pembelajaran)

async function getLearningObjectives(annualPlanId, forceRefresh = false) {
  return cache.fetch(`objectives_${annualPlanId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('learning_objectives')
      .select('*').eq('annual_plan_id', annualPlanId)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return data || [];
  }, { ttl: 12 * 60 * 60 * 1000, forceRefresh });
}

async function createLearningObjective({ annualPlanId, code, description, orderIndex }) {
  const client = initSupabase();
  let nextOrder = orderIndex;
  if (nextOrder === undefined || nextOrder === null) {
    const { data: last } = await client.from('learning_objectives')
      .select('order_index').eq('annual_plan_id', annualPlanId)
      .order('order_index', { ascending: false }).limit(1);
    nextOrder = (last && last[0] ? last[0].order_index : 0) + 1;
  }
  const { data, error } = await client.from('learning_objectives')
    .insert([{ annual_plan_id: annualPlanId, code, description, order_index: nextOrder }])
    .select().single();
  if (error) throw error;
  cache.remove(`objectives_${annualPlanId}`);
  return data;
}

async function updateLearningObjective(id, updates) {
  const client = initSupabase();
  const payload = {};
  ['code','description','order_index'].forEach(k => {
    if (updates[k] !== undefined) payload[k] = updates[k];
  });
  const { data, error } = await client.from('learning_objectives')
    .update(payload).eq('id', id).select().single();
  if (error) throw error;
  cache.clearByPrefix('objectives_');
  return data;
}

async function deleteLearningObjective(id) {
  const client = initSupabase();
  const { error } = await client.from('learning_objectives').delete().eq('id', id);
  if (error) throw error;
  cache.clearByPrefix('objectives_');
}

// assets/js/db/_12-units.js
// Units (unit pembelajaran)

async function getUnits(annualPlanId, forceRefresh = false) {
  return cache.fetch(`units_${annualPlanId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('units')
      .select('*').eq('annual_plan_id', annualPlanId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }, { ttl: 12 * 60 * 60 * 1000, forceRefresh });
}

async function getUnitsPublishedByClass(classId, forceRefresh = false) {
  return cache.fetch(`units_pub_class_${classId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('unit_classes').select(`
      id, class_id, is_published, published_at,
      units!inner (
        id, annual_plan_id, title, description, kktp_type, kktp_config, status, created_at,
        annual_plans!inner (
          id, class_id, subject_id, academic_year, semester,
          subjects (id, name, code),
          classes (id, name, grade, room)
        )
      )
    `).eq('class_id', classId).eq('is_published', true);
    if (error) throw error;
    return (data || []).map(uc => ({
      ...uc.units,
      _unit_class_id: uc.id,
      _class_id: uc.class_id,
      _published_at: uc.published_at,
      annual_plans: uc.units.annual_plans
    }));
  }, { ttl: 12 * 60 * 60 * 1000, forceRefresh });
}

async function getUnitById(id, forceRefresh = false) {
  return cache.fetch(`unit_${id}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('units').select(`
      *,
      annual_plans (id, teacher_id, subject_id, class_id, academic_year, semester, cp_text,
        subjects (id, name, code), classes (id, name, grade, room))
    `).eq('id', id).single();
    if (error) throw error;
    return data;
  }, { ttl: 12 * 60 * 60 * 1000, forceRefresh });
}

async function createUnit({ annualPlanId, title, description, kktpType, kktpConfig }) {
  const client = initSupabase();
  const { data, error } = await client.from('units')
    .insert([{
      annual_plan_id: annualPlanId,
      title, description: description || null,
      kktp_type: kktpType || null,
      kktp_config: kktpConfig || null,
      status: 'draft'
    }]).select().single();
  if (error) throw error;
  cache.clearByPrefix('units_');
  cache.remove(`unit_${data.id}`);
  return data;
}

async function updateUnit(id, updates) {
  const client = initSupabase();
  const payload = {};
  ['title','description','kktp_type','kktp_config','status'].forEach(k => {
    if (updates[k] !== undefined) payload[k] = updates[k];
  });
  const { data, error } = await client.from('units')
    .update(payload).eq('id', id).select().single();
  if (error) throw error;
  cache.remove(`unit_${id}`);
  cache.clearByPrefix('units_');
  return data;
}

async function updateUnitStatus(id, status) {
  const client = initSupabase();
  const { data, error } = await client.from('units')
    .update({ status }).eq('id', id).select().single();
  if (error) throw error;
  cache.remove(`unit_${id}`);
  cache.clearByPrefix('units_');
  return data;
}

async function deleteUnit(id) {
  const client = initSupabase();
  const { error } = await client.from('units').delete().eq('id', id);
  if (error) throw error;
  cache.remove(`unit_${id}`);
  cache.clearByPrefix('units_');
  cache.clearByPrefix('unit_acts_');
  cache.clearByPrefix('unit_classes_');
}

// assets/js/db/_13-unit-classes.js
// Multi-kelas unit + publish

async function getUnitClasses(unitId, forceRefresh = false) {
  return cache.fetch(`unit_classes_${unitId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('unit_classes').select(`
      id, unit_id, class_id, is_published, published_at,
      classes (id, name, grade, room)
    `).eq('unit_id', unitId).order('added_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }, { ttl: 12 * 60 * 60 * 1000, forceRefresh });
}

async function setUnitClasses(unitId, classIds) {
  const client = initSupabase();
  const { data: existing, error: e1 } = await client.from('unit_classes')
    .select('id, class_id').eq('unit_id', unitId);
  if (e1) throw e1;

  const existingClassIds = new Set((existing || []).map(r => String(r.class_id)));
  const targetClassIds = new Set(classIds.map(String));

  const toAdd = [...targetClassIds].filter(id => !existingClassIds.has(id));
  const toRemove = (existing || []).filter(r => !targetClassIds.has(String(r.class_id)));

  if (toAdd.length > 0) {
    const rows = toAdd.map(cid => ({ unit_id: unitId, class_id: parseInt(cid) }));
    const { error } = await client.from('unit_classes').insert(rows);
    if (error) throw error;
  }
  if (toRemove.length > 0) {
    const ids = toRemove.map(r => r.id);
    const { error } = await client.from('unit_classes').delete().in('id', ids);
    if (error) throw error;
  }

  cache.remove(`unit_classes_${unitId}`);
  return { added: toAdd.length, removed: toRemove.length };
}

async function publishUnitToClasses(unitId, classIds, snapshot) {
  const client = initSupabase();
  const now = new Date().toISOString();
  const parsedClassIds = classIds.map(c => parseInt(c));

  const { data: existing, error: e1 } = await client.from('unit_classes')
    .select('id, class_id').eq('unit_id', unitId);
  if (e1) throw e1;

  const existingClassIds = new Set((existing || []).map(r => String(r.class_id)));
  const toInsert = parsedClassIds.filter(cid => !existingClassIds.has(String(cid)));

  if (toInsert.length > 0) {
    const insertRows = toInsert.map(cid => ({ unit_id: unitId, class_id: cid }));
    const { error: e2 } = await client.from('unit_classes').insert(insertRows);
    if (e2) throw e2;
  }

  const payload = {
    published_version: snapshot,
    published_at: now,
    is_published: true
  };
  const { data, error: e3 } = await client.from('unit_classes')
    .update(payload).eq('unit_id', unitId).in('class_id', parsedClassIds).select();
  if (e3) throw e3;

  await client.from('units').update({ status: 'published' }).eq('id', unitId);

  cache.remove(`unit_classes_${unitId}`);
  cache.remove(`unit_${unitId}`);
  cache.clearByPrefix('units_pub_class_');
  return data || [];
}

async function unpublishUnitFromClasses(unitId, classIds) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_classes')
    .update({ is_published: false })
    .eq('unit_id', unitId).in('class_id', classIds.map(c => parseInt(c))).select();
  if (error) throw error;

  const { data: remaining } = await client.from('unit_classes')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', unitId).eq('is_published', true);
  if (!remaining || remaining.length === 0) {
    await client.from('units').update({ status: 'draft' }).eq('id', unitId);
  }
  cache.remove(`unit_classes_${unitId}`);
  cache.clearByPrefix('units_pub_class_');
  return data || [];
}

async function getPublishedUnitForClass(unitId, classId) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_classes')
    .select('published_version, published_at, is_published')
    .eq('unit_id', unitId).eq('class_id', classId).maybeSingle();
  if (error) throw error;
  return data;
}

async function saveUnitDraft(unitId, snapshot) {
  const client = initSupabase();
  const { data, error } = await client.from('units')
    .update({ current_version: snapshot }).eq('id', unitId).select().single();
  if (error) throw error;
  cache.remove(`unit_${unitId}`);
  return data;
}

async function getUnitWithClasses(unitId) {
  const unit = await getUnitById(unitId);
  const classes = await getUnitClasses(unitId);
  return { ...unit, classes };
}

async function duplicateUnit(sourceUnitId, targetClassIds) {
  const client = initSupabase();
  const sourceUnit = await getUnitById(sourceUnitId);
  if (!sourceUnit) throw new Error('Unit sumber tidak ditemukan');

  const sourceActs = await getUnitActivities(sourceUnitId);
  const compMap = {};
  for (const act of sourceActs) {
    compMap[act.id] = await getActivityComponents(act.id);
  }

  const firstClassId = parseInt(targetClassIds[0]);
  const { data: plans } = await client.from('annual_plans')
    .select('id')
    .eq('teacher_id', sourceUnit.annual_plans.teacher_id)
    .eq('subject_id', sourceUnit.annual_plans.subject_id)
    .eq('class_id', firstClassId)
    .limit(1);

  if (!plans || plans.length === 0) {
    throw new Error('Tidak ada annual_plan untuk kelas tujuan. Buat dulu perencanaan di kelas tersebut.');
  }
  const targetPlanId = plans[0].id;

  const { data: newUnit, error: e1 } = await client.from('units').insert([{
    annual_plan_id: targetPlanId,
    title: sourceUnit.title + ' (Copy)',
    description: sourceUnit.description,
    kktp_type: sourceUnit.kktp_type,
    kktp_config: sourceUnit.kktp_config,
    status: 'draft',
    current_version: sourceUnit.current_version || {}
  }]).select().single();
  if (e1) throw e1;

  for (const act of sourceActs) {
    const { data: newAct, error: e2 } = await client.from('unit_activities').insert([{
      unit_id: newUnit.id,
      title: act.title,
      type: act.type,
      order_index: act.order_index
    }]).select().single();
    if (e2) { console.error('copy act err', e2); continue; }

    const comps = compMap[act.id] || [];
    if (comps.length > 0) {
      const compRows = comps.map(c => ({
        activity_id: newAct.id,
        component_type: c.component_type,
        component_data: c.component_data,
        order_index: c.order_index
      }));
      await client.from('activity_components').insert(compRows);
    }
  }

  await setUnitClasses(newUnit.id, targetClassIds);

  cache.clearByPrefix('units_');
  cache.clearByPrefix('unit_acts_');
  cache.clearByPrefix('components_');
  cache.clearByPrefix('unit_classes_');
  return newUnit;
}

// assets/js/db/_13b-unit-objectives.js
// Relasi Unit ↔ Learning Objectives

async function getUnitObjectives(unitId) {
  return cache.fetch(`unit_objectives_${unitId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('unit_objectives')
      .select(`id, unit_id, objective_id, learning_objectives (id, code, description, order_index)`)
      .eq('unit_id', unitId);
    if (error) throw error;
    return data || [];
  }, { ttl: 12 * 60 * 60 * 1000 });
}

async function addUnitObjective({ unitId, objectiveId }) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_objectives')
    .insert([{ unit_id: unitId, objective_id: objectiveId }]).select().single();
  if (error) throw error;
  cache.remove(`unit_objectives_${unitId}`);
  return data;
}

async function removeUnitObjective(id) {
  const client = initSupabase();
  const { error } = await client.from('unit_objectives').delete().eq('id', id);
  if (error) throw error;
  cache.clearByPrefix('unit_objectives_');
}

// assets/js/db/_14-activities.js
// Unit activities

async function getUnitActivities(unitId, forceRefresh = false) {
  return cache.fetch(`unit_acts_${unitId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('unit_activities')
      .select('*').eq('unit_id', unitId)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return data || [];
  }, { ttl: 12 * 60 * 60 * 1000, forceRefresh });
}

async function getActivityById(id, forceRefresh = false) {
  return cache.fetch(`activity_${id}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('unit_activities')
      .select(`*, units (id, title, annual_plan_id, annual_plans (id, teacher_id, subject_id, class_id))`)
      .eq('id', id).single();
    if (error) throw error;
    return data;
  }, { ttl: 12 * 60 * 60 * 1000, forceRefresh });
}

async function createUnitActivity({ unitId, title, type, orderIndex }) {
  const client = initSupabase();
  let nextOrder = orderIndex;
  if (nextOrder === undefined || nextOrder === null) {
    const { data: last } = await client.from('unit_activities')
      .select('order_index').eq('unit_id', unitId)
      .order('order_index', { ascending: false }).limit(1);
    nextOrder = (last && last[0] ? last[0].order_index : 0) + 1;
  }
  const { data, error } = await client.from('unit_activities')
    .insert([{ unit_id: unitId, title, type: type || 'materi', order_index: nextOrder }])
    .select().single();
  if (error) throw error;
  cache.remove(`unit_acts_${unitId}`);
  return data;
}

async function updateUnitActivity(id, updates) {
  const client = initSupabase();
  const payload = {};
  ['title','type','order_index'].forEach(k => {
    if (updates[k] !== undefined) payload[k] = updates[k];
  });
  const { data, error } = await client.from('unit_activities')
    .update(payload).eq('id', id).select().single();
  if (error) throw error;
  cache.remove(`activity_${id}`);
  cache.clearByPrefix('unit_acts_');
  return data;
}

async function deleteUnitActivity(id) {
  const client = initSupabase();
  const { error } = await client.from('unit_activities').delete().eq('id', id);
  if (error) throw error;
  cache.remove(`activity_${id}`);
  cache.clearByPrefix('unit_acts_');
  cache.clearByPrefix('components_');
}

async function reorderUnitActivities(items) {
  const client = initSupabase();
  const promises = items.map(it =>
    client.from('unit_activities').update({ order_index: it.order_index }).eq('id', it.id)
  );
  const results = await Promise.all(promises);
  const firstErr = results.find(r => r.error);
  if (firstErr) throw firstErr.error;
  cache.clearByPrefix('unit_acts_');
  return true;
}

// assets/js/db/_15-components.js
// Activity components (31 tipe komponen)

async function getActivityComponents(activityId, forceRefresh = false) {
  return cache.fetch(`components_${activityId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('activity_components')
      .select('*').eq('activity_id', activityId)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return data || [];
  }, { ttl: 12 * 60 * 60 * 1000, forceRefresh });
}

async function getActivityComponentById(id) {
  const client = initSupabase();
  const { data, error } = await client.from('activity_components')
    .select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function createActivityComponent({ activityId, componentType, componentData, orderIndex }) {
  const client = initSupabase();
  let nextOrder = orderIndex;
  if (nextOrder === undefined || nextOrder === null) {
    const { data: last } = await client.from('activity_components')
      .select('order_index').eq('activity_id', activityId)
      .order('order_index', { ascending: false }).limit(1);
    nextOrder = (last && last[0] ? last[0].order_index : 0) + 1;
  }
  const { data, error } = await client.from('activity_components')
    .insert([{
      activity_id: activityId,
      component_type: componentType,
      component_data: componentData || {},
      order_index: nextOrder
    }]).select().single();
  if (error) throw error;
  cache.remove(`components_${activityId}`);
  return data;
}

async function updateActivityComponent(id, updates) {
  const client = initSupabase();
  const payload = {};
  if (updates.component_type !== undefined) payload.component_type = updates.component_type;
  if (updates.component_data !== undefined) payload.component_data = updates.component_data;
  if (updates.order_index !== undefined) payload.order_index = updates.order_index;
  const { data, error } = await client.from('activity_components')
    .update(payload).eq('id', id).select().single();
  if (error) throw error;
  cache.clearByPrefix('components_');
  return data;
}

async function deleteActivityComponent(id) {
  const client = initSupabase();
  const { error } = await client.from('activity_components').delete().eq('id', id);
  if (error) throw error;
  cache.clearByPrefix('components_');
}

async function reorderActivityComponents(items) {
  const client = initSupabase();
  const promises = items.map(it =>
    client.from('activity_components').update({ order_index: it.order_index }).eq('id', it.id)
  );
  const results = await Promise.all(promises);
  const firstErr = results.find(r => r.error);
  if (firstErr) throw firstErr.error;
  cache.clearByPrefix('components_');
  return true;
}

async function bulkCreateActivityComponents(items) {
  if (!items || items.length === 0) return [];
  const client = initSupabase();
  const payload = items.map((it, idx) => ({
    activity_id: it.activityId,
    component_type: it.componentType,
    component_data: it.componentData || {},
    order_index: it.orderIndex !== undefined ? it.orderIndex : idx
  }));
  const { data, error } = await client.from('activity_components')
    .insert(payload).select();
  if (error) throw error;
  cache.clearByPrefix('components_');
  return data || [];
}

// assets/js/db/_16-submissions.js
// Submissions & grades

async function getSubmissionsByActivity(activityId, forceRefresh = false) {
  return cache.fetch(`subs_act_${activityId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('submissions').select(`
      id, assessment_id, activity_id, student_id, status, answers, score, teacher_feedback, submitted_at, created_at,
      profiles!submissions_student_profile_fkey (id, name, email, nisn)
    `).eq('activity_id', activityId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }, { ttl: 2 * 60 * 1000, forceRefresh });
}

async function getSubmissionsByAssessment(assessmentId) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions').select(`
    id, assessment_id, activity_id, student_id, status, answers, score, teacher_feedback, submitted_at, created_at,
    profiles!submissions_student_profile_fkey (id, name, email, nisn)
  `).eq('assessment_id', assessmentId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getSubmissionById(id) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions').select(`
    *,
    profiles!submissions_student_profile_fkey (id, name, email, nisn),
    assessments (id, title, type, duration_minutes, due_date, auto_grade)
  `).eq('id', id).single();
  if (error) throw error;
  return data;
}

async function getSubmissionsByStudent(studentId) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions').select(`
    id, assessment_id, activity_id, status, answers, score, teacher_feedback, submitted_at,
    assessments (id, title, type, unit_id)
  `).eq('student_id', studentId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function submitAssessment({ assessmentId, studentId, answers }) {
  const client = initSupabase();
  const { data: existing } = await client.from('submissions')
    .select('id').eq('assessment_id', assessmentId).eq('student_id', studentId).maybeSingle();

  if (existing) {
    const { data, error } = await client.from('submissions')
      .update({ answers, submitted_at: new Date().toISOString(), status: 'submitted' })
      .eq('id', existing.id).select().single();
    if (error) throw error;
    cache.clearByPrefix('subs_');
    return data;
  } else {
    const { data, error } = await client.from('submissions')
      .insert([{ assessment_id: assessmentId, student_id: studentId, answers, status: 'submitted' }])
      .select().single();
    if (error) throw error;
    cache.clearByPrefix('subs_');
    return data;
  }
}

async function submitActivityAnswers({ activityId, studentId, answers }) {
  const client = initSupabase();
  const { data: existing } = await client.from('submissions')
    .select('id').eq('activity_id', activityId).eq('student_id', studentId).maybeSingle();

  if (existing) {
    const { data, error } = await client.from('submissions')
      .update({ answers, submitted_at: new Date().toISOString(), status: 'submitted' })
      .eq('id', existing.id).select().single();
    if (error) throw error;
    cache.clearByPrefix('subs_');
    return data;
  } else {
    const { data, error } = await client.from('submissions')
      .insert([{ activity_id: activityId, student_id: studentId, answers, status: 'submitted' }])
      .select().single();
    if (error) throw error;
    cache.clearByPrefix('subs_');
    return data;
  }
}

async function updateSubmission(id, updates) {
  const client = initSupabase();
  const payload = {};
  ['status','answers','score','teacher_feedback'].forEach(k => {
    if (updates[k] !== undefined) payload[k] = updates[k];
  });
  const { data, error } = await client.from('submissions')
    .update(payload).eq('id', id).select().single();
  if (error) throw error;
  cache.clearByPrefix('subs_');
  return data;
}

async function gradeSubmission({ submissionId, score, teacherFeedback }) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions')
    .update({
      score,
      teacher_feedback: teacherFeedback || null,
      status: 'graded'
    }).eq('id', submissionId).select().single();
  if (error) throw error;
  cache.clearByPrefix('subs_');
  return data;
}

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

// assets/js/db/_19-forum.js
// Forum diskusi

async function getForumPostsByUnit(unitId) {
  const client = initSupabase();
  const { data, error } = await client.from('forum_posts').select(`
    id, unit_id, activity_id, class_id, subject_id, title, body, parent_id, created_at, author_id,
    profiles!forum_posts_author_id_fkey (id, name, role)
  `).eq('unit_id', unitId).is('parent_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getForumPostsByActivity(activityId) {
  const client = initSupabase();
  const { data, error } = await client.from('forum_posts').select(`
    id, unit_id, activity_id, class_id, subject_id, title, body, parent_id, created_at, author_id,
    profiles!forum_posts_author_id_fkey (id, name, role)
  `).eq('activity_id', activityId).is('parent_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createUnitForumPost({ unitId, activityId, classId, subjectId, authorId, title, body, parentId }) {
  const client = initSupabase();
  const { data, error } = await client.from('forum_posts')
    .insert([{
      unit_id: unitId || null, activity_id: activityId || null,
      class_id: classId || null, subject_id: subjectId || null,
      author_id: authorId, title, body: body || null, parent_id: parentId || null
    }]).select().single();
  if (error) throw error;
  return data;
}

// assets/js/db/_20-dashboard.js
// Dashboard guru stats

async function getTeacherDashboardStats(teacherId, forceRefresh = false) {
  return cache.fetch(`guru_stats_${teacherId}`, async () => {
    const client = initSupabase();

    const plans = await getMyAnnualPlans(teacherId);
    const planIds = plans.map(p => p.id);

    let units = [];
    if (planIds.length > 0) {
      const { data } = await client.from('units')
        .select('id, title, status, annual_plan_id')
        .in('annual_plan_id', planIds);
      units = data || [];
    }
    const unitIds = units.map(u => u.id);

    let activities = [];
    if (unitIds.length > 0) {
      const { data } = await client.from('unit_activities')
        .select('id, title, type, unit_id').in('unit_id', unitIds);
      activities = data || [];
    }
    const activityIds = activities.map(a => a.id);

    let pendingSubs = [];
    if (activityIds.length > 0) {
      const { data } = await client.from('submissions')
        .select('id, activity_id, assessment_id, status, submitted_at, student_id, profiles!submissions_student_profile_fkey (name)')
        .in('activity_id', activityIds)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(20);
      pendingSubs = data || [];
    }

    return {
      totalAnnualPlans: plans.length,
      totalUnits: units.length,
      publishedUnits: units.filter(u => u.status === 'published').length,
      draftUnits: units.filter(u => u.status === 'draft').length,
      archivedUnits: units.filter(u => u.status === 'archived').length,
      totalActivities: activities.length,
      pendingSubmissions: pendingSubs.length,
      pendingSubmissionsList: pendingSubs,
      plans
    };
  }, { ttl: 5 * 60 * 1000, forceRefresh });
}

// assets/js/db/_21-siswa.js
// Fungsi khusus siswa (mapel yang diikuti, progress, aktivitas, nilai)

/* ============================================================
   MAPEL YANG DIIKUTI SISWA
   Return: [{ subject_id, class_id, subjects, profiles, classes }]
   ============================================================ */

async function getMyEnrolledSubjects(studentId, forceRefresh = false) {
  return cache.fetch(`my_subjects_${studentId}`, async () => {
    const client = initSupabase();

    // Ambil kelas yang diikuti siswa
    const { data: enrolls, error: e1 } = await client.from('enrollments')
      .select(`class_id, classes (id, name, grade, room)`)
      .eq('student_id', studentId).eq('status', 'active');
    if (e1) throw e1;

    if (!enrolls || enrolls.length === 0) return [];

    const classIds = enrolls.map(e => e.class_id);

    // Ambil teacher_assign untuk kelas-kelas itu
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
  }, { ttl: 12 * 60 * 60 * 1000, forceRefresh });
}

/* ============================================================
   AKTIVITAS + SUBMISSION SISWA (per kelas + mapel)
   ============================================================ */

async function getMyActivities(studentId, classId, subjectId, forceRefresh = false) {
  return cache.fetch(`my_acts_${studentId}_${classId}_${subjectId}`, async () => {
    const client = initSupabase();

    // Ambil semua aktivitas di kelas + mapel (published)
    const { data: activities, error: e1 } = await client.from('unit_activities')
      .select(`
        *,
        units!inner (id, title, status, annual_plan_id,
          annual_plans!inner (id, class_id, subject_id))
      `)
      .eq('units.annual_plans.class_id', classId)
      .eq('units.annual_plans.subject_id', subjectId)
      .eq('units.status', 'published')
      .order('order_index', { ascending: true });
    if (e1) throw e1;

    if (!activities || activities.length === 0) return [];

    const activityIds = activities.map(a => a.id);

    // Submission siswa
    const { data: mySubs } = await client.from('submissions')
      .select('*')
      .eq('student_id', studentId)
      .in('activity_id', activityIds);

    const subMap = {};
    (mySubs || []).forEach(s => { subMap[s.activity_id] = s; });

    return activities.map(a => ({
      ...a,
      submission: subMap[a.id] || null,
      grade: subMap[a.id] && subMap[a.id].score !== null
        ? { score: subMap[a.id].score, feedback: subMap[a.id].teacher_feedback }
        : null
    }));
  }, { ttl: 5 * 60 * 1000, forceRefresh });
}

/* ============================================================
   NILAI SISWA (dari submissions.score)
   Return field: id, submission_id, activity_id, score, feedback,
                 submitted_at, gradedAt, subject, classInfo, activities
   ============================================================ */

async function getMyGrades(studentId, forceRefresh = false) {
  return cache.fetch(`my_grades_${studentId}`, async () => {
    const client = initSupabase();

    const { data: subs, error: e1 } = await client.from('submissions')
      .select(`
        id, activity_id, score, teacher_feedback, submitted_at,
        unit_activities!inner (
          id, title, type, unit_id,
          units!inner (id, title, annual_plan_id,
            annual_plans!inner (id, class_id, subject_id,
              subjects (id, name, code),
              classes (id, name, grade)))
        )
      `)
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false });
    if (e1) throw e1;

    return (subs || []).map(s => {
      const act = s.unit_activities;
      const unit = act?.units;
      const plan = unit?.annual_plans;
      return {
        id: s.id,
        submission_id: s.id,
        activity_id: s.activity_id,
        score: s.score,
        feedback: s.teacher_feedback,
        submitted_at: s.submitted_at,
        gradedAt: s.submitted_at,   // fallback karena submissions tidak punya graded_at
        subject: plan?.subjects || null,
        classInfo: plan?.classes || null,
        activities: act ? {
          id: act.id,
          title: act.title,
          type: act.type,
          units: unit ? {
            id: unit.id,
            title: unit.title,
            annual_plans: plan ? {
              id: plan.id,
              class_id: plan.class_id,
              subject_id: plan.subject_id,
              subjects: plan.subjects,
              classes: plan.classes
            } : null
          } : null
        } : null
      };
    });
  }, { ttl: 5 * 60 * 1000, forceRefresh });
}

/* ============================================================
   PROGRESS SISWA (per mapel — untuk dashboard)
   Return: [{ subject, classInfo, totalActivities, submitted,
              graded, percent, avgScore }]
   ============================================================ */

async function getMyProgress(studentId, forceRefresh = false) {
  return cache.fetch(`my_progress_${studentId}`, async () => {
    const client = initSupabase();

    // Kelas yang diikuti
    const { data: enrolls, error: e1 } = await client.from('enrollments')
      .select('class_id, classes (id, name)')
      .eq('student_id', studentId).eq('status', 'active');
    if (e1) throw e1;
    if (!enrolls || enrolls.length === 0) return [];

    const classIds = enrolls.map(e => e.class_id);

    // teacher_assign untuk kelas-kelas itu
    const { data: assigns, error: e2 } = await client.from('teacher_assign')
      .select(`subject_id, class_id, subjects (id, name, code), classes (id, name)`)
      .in('class_id', classIds);
    if (e2) throw e2;

    const result = [];

    for (const a of (assigns || [])) {
      if (!a.subjects || !a.classes) continue;

      // Aktivitas di mapel + kelas ini
      const { data: acts } = await client.from('unit_activities')
        .select(`
          id,
          units!inner (id, status, annual_plan_id,
            annual_plans!inner (class_id, subject_id))
        `)
        .eq('units.status', 'published')
        .eq('units.annual_plans.class_id', a.class_id)
        .eq('units.annual_plans.subject_id', a.subject_id);
      const actIds = (acts || []).map(x => x.id);

      if (actIds.length === 0) {
        result.push({
          subject: a.subjects,
          classInfo: a.classes,
          totalActivities: 0,
          submitted: 0,
          graded: 0,
          percent: 0,
          avgScore: '-'
        });
        continue;
      }

      // Submission siswa
      const { data: subs } = await client.from('submissions')
        .select('id, activity_id, score')
        .eq('student_id', studentId)
        .in('activity_id', actIds);

      const submitted = (subs || []).length;
      const gradedSubs = (subs || []).filter(s => s.score !== null && s.score !== undefined);
      const graded = gradedSubs.length;
      const totalScore = gradedSubs.reduce((s, g) => s + parseFloat(g.score || 0), 0);
      const avgScore = graded > 0 ? (totalScore / graded).toFixed(1) : '-';
      const percent = Math.round((submitted / actIds.length) * 100);

      result.push({
        subject: a.subjects,
        classInfo: a.classes,
        totalActivities: actIds.length,
        submitted,
        graded,
        percent,
        avgScore
      });
    }

    return result;
  }, { ttl: 5 * 60 * 1000, forceRefresh });
}

// ============================================
// END OF FILE
// ============================================

// ============================================
// END OF FILE — AUTO-GENERATED
// ============================================
