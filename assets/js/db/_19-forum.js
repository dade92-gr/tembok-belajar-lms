// assets/js/db/_19-forum.js
// Forum diskusi

async function getForumPostsByUnit(unitId) {
  const client = initSupabase();
  const { data, error } = await client.from('forum_posts').select(`
    id, unit_id, activity_id, class_id, subject_id, title, body, parent_id, created_at, author_id,
    profiles!forum_posts_author_id_fkey (id, name, role)
  `).eq('unit_id', unitId).is('parent_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getForumPostsByActivity(activityId) {
  const client = initSupabase();
  const { data, error } = await client.from('forum_posts').select(`
    id, unit_id, activity_id, class_id, subject_id, title, body, parent_id, created_at, author_id,
    profiles!forum_posts_author_id_fkey (id, name, role)
  `).eq('activity_id', activityId).is('parent_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createUnitForumPost({ unitId, activityId, classId, subjectId, authorId, title, body, parentId }) {
  const client = initSupabase();
  const { data, error } = await client.from('forum_posts')
    .insert([{
      unit_id: unitId || null, activity_id: activityId || null,
      class_id: classId || null, subject_id: subjectId || null,
      author_id: authorId, title, body: body || null, parent_id: parentId || null
    }]).select().single();
  if (error) throw error;
  return data;
}