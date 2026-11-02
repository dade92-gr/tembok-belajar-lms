// assets/js/db/_02-auth.js
// Auth & multi-role

async function getUserRoles(userId) {
  const client = initSupabase();
  const { data, error } = await client
    .from('user_roles')
    .select(`id, role, school_id, status, schools (id, name)`)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('role', { ascending: true });

  if (error) {
    console.error('getUserRoles error:', error);
    return [];
  }
  return (data || []).map(r => ({
    id: r.id,
    role: r.role,
    school_id: r.school_id,
    status: r.status,
    school_name: r.schools?.name || null
  }));
}

async function getProfile() {
  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await client
    .from('profiles').select('*').eq('id', user.id).single();
  if (error) { console.error('getProfile error:', error); return null; }

  const roles = await getUserRoles(user.id);

  let activeRole = null;
  try {
    const stored = sessionStorage.getItem('active_role');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && roles.find(r =>
        r.role === parsed.role && String(r.school_id) === String(parsed.school_id)
      )) {
        activeRole = parsed;
      }
    }
  } catch (e) {}

  if (!activeRole && roles.length > 0) {
    activeRole = { role: roles[0].role, school_id: roles[0].school_id };
  }

  if (roles.length === 0 && profile.role) {
    activeRole = { role: profile.role, school_id: profile.school_id };
  }

  const resolvedRole = activeRole?.role || profile.role;
  const resolvedSchool = activeRole?.school_id ?? profile.school_id;

  try {
    sessionStorage.setItem('active_role', JSON.stringify({
      role: resolvedRole,
      school_id: resolvedSchool,
      user_id: user.id
    }));
  } catch (e) {}

  return {
    ...profile,
    roles: roles.length > 0 ? roles : [{ role: profile.role, school_id: profile.school_id }],
    activeRole: { role: resolvedRole, school_id: resolvedSchool },
    role: resolvedRole,
    school_id: resolvedSchool
  };
}

