// ============================================
// SUPABASE CLIENT & HELPER — TEMBOK BELAJAR
// ============================================

let supabaseClient = null;

/* Inisialisasi client Supabase (sekali saja) */
function initSupabase() {
  if (supabaseClient) return supabaseClient;
  if (typeof supabase === 'undefined') {
    console.error('Supabase library belum dimuat! Pastikan CDN ada di HTML.');
    return null;
  }
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

/* Ambil profil user yang sedang login */
async function getProfile() {
  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('getProfile error:', error);
    return null;
  }
  return data;
}

/* Logout & redirect ke halaman login */
async function doLogout() {
  const client = initSupabase();
  await client.auth.signOut();
  sessionStorage.clear();
  window.location.href = '../login.html';
}

/* Redirect ke dashboard sesuai role */
function redirectByRole(role) {
  const base = window.location.pathname.includes('/operator/')
    || window.location.pathname.includes('/guru/')
    || window.location.pathname.includes('/siswa/')
    ? '../' : '';

  if (role === 'operator') window.location.href = base + 'operator/dashboard.html';
  else if (role === 'guru') window.location.href = base + 'guru/dashboard.html';
  else if (role === 'siswa') window.location.href = base + 'siswa/dashboard.html';
  else window.location.href = base + 'login.html';
}

/* Proteksi halaman: harus login & role sesuai */
async function requireAuth(expectedRole) {
  const profile = await getProfile();
  if (!profile) {
    alert('Silakan login terlebih dahulu.');
    window.location.href = '../login.html';
    return null;
  }
  if (expectedRole && profile.role !== expectedRole) {
    alert('Anda tidak punya akses ke halaman ini.');
    redirectByRole(profile.role);
    return null;
  }
  return profile;
}