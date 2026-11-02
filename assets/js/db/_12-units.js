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