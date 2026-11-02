// assets/js/db/_03-schools.js

async function getSchool(schoolId) {
  return cache.fetch(`school_${schoolId}`, async () => {
    const client = initSupabase();
    const { data, error } = await client.from('schools').select('*').eq('id', schoolId).single();
    if (error) throw error;
    return data;
  }, { ttl: 24 * 60 * 60 * 1000 });
}