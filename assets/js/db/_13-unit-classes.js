// assets/js/db/_13-unit-classes.js
// Multi-kelas unit + publish

async function getUnitClasses(unitId, forceRefresh = false) {
  return cache.fetch(`unit_classes_${unitId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('unit_classes').select(`
      id, unit_id, class_id, is_published, published_at,
      classes (id, name, grade, room)
    `).eq('unit_id', unitId).order('added_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }, { ttl: 12 * 60 * 60 * 1000, forceRefresh });
}

async function setUnitClasses(unitId, classIds) {
  const client = initSupabase();
  const { data: existing, error: e1 } = await client.from('unit_classes')
    .select('id, class_id').eq('unit_id', unitId);
  if (e1) throw e1;

  const existingClassIds = new Set((existing || []).map(r => String(r.class_id)));
  const targetClassIds = new Set(classIds.map(String));

  const toAdd = [...targetClassIds].filter(id => !existingClassIds.has(id));
  const toRemove = (existing || []).filter(r => !targetClassIds.has(String(r.class_id)));

  if (toAdd.length > 0) {
    const rows = toAdd.map(cid => ({ unit_id: unitId, class_id: parseInt(cid) }));
    const { error } = await client.from('unit_classes').insert(rows);
    if (error) throw error;
  }
  if (toRemove.length > 0) {
    const ids = toRemove.map(r => r.id);
    const { error } = await client.from('unit_classes').delete().in('id', ids);
    if (error) throw error;
  }

  cache.remove(`unit_classes_${unitId}`);
  return { added: toAdd.length, removed: toRemove.length };
}

async function publishUnitToClasses(unitId, classIds, snapshot) {
  const client = initSupabase();
  const now = new Date().toISOString();
  const parsedClassIds = classIds.map(c => parseInt(c));

  const { data: existing, error: e1 } = await client.from('unit_classes')
    .select('id, class_id').eq('unit_id', unitId);
  if (e1) throw e1;

  const existingClassIds = new Set((existing || []).map(r => String(r.class_id)));
  const toInsert = parsedClassIds.filter(cid => !existingClassIds.has(String(cid)));

  if (toInsert.length > 0) {
    const insertRows = toInsert.map(cid => ({ unit_id: unitId, class_id: cid }));
    const { error: e2 } = await client.from('unit_classes').insert(insertRows);
    if (e2) throw e2;
  }

  const payload = {
    published_version: snapshot,
    published_at: now,
    is_published: true
  };
  const { data, error: e3 } = await client.from('unit_classes')
    .update(payload).eq('unit_id', unitId).in('class_id', parsedClassIds).select();
  if (e3) throw e3;

  await client.from('units').update({ status: 'published' }).eq('id', unitId);

  cache.remove(`unit_classes_${unitId}`);
  cache.remove(`unit_${unitId}`);
  cache.clearByPrefix('units_pub_class_');
  return data || [];
}

async function unpublishUnitFromClasses(unitId, classIds) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_classes')
    .update({ is_published: false })
    .eq('unit_id', unitId).in('class_id', classIds.map(c => parseInt(c))).select();
  if (error) throw error;

  const { data: remaining } = await client.from('unit_classes')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', unitId).eq('is_published', true);
  if (!remaining || remaining.length === 0) {
    await client.from('units').update({ status: 'draft' }).eq('id', unitId);
  }
  cache.remove(`unit_classes_${unitId}`);
  cache.clearByPrefix('units_pub_class_');
  return data || [];
}

async function getPublishedUnitForClass(unitId, classId) {
  const client = initSupabase();
  const { data, error } = await client.from('unit_classes')
    .select('published_version, published_at, is_published')
    .eq('unit_id', unitId).eq('class_id', classId).maybeSingle();
  if (error) throw error;
  return data;
}

async function saveUnitDraft(unitId, snapshot) {
  const client = initSupabase();
  const { data, error } = await client.from('units')
    .update({ current_version: snapshot }).eq('id', unitId).select().single();
  if (error) throw error;
  cache.remove(`unit_${unitId}`);
  return data;
}

async function getUnitWithClasses(unitId) {
  const unit = await getUnitById(unitId);
  const classes = await getUnitClasses(unitId);
  return { ...unit, classes };
}

async function duplicateUnit(sourceUnitId, targetClassIds) {
  const client = initSupabase();
  const sourceUnit = await getUnitById(sourceUnitId);
  if (!sourceUnit) throw new Error('Unit sumber tidak ditemukan');

  const sourceActs = await getUnitActivities(sourceUnitId);
  const compMap = {};
  for (const act of sourceActs) {
    compMap[act.id] = await getActivityComponents(act.id);
  }

  const firstClassId = parseInt(targetClassIds[0]);
  const { data: plans } = await client.from('annual_plans')
    .select('id')
    .eq('teacher_id', sourceUnit.annual_plans.teacher_id)
    .eq('subject_id', sourceUnit.annual_plans.subject_id)
    .eq('class_id', firstClassId)
    .limit(1);

  if (!plans || plans.length === 0) {
    throw new Error('Tidak ada annual_plan untuk kelas tujuan. Buat dulu perencanaan di kelas tersebut.');
  }
  const targetPlanId = plans[0].id;

  const { data: newUnit, error: e1 } = await client.from('units').insert([{
    annual_plan_id: targetPlanId,
    title: sourceUnit.title + ' (Copy)',
    description: sourceUnit.description,
    kktp_type: sourceUnit.kktp_type,
    kktp_config: sourceUnit.kktp_config,
    status: 'draft',
    current_version: sourceUnit.current_version || {}
  }]).select().single();
  if (e1) throw e1;

  for (const act of sourceActs) {
    const { data: newAct, error: e2 } = await client.from('unit_activities').insert([{
      unit_id: newUnit.id,
      title: act.title,
      type: act.type,
      order_index: act.order_index
    }]).select().single();
    if (e2) { console.error('copy act err', e2); continue; }

    const comps = compMap[act.id] || [];
    if (comps.length > 0) {
      const compRows = comps.map(c => ({
        activity_id: newAct.id,
        component_type: c.component_type,
        component_data: c.component_data,
        order_index: c.order_index
      }));
      await client.from('activity_components').insert(compRows);
    }
  }

  await setUnitClasses(newUnit.id, targetClassIds);

  cache.clearByPrefix('units_');
  cache.clearByPrefix('unit_acts_');
  cache.clearByPrefix('components_');
  cache.clearByPrefix('unit_classes_');
  return newUnit;
}