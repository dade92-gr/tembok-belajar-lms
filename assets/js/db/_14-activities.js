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