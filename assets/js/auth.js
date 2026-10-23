// ============================================
// LOGIC LOGIN — TEMBOK BELAJAR
// Multi-Role Support
// ============================================

async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('btnLogin');
  const msg = document.getElementById('message');

  msg.classList.add('hidden');

  if (!email || !password) {
    return showMessage('Email dan password wajib diisi.', 'error');
  }

  btn.disabled = true;
  btn.textContent = 'Memeriksa...';

  const client = initSupabase();
  const { error } = await client.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = 'Masuk';

  if (error) {
    return showMessage('Login gagal: ' + error.message, 'error');
  }

  const profile = await getProfile();
  if (!profile) {
    return showMessage('Profil tidak ditemukan. Hubungi operator.', 'error');
  }

  showMessage('Login berhasil! Mengalihkan...', 'success');
  setTimeout(() => redirectByRole(profile), 600);
}

function showMessage(text, type) {
  const msg = document.getElementById('message');
  msg.textContent = text;
  msg.className = 'alert ' + (type === 'error' ? 'alert-error' : 'alert-success');
  msg.classList.remove('hidden');
}