async function doLogout() {
  const client = initSupabase();
  try { cache.clearAll(); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  await client.auth.signOut();
  window.location.href = '../login.html';
}

function redirectByRole(roleOrProfile) {
  const profile = typeof roleOrProfile === 'string'
    ? { role: roleOrProfile, roles: [{ role: roleOrProfile, school_id: null, school_name: null }] }
    : roleOrProfile;

  const base = window.location.pathname.includes('/operator/')
    || window.location.pathname.includes('/guru/')
    || window.location.pathname.includes('/siswa/')
    || window.location.pathname.includes('/admin/')
    || window.location.pathname.includes('/wali-kelas/')
    ? '../' : '';

  if (profile.roles && profile.roles.length > 1) {
    showRolePicker(profile.roles, base, profile.id);
    return;
  }

  const role = profile.role;
  if (role === 'admin') window.location.href = base + 'admin/dashboard.html';
  else if (role === 'operator') window.location.href = base + 'operator/dashboard.html';
  else if (role === 'guru') window.location.href = base + 'guru/dashboard.html';
  else if (role === 'wali_kelas') window.location.href = base + 'wali-kelas/dashboard.html';
  else if (role === 'siswa') window.location.href = base + 'siswa/dashboard.html';
  else window.location.href = base + 'login.html';
}

function showRolePicker(roles, base, userId) {
  const old = document.getElementById('rolePickerModal');
  if (old) old.remove();

  const roleLabels = {
    admin: { label: 'Super Admin', icon: 'fa-crown', color: '#8b5cf6', desc: 'Kelola semua sekolah' },
    operator: { label: 'Operator', icon: 'fa-user-shield', color: '#3b82f6', desc: 'Kelola guru, siswa, kelas, mapel' },
    guru: { label: 'Guru', icon: 'fa-chalkboard-teacher', color: '#10b981', desc: 'Kelola materi, aktivitas, nilai' },
    wali_kelas: { label: 'Wali Kelas', icon: 'fa-users-rectangle', color: '#ec4899', desc: 'Pantau siswa, nilai, dan forum' },
    siswa: { label: 'Siswa', icon: 'fa-user-graduate', color: '#f59e0b', desc: 'Belajar, kerjakan tugas, lihat nilai' }
  };

  const modal = document.createElement('div');
  modal.id = 'rolePickerModal';
  modal.style.cssText = `position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.85);display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px);font-family:'Inter',-apple-system,sans-serif;`;

  const cards = roles.map(r => {
    const info = roleLabels[r.role] || { label: r.role, icon: 'fa-user', color: '#64748b', desc: '' };
    return `
      <div class="role-card" data-role="${r.role}" data-school="${r.school_id || ''}"
           style="background:white;border-radius:12px;padding:1.5rem 1.2rem;cursor:pointer;transition:all 0.2s;border:2px solid transparent;text-align:center;"
           onmouseover="this.style.borderColor='${info.color}';this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 20px rgba(0,0,0,0.1)'"
           onmouseout="this.style.borderColor='transparent';this.style.transform='none';this.style.boxShadow='none'">
        <div style="width:60px;height:60px;border-radius:16px;background:${info.color}20;color:${info.color};display:flex;align-items:center;justify-content:center;margin:0 auto 0.8rem;font-size:1.8rem;">
          <i class="fas ${info.icon}"></i>
        </div>
        <div style="font-weight:700;color:#0f172a;margin-bottom:0.3rem;font-size:0.95rem;">${info.label}</div>
        <div style="font-size:0.72rem;color:#64748b;margin-bottom:0.5rem;line-height:1.4;">${info.desc}</div>
        ${r.school_name ? `<div style="font-size:0.7rem;color:${info.color};font-weight:600;padding:3px 10px;background:${info.color}15;border-radius:8px;display:inline-block;"><i class="fas fa-school"></i> ${r.school_name}</div>` : '<div style="height:22px;"></div>'}
      </div>`;
  }).join('');

  modal.innerHTML = `
    <div style="background:#f8fafc;border-radius:20px;padding:2rem;max-width:720px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:white;display:inline-flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:0.8rem;">
          <i class="fas fa-users"></i>
        </div>
        <h2 style="font-size:1.3rem;color:#0f172a;margin-bottom:0.3rem;font-weight:800;">Pilih Peran</h2>
        <p style="font-size:0.85rem;color:#64748b;margin:0;">Pilih salah satu panel.</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.8rem;">${cards}</div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelectorAll('.role-card').forEach(card => {
    card.addEventListener('click', () => {
      const role = card.dataset.role;
      const schoolId = card.dataset.school ? parseInt(card.dataset.school) : null;
      sessionStorage.setItem('active_role', JSON.stringify({
        role, school_id: schoolId, user_id: userId || null
      }));
      if (role === 'admin') window.location.href = base + 'admin/dashboard.html';
      else if (role === 'operator') window.location.href = base + 'operator/dashboard.html';
      else if (role === 'guru') window.location.href = base + 'guru/dashboard.html';
      else if (role === 'wali_kelas') window.location.href = base + 'wali-kelas/dashboard.html';
      else if (role === 'siswa') window.location.href = base + 'siswa/dashboard.html';
    });
  });
}

async function requireAuth(expectedRole) {
  const profile = await getProfile();
  if (!profile) {
    alert('Silakan login terlebih dahulu.');
    window.location.href = '../login.html';
    return null;
  }

  const hasRole = profile.roles && profile.roles.some(r => r.role === expectedRole);

  if (expectedRole && !hasRole) {
    alert('Anda tidak punya akses ke halaman ini.');
    redirectByRole(profile);
    return null;
  }

  if (expectedRole && profile.role !== expectedRole) {
    const matchingRole = profile.roles.find(r => r.role === expectedRole);
    if (matchingRole) {
      sessionStorage.setItem('active_role', JSON.stringify({
        role: matchingRole.role,
        school_id: matchingRole.school_id,
        user_id: profile.id
      }));
      profile.role = matchingRole.role;
      profile.school_id = matchingRole.school_id;
      profile.activeRole = matchingRole;
    }
  }

  return profile;
}

async function switchRole() {
  const profile = await getProfile();
  if (!profile || !profile.roles || profile.roles.length <= 1) {
    alert('Anda hanya punya 1 role.');
    return;
  }
  sessionStorage.removeItem('active_role');
  redirectByRole(profile);
}