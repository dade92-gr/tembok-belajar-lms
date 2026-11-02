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