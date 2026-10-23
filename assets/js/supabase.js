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

async function getProfile() {
  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from('profiles').select('*').eq('id', user.id).single();
  if (error) { console.error('getProfile error:', error); return null; }
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
   GURU
   ============================================================ */
async function getTeachers(schoolId) {
  const client = initSupabase();
  let q = client.from('profiles').select('*').eq('role', 'guru').order('name', { ascending: true });
  if (schoolId) q = q.eq('school_id', schoolId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function updateTeacher(id, { name, email }) {
  const client = initSupabase();
  const { data, error } = await client.from('profiles')
    .update({ name, email }).eq('id', id).eq('role', 'guru').select().single();
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
  // Join grades → submissions, filter by submissions.activity_id
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
    // CATATAN: kolom activity_id TIDAK ADA di tabel grades
    // Informasi aktivitas diturunkan dari submissions.activity_id
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

/* Ambil mapel & kelas yang diikuti siswa (dari enrollment + teacher_assign) */
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

/* Ambil aktivitas di kelas+mapel yang diikuti siswa + status submission-nya */
/* FIXED: tidak lagi pakai grades.activity_id — ambil dari submissions.activity_id */
async function getMyActivities(studentId, classId, subjectId) {
  const client = initSupabase();

  // Ambil semua aktivitas
  const { data: activities, error: e1 } = await client.from('activities')
    .select('*').eq('class_id', classId).eq('subject_id', subjectId)
    .order('deadline', { ascending: true });
  if (e1) throw e1;

  if (!activities || activities.length === 0) return [];

  const activityIds = activities.map(a => a.id);

  // Ambil submission siswa ini
  const { data: mySubs, error: e2 } = await client.from('submissions')
    .select('*').eq('student_id', studentId).in('activity_id', activityIds);
  if (e2) throw e2;

  // Ambil grades via JOIN ke submissions
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

/* Ambil nilai siswa (semua mapel) */
/* FIXED: tidak lagi join ke activities (tidak ada FK), ambil info activities terpisah */
async function getMyGrades(studentId) {
  const client = initSupabase();

  // Ambil semua grades siswa ini + submissions (untuk dapat activity_id)
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

  // Kumpulkan activity_id unik
  const activityIds = [...new Set(grades.map(g => g.activity_id).filter(id => id != null))];
  if (activityIds.length === 0) return grades.map(g => ({ ...g, activities: null }));

  // Ambil detail activities + subjects + classes terpisah
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

/* Submit tugas/kuis */
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

/* Progress belajar siswa per mapel */
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

    // Ambil grades via JOIN submissions
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