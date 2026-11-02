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