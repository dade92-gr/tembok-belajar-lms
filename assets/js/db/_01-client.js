// assets/js/db/_01-client.js
// Supabase client initialization

let supabaseClient = null;

function initSupabase() {
  if (supabaseClient) return supabaseClient;
  if (typeof supabase === 'undefined') {
    console.error('Supabase library belum dimuat!');
    return null;
  }
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
    console.error('config.js belum dimuat!');
    return null;
  }
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

function getSupabase() {
  if (!supabaseClient) return initSupabase();
  return supabaseClient;
}