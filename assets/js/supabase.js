// ============================================
// SUPABASE CLIENT & HELPER — TEMBOK BELAJAR
// v2.0 — Tambah modul Guru (Units/Assessments)
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

  if (roles.length === 0 && profile.role) {
    activeRole = { role: profile.role, school_id: profile.school_id };
  }

  return {
    ...profile,
    roles: roles.length > 0 ? roles : [{ role: profile.role, school_id: profile.school_id }],
    activeRole,
    role: activeRole?.role || profile.role,
    school_id: activeRole?.school_id ?? profile.school_id
  };
}

async function doLogout() {
  const client = initSupabase();
  await client.auth.signOut();
  sessionStorage.clear();
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
    showRolePicker(profile.roles, base);
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

function showRolePicker(roles, base) {
  const old = document.getElementById('rolePickerModal');
  if (old) old.remove();

const roleLabels = {
  admin: { label: 'Super Admin', icon: 'fa-crown', color: '#8b5cf6', desc: 'Kelola semua sekolah' },
  operator: { label: 'Operator', icon: 'fa-user-shield', color: '#3b82f6', desc: 'Kelola guru, siswa, kelas, mapel' },
  guru: { label: 'Guru', icon: 'fa-chalkboard-teacher', color: '#10b981', desc: 'Kelola materi, aktivitas, nilai' },
  wali_kelas: { label: 'Wali Kelas', icon: 'fa-users-rectangle', color: '#ec4899', desc: 'Pantau siswa, nilai, dan forum kelas walian' },
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
        school_id: matchingRole.school_id
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
   GURU — Multi-Role Aware
   ============================================================ */
async function getTeachers(schoolId) {
  const client = initSupabase();

  let roleQuery = client
    .from('user_roles')
    .select('user_id')
    .eq('role', 'guru')
    .eq('status', 'active');
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
   SISWA — Multi-Role Aware
   ============================================================ */
async function getStudents(schoolId) {
  const client = initSupabase();

  let roleQuery = client
    .from('user_roles')
    .select('user_id')
    .eq('role', 'siswa')
    .eq('status', 'active');
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
  return [...map.values()].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );
}

async function updateStudent(id, { name, email }) {
  const client = initSupabase();
  const { data, error } = await client.from('profiles')
    .update({ name, email }).eq('id', id).select().single();
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
    .select(`id, subject_id, class_id, school_id, created_at, subjects (id, name, code), classes (id, name, grade, room)`)
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
    .select(`id, student_id, status, profiles!enrollments_student_id_fkey (id, name, email, status, nisn, nis, nik, jenis_kelamin, tempat_lahir, tanggal_lahir, agama, alamat, no_hp, nama_ayah, nama_ibu, nama_wali)`)
    .eq('class_id', classId).eq('status', 'active');
  if (error) throw error;
  return data || [];
}

/* ============================================================
   PAGES & BLOCKS (legacy — dipakai wali-kelas/rapor)
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
   AKTIVITAS (legacy)
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
   SUBMISSIONS & GRADES (legacy — dipakai wali-kelas/rapor)
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
   FORUM (legacy — class+subject)
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
   PROGRESS SISWA (legacy — dipakai wali-kelas)
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

/* ============================================================
   WALI KELAS — Homeroom Teachers (Many-to-Many)
   ============================================================ */

async function getHomeroomAssignments(schoolId) {
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
    .eq('teacher_id', teacherId)
    .eq('status', 'active');
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
    .insert([{ 
      teacher_id: teacherId, 
      class_id: classId, 
      school_id: schoolId, 
      status: 'active' 
    }])
    .select()
    .single();
  if (assignErr) throw assignErr;

  let roleAdded = false;
  try {
    const { data: existing } = await client
      .from('user_roles')
      .select('id, status')
      .eq('user_id', teacherId)
      .eq('role', 'wali_kelas')
      .eq('school_id', schoolId)
      .maybeSingle();

    if (existing) {
      if (existing.status !== 'active') {
        await client.from('user_roles')
          .update({ status: 'active' })
          .eq('id', existing.id);
        roleAdded = true;
      }
    } else {
      const { error: roleErr } = await client.from('user_roles').insert([{
        user_id: teacherId,
        role: 'wali_kelas',
        school_id: schoolId,
        status: 'active'
      }]);
      if (roleErr) throw roleErr;
      roleAdded = true;
    }
  } catch (e) {
    console.warn('Gagal upsert role wali_kelas (assignment tetap tersimpan):', e);
  }

  return { assignment, roleAdded };
}

async function removeHomeroomAssignment(assignmentId, teacherId, schoolId) {
  const client = initSupabase();

  const { error: delErr } = await client
    .from('homeroom_teachers')
    .delete()
    .eq('id', assignmentId);
  if (delErr) throw delErr;

  let roleDeactivated = false;
  try {
    const { data: remaining } = await client
      .from('homeroom_teachers')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .limit(1);

    if (!remaining || remaining.length === 0) {
      await client.from('user_roles')
        .update({ status: 'inactive' })
        .eq('user_id', teacherId)
        .eq('role', 'wali_kelas')
        .eq('school_id', schoolId);
      roleDeactivated = true;
    }
  } catch (e) {
    console.warn('Gagal update status role wali_kelas (assignment sudah dihapus):', e);
  }

  return { success: true, roleDeactivated };
}

async function getMyHomeroomClasses(teacherId) {
  const client = initSupabase();
  const { data, error } = await client
    .from('homeroom_teachers')
    .select(`id, class_id, classes (id, name, grade, room)`)
    .eq('teacher_id', teacherId)
    .eq('status', 'active');
  if (error) throw error;
  return (data || []).map(r => ({
    assignment_id: r.id,
    class_id: r.class_id,
    class_name: r.classes?.name || '-',
    grade: r.classes?.grade,
    room: r.classes?.room
  }));
}

/* ============================================================
   ============================================================
   MODUL GURU — NEW SYSTEM (v2.0)
   Annual Plan → Learning Objectives → Units → Activities
   → Components → Assessments → Submissions → Grades
   ============================================================
   ============================================================ */

/* ---------- ANNUAL PLANS ---------- */

async function getMyAnnualPlans(teacherId) {
  const client = initSupabase();
  const { data, error } = await client.from('annual_plans')
    .select(`
      id, teacher_id, subject_id, class_id, academic_year, semester, cp_text, created_at,
      subjects (id, name, code),
      classes (id, name, grade, room)
    `)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getAnnualPlanById(id) {
  const client = initSupabase();
  const { data, error } = await client.from('annual_plans')
    .select(`
      id, teacher_id, subject_id, class_id, academic_year, semester, cp_text, created_at,
      subjects (id, name, code),
      classes (id, name, grade, room)
    `)
    .eq('id', id).single();
  if (error) throw error;
  return data;
}

async function createAnnualPlan({ teacherId, subjectId, classId, academicYear, semester, cpText }) {
  const client = initSupabase();
  const { data, error } = await client.from('annual_plans')
    .insert([{
      teacher_id: teacherId,
      subject_id: subjectId,
      class_id: classId,
      academic_year: academicYear,
      semester: semester,
      cp_text: cpText || null
    }]).select().single();
  if (error) throw error;
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
  return data;
}

async function deleteAnnualPlan(id) {
  const client = initSupabase();
  const { error } = await client.from('annual_plans').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- LEARNING OBJECTIVES (TP) ---------- */

async function getLearningObjectives(annualPlanId) {
  const client = initSupabase();
  const { data, error } = await client.from('learning_objectives')
    .select('*').eq('annual_plan_id', annualPlanId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data || [];
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
  return data;
}

async function deleteLearningObjective(id) {
  const client = initSupabase();
  const { error } = await client.from('learning_objectives').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- UNITS ---------- */

async function getUnits(annualPlanId) {
  const client = initSupabase();
  const { data, error } = await client.from('units')
    .select('*').eq('annual_plan_id', annualPlanId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getUnitsPublishedByClass(classId) {
  const client = initSupabase();
  const { data, error } = await client.from('units')
    .select(`
      id, annual_plan_id, title, description, kktp_type, kktp_config, status, created_at,
      annual_plans!inner (id, class_id, subject_id, academic_year, semester, subjects (id, name, code))
    `)
    .eq('status', 'published')
    .eq('annual_plans.class_id', classId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getUnitById(id) {
  const client = initSupabase();
  const { data, error } = await client.from('units')
    .select(`
      *,
      annual_plans (id, teacher_id, subject_id, class_id, academic_year, semester, cp_text,
        subjects (id, name, code), classes (id, name, grade, room))
    `)
    .eq('id', id).single();
  if (error) throw error;
  return data;
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
  return data;
}

async function updateUnitStatus(id, status) {
  const client = initSupabase();
  const { data, error } = await client.from('units')
    .update({ status }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteUnit(id) {
  const client = initSupabase();
  const { error } = await client.from('units').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- UNIT OBJECTIVES (relasi Unit ↔ TP) ---------- */

async function getUnitObjectives(unitId) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_objectives')
    .select(`id, unit_id, objective_id, learning_objectives (id, code, description, order_index)`)
    .eq('unit_id', unitId);
  if (error) throw error;
  return data || [];
}

async function addUnitObjective({ unitId, objectiveId }) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_objectives')
    .insert([{ unit_id: unitId, objective_id: objectiveId }]).select().single();
  if (error) throw error;
  return data;
}

async function removeUnitObjective(id) {
  const client = initSupabase();
  const { error } = await client.from('unit_objectives').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- UNIT ACTIVITIES ---------- */

async function getUnitActivities(unitId) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_activities')
    .select('*').eq('unit_id', unitId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getActivityById(id) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_activities')
    .select(`*, units (id, title, annual_plan_id, annual_plans (id, teacher_id, subject_id, class_id))`)
    .eq('id', id).single();
  if (error) throw error;
  return data;
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
  return data;
}

async function deleteUnitActivity(id) {
  const client = initSupabase();
  const { error } = await client.from('unit_activities').delete().eq('id', id);
  if (error) throw error;
}

async function reorderUnitActivities(items) {
  const client = initSupabase();
  const promises = items.map(it =>
    client.from('unit_activities').update({ order_index: it.order_index }).eq('id', it.id)
  );
  const results = await Promise.all(promises);
  const firstErr = results.find(r => r.error);
  if (firstErr) throw firstErr.error;
  return true;
}

/* ---------- ACTIVITY COMPONENTS (Page Builder) ---------- */

async function getActivityComponents(activityId) {
  const client = initSupabase();
  const { data, error } = await client.from('activity_components')
    .select('*').eq('activity_id', activityId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data || [];
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
  return data;
}

async function deleteActivityComponent(id) {
  const client = initSupabase();
  const { error } = await client.from('activity_components').delete().eq('id', id);
  if (error) throw error;
}

async function reorderActivityComponents(items) {
  const client = initSupabase();
  const promises = items.map(it =>
    client.from('activity_components').update({ order_index: it.order_index }).eq('id', it.id)
  );
  const results = await Promise.all(promises);
  const firstErr = results.find(r => r.error);
  if (firstErr) throw firstErr.error;
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
  return data || [];
}

/* ---------- ASSESSMENTS ---------- */

async function getAssessmentsByUnit(unitId) {
  const client = initSupabase();
  const { data, error } = await client.from('assessments')
    .select('*').eq('unit_id', unitId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getAssessmentByActivity(activityId) {
  const client = initSupabase();
  const { data, error } = await client.from('assessments')
    .select('*').eq('activity_id', activityId).maybeSingle();
  if (error) throw error;
  return data;
}

async function createAssessment({ unitId, activityId, title, description, type, durationMinutes, dueDate, autoGrade }) {
  const client = initSupabase();
  const { data, error } = await client.from('assessments')
    .insert([{
      unit_id: unitId || null,
      activity_id: activityId || null,
      title,
      description: description || null,
      type: type || null,
      duration_minutes: durationMinutes || null,
      due_date: dueDate || null,
      auto_grade: autoGrade !== undefined ? autoGrade : false
    }]).select().single();
  if (error) throw error;
  return data;
}

async function updateAssessment(id, updates) {
  const client = initSupabase();
  const payload = {};
  ['title','description','type','duration_minutes','due_date','auto_grade'].forEach(k => {
    if (updates[k] !== undefined) payload[k] = updates[k];
  });
  const { data, error } = await client.from('assessments')
    .update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteAssessment(id) {
  const client = initSupabase();
  const { error } = await client.from('assessments').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- ASSESSMENT QUESTIONS ---------- */

async function getAssessmentQuestions(assessmentId) {
  const client = initSupabase();
  const { data, error } = await client.from('assessment_questions')
    .select('*').eq('assessment_id', assessmentId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function createAssessmentQuestion({ assessmentId, questionType, questionText, points, orderIndex, options, correctAnswer, feedbackText }) {
  const client = initSupabase();
  let nextOrder = orderIndex;
  if (nextOrder === undefined || nextOrder === null) {
    const { data: last } = await client.from('assessment_questions')
      .select('order_index').eq('assessment_id', assessmentId)
      .order('order_index', { ascending: false }).limit(1);
    nextOrder = (last && last[0] ? last[0].order_index : 0) + 1;
  }
  const { data, error } = await client.from('assessment_questions')
    .insert([{
      assessment_id: assessmentId,
      question_type: questionType,
      question_text: questionText,
      points: points || 0,
      order_index: nextOrder,
      options: options || null,
      correct_answer: correctAnswer || null,
      feedback_text: feedbackText || null
    }]).select().single();
  if (error) throw error;
  return data;
}

async function updateAssessmentQuestion(id, updates) {
  const client = initSupabase();
  const payload = {};
  ['question_type','question_text','points','order_index','options','correct_answer','feedback_text'].forEach(k => {
    if (updates[k] !== undefined) payload[k] = updates[k];
  });
  const { data, error } = await client.from('assessment_questions')
    .update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteAssessmentQuestion(id) {
  const client = initSupabase();
  const { error } = await client.from('assessment_questions').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- SUBMISSIONS ---------- */

async function getSubmissionsByAssessment(assessmentId) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions')
    .select(`
      id, assessment_id, activity_id, student_id, status, answers, score, teacher_feedback, submitted_at, created_at,
      profiles!submissions_student_id_fkey (id, name, email, nisn)
    `)
    .eq('assessment_id', assessmentId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getSubmissionsByActivity(activityId) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions')
    .select(`
      id, assessment_id, activity_id, student_id, status, answers, score, teacher_feedback, submitted_at, created_at,
      profiles!submissions_student_id_fkey (id, name, email, nisn)
    `)
    .eq('activity_id', activityId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getSubmissionById(id) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions')
    .select(`
      *,
      profiles!submissions_student_id_fkey (id, name, email, nisn),
      assessments (id, title, type, duration_minutes, due_date, auto_grade)
    `)
    .eq('id', id).single();
  if (error) throw error;
  return data;
}

async function getSubmissionsByStudent(studentId) {
  const client = initSupabase();
  const { data, error } = await client.from('submissions')
    .select(`
      id, assessment_id, activity_id, status, answers, score, teacher_feedback, submitted_at,
      assessments (id, title, type, unit_id)
    `)
    .eq('student_id', studentId)
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
    return data;
  } else {
    const { data, error } = await client.from('submissions')
      .insert([{ assessment_id: assessmentId, student_id: studentId, answers, status: 'submitted' }])
      .select().single();
    if (error) throw error;
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
    return data;
  } else {
    const { data, error } = await client.from('submissions')
      .insert([{ activity_id: activityId, student_id: studentId, answers, status: 'submitted' }])
      .select().single();
    if (error) throw error;
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
  return data;
}

/* ---------- GRADES (opsional tabel terpisah) ---------- */

async function getGradesByStudent(studentId) {
  const client = initSupabase();
  const { data, error } = await client.from('grades')
    .select(`
      id, submission_id, student_id, score, feedback, graded_by, graded_at,
      submissions (id, assessment_id, activity_id)
    `)
    .eq('student_id', studentId)
    .order('graded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/* ---------- REFLECTIONS ---------- */

async function getReflectionsByActivity(activityId) {
  const client = initSupabase();
  const { data, error } = await client.from('reflections')
    .select(`
      id, activity_id, student_id, answers, submitted_at, created_at,
      profiles!reflections_student_id_fkey (id, name, email)
    `)
    .eq('activity_id', activityId)
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
      activity_id: activityId,
      student_id: studentId,
      answers,
      submitted_at: new Date().toISOString()
    }], { onConflict: 'activity_id,student_id' }).select().single();
  if (error) throw error;
  return data;
}

async function deleteReflection(id) {
  const client = initSupabase();
  const { error } = await client.from('reflections').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- FORUM (Unit & Activity) ---------- */

async function getForumPostsByUnit(unitId) {
  const client = initSupabase();
  const { data, error } = await client.from('forum_posts')
    .select(`
      id, unit_id, activity_id, class_id, subject_id, title, body, parent_id, created_at, author_id,
      profiles!forum_posts_author_id_fkey (id, name, role)
    `)
    .eq('unit_id', unitId).is('parent_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getForumPostsByActivity(activityId) {
  const client = initSupabase();
  const { data, error } = await client.from('forum_posts')
    .select(`
      id, unit_id, activity_id, class_id, subject_id, title, body, parent_id, created_at, author_id,
      profiles!forum_posts_author_id_fkey (id, name, role)
    `)
    .eq('activity_id', activityId).is('parent_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createUnitForumPost({ unitId, activityId, classId, subjectId, authorId, title, body, parentId }) {
  const client = initSupabase();
  const { data, error } = await client.from('forum_posts')
    .insert([{
      unit_id: unitId || null,
      activity_id: activityId || null,
      class_id: classId || null,
      subject_id: subjectId || null,
      author_id: authorId,
      title,
      body: body || null,
      parent_id: parentId || null
    }]).select().single();
  if (error) throw error;
  return data;
}

/* ---------- PROGRESS (Unit/Activity) ---------- */

async function getProgressByStudent(studentId) {
  const client = initSupabase();
  const { data, error } = await client.from('progress')
    .select(`
      id, student_id, unit_id, activity_id, status, completed_at,
      units (id, title),
      unit_activities (id, title, type)
    `)
    .eq('student_id', studentId)
    .order('completed_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

async function getProgressByUnit(unitId) {
  const client = initSupabase();
  const { data, error } = await client.from('progress')
    .select(`
      id, student_id, unit_id, activity_id, status, completed_at,
      profiles!progress_student_id_fkey (id, name, email),
      unit_activities (id, title, type)
    `)
    .eq('unit_id', unitId)
    .order('student_id', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getProgressByActivity(activityId) {
  const client = initSupabase();
  const { data, error } = await client.from('progress')
    .select(`
      id, student_id, unit_id, activity_id, status, completed_at,
      profiles!progress_student_id_fkey (id, name, email)
    `)
    .eq('activity_id', activityId)
    .order('student_id', { ascending: true });
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

async function getStudentProgressSummary(studentId, annualPlanId) {
  const client = initSupabase();
  // Ambil semua unit di annual_plan
  const units = await getUnits(annualPlanId);
  if (units.length === 0) return { units: [], summary: { total: 0, completed: 0, percent: 0 } };

  const unitIds = units.map(u => u.id);
  const { data: acts } = await client.from('unit_activities')
    .select('id, unit_id').in('unit_id', unitIds);
  const actIds = (acts || []).map(a => a.id);

  let progressRows = [];
  if (actIds.length > 0) {
    const { data } = await client.from('progress')
      .select('activity_id, status, completed_at')
      .eq('student_id', studentId).in('activity_id', actIds);
    progressRows = data || [];
  }

  const progressMap = {};
  progressRows.forEach(p => { progressMap[p.activity_id] = p; });

  const byUnit = units.map(u => {
    const unitActs = (acts || []).filter(a => a.unit_id === u.id);
    const completed = unitActs.filter(a => progressMap[a.id]?.status === 'completed').length;
    return {
      unit: u,
      totalActivities: unitActs.length,
      completed,
      percent: unitActs.length > 0 ? Math.round((completed / unitActs.length) * 100) : 0
    };
  });

  const total = (acts || []).length;
  const completed = progressRows.filter(p => p.status === 'completed').length;
  return {
    units: byUnit,
    summary: {
      total,
      completed,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  };
}

/* ---------- CUSTOM COMPONENTS ---------- */

async function getMyCustomComponents() {
  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];
  const { data, error } = await client.from('custom_components')
    .select('*').eq('created_by', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createCustomComponent({ name, componentSchema, isPublic }) {
  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Tidak terautentikasi');

  const { data: profile } = await client.from('profiles')
    .select('school_id').eq('id', user.id).single();

  const { data, error } = await client.from('custom_components')
    .insert([{
      name,
      component_schema: componentSchema,
      created_by: user.id,
      school_id: profile?.school_id || null,
      is_public: isPublic || false
    }]).select().single();
  if (error) throw error;
  return data;
}

async function updateCustomComponent(id, updates) {
  const client = initSupabase();
  const payload = {};
  ['name','component_schema','is_public'].forEach(k => {
    if (updates[k] !== undefined) payload[k] = updates[k];
  });
  payload.updated_at = new Date().toISOString();
  const { data, error } = await client.from('custom_components')
    .update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteCustomComponent(id) {
  const client = initSupabase();
  const { error } = await client.from('custom_components').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- DASHBOARD GURU ---------- */

async function getTeacherDashboardStats(teacherId) {
  const client = initSupabase();

  // Annual plans
  const plans = await getMyAnnualPlans(teacherId);
  const planIds = plans.map(p => p.id);

  // Units
  let units = [];
  if (planIds.length > 0) {
    const { data } = await client.from('units')
      .select('id, title, status, annual_plan_id')
      .in('annual_plan_id', planIds);
    units = data || [];
  }
  const unitIds = units.map(u => u.id);

  // Activities
  let activities = [];
  if (unitIds.length > 0) {
    const { data } = await client.from('unit_activities')
      .select('id, title, type, unit_id').in('unit_id', unitIds);
    activities = data || [];
  }
  const activityIds = activities.map(a => a.id);

  // Pending submissions (belum dinilai)
  let pendingSubs = [];
  if (activityIds.length > 0) {
    const { data } = await client.from('submissions')
      .select('id, activity_id, assessment_id, status, submitted_at, student_id, profiles!submissions_student_id_fkey (name)')
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
}
/* ============================================================
   MULTI-KELAS UNIT (v3.0)
   ============================================================ */

// Ambil daftar kelas yang terkait dengan unit
async function getUnitClasses(unitId) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_classes')
    .select(`
      id, unit_id, class_id, is_published, published_at,
      classes (id, name, grade, room)
    `)
    .eq('unit_id', unitId)
    .order('added_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Set kelas untuk unit (tambah/hapus). classIds = array of class_id final
async function setUnitClasses(unitId, classIds) {
  const client = initSupabase();

  // Ambil yang ada sekarang
  const { data: existing, error: e1 } = await client.from('unit_classes')
    .select('id, class_id').eq('unit_id', unitId);
  if (e1) throw e1;

  const existingClassIds = new Set((existing || []).map(r => String(r.class_id)));
  const targetClassIds = new Set(classIds.map(String));

  // Kelas yang perlu ditambah
  const toAdd = [...targetClassIds].filter(id => !existingClassIds.has(id));
  // Kelas yang perlu dihapus
  const toRemove = (existing || []).filter(r => !targetClassIds.has(String(r.class_id)));

  // Tambah
  if (toAdd.length > 0) {
    const rows = toAdd.map(cid => ({ unit_id: unitId, class_id: parseInt(cid) }));
    const { error } = await client.from('unit_classes').insert(rows);
    if (error) throw error;
  }
  // Hapus
  if (toRemove.length > 0) {
    const ids = toRemove.map(r => r.id);
    const { error } = await client.from('unit_classes').delete().in('id', ids);
    if (error) throw error;
  }

  return { added: toAdd.length, removed: toRemove.length };
}

// Publish unit ke kelas tertentu (snapshot konten saat ini)
// snapshot = { activities: [...], components: { activityId: [...] } }
async function publishUnitToClasses(unitId, classIds, snapshot) {
  const client = initSupabase();
  const now = new Date().toISOString();
  const payload = {
    published_version: snapshot,
    published_at: now,
    is_published: true
  };
  const { data, error } = await client.from('unit_classes')
    .update(payload)
    .eq('unit_id', unitId)
    .in('class_id', classIds.map(c => parseInt(c)))
    .select();
  if (error) throw error;

  // Update status units ke published (kalau belum)
  await client.from('units').update({ status: 'published' }).eq('id', unitId);
  return data || [];
}

// Unpublish dari kelas tertentu
async function unpublishUnitFromClasses(unitId, classIds) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_classes')
    .update({ is_published: false })
    .eq('unit_id', unitId)
    .in('class_id', classIds.map(c => parseInt(c)))
    .select();
  if (error) throw error;

  // Cek apakah masih ada kelas yang published
  const { data: remaining } = await client.from('unit_classes')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', unitId).eq('is_published', true);

  if (!remaining || remaining.length === 0) {
    await client.from('units').update({ status: 'draft' }).eq('id', unitId);
  }
  return data || [];
}

// Ambil snapshot published untuk kelas tertentu (dipakai siswa/preview)
async function getPublishedUnitForClass(unitId, classId) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_classes')
    .select('published_version, published_at, is_published')
    .eq('unit_id', unitId)
    .eq('class_id', classId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Simpan snapshot saat ini ke units.current_version
async function saveUnitDraft(unitId, snapshot) {
  const client = initSupabase();
  const { data, error } = await client.from('units')
    .update({ current_version: snapshot })
    .eq('id', unitId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Ambil unit dengan kelas + snapshot
async function getUnitWithClasses(unitId) {
  const client = initSupabase();
  const unit = await getUnitById(unitId);
  const classes = await getUnitClasses(unitId);
  return { ...unit, classes };
}

// Duplikasi unit (full copy: unit + activities + components) ke kelas baru
async function duplicateUnit(sourceUnitId, targetClassIds) {
  const client = initSupabase();

  // 1. Ambil unit sumber
  const sourceUnit = await getUnitById(sourceUnitId);
  if (!sourceUnit) throw new Error('Unit sumber tidak ditemukan');

  // 2. Ambil activities + components
  const sourceActs = await getUnitActivities(sourceUnitId);
  const compMap = {};
  for (const act of sourceActs) {
    compMap[act.id] = await getActivityComponents(act.id);
  }

  // 3. Buat unit baru (untuk annual_plan pertama dari target)
  //    Ambil annual_plan untuk target kelas pertama
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

  // 4. Insert unit baru
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

  // 5. Copy activities + components
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

  // 6. Set unit_classes untuk semua target kelas
  await setUnitClasses(newUnit.id, targetClassIds);

  return newUnit;
}