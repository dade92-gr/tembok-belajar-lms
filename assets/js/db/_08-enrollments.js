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