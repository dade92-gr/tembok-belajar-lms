// assets/js/db/_15-components.js
// Activity components (31 tipe komponen)

async function getActivityComponents(activityId, forceRefresh = false) {
  return cache.fetch(`components_${activityId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('activity_components')
      .select('*').eq('activity_id', activityId)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return data || [];
  }, { ttl: 12 * 60 * 60 * 1000, forceRefresh });
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
  cache.remove(`components_${activityId}`);
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
  cache.clearByPrefix('components_');
  return data;
}

async function deleteActivityComponent(id) {
  const client = initSupabase();
  const { error } = await client.from('activity_components').delete().eq('id', id);
  if (error) throw error;
  cache.clearByPrefix('components_');
}

async function reorderActivityComponents(items) {
  const client = initSupabase();
  const promises = items.map(it =>
    client.from('activity_components').update({ order_index: it.order_index }).eq('id', it.id)
  );
  const results = await Promise.all(promises);
  const firstErr = results.find(r => r.error);
  if (firstErr) throw firstErr.error;
  cache.clearByPrefix('components_');
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
  cache.clearByPrefix('components_');
  return data || [];
}