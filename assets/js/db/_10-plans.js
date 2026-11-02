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