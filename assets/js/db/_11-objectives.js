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