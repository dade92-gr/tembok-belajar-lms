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