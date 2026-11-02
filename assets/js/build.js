// assets/js/build.js
// Jalankan: node build.js
// Menggabungkan semua db/*.js menjadi supabase.js

const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'db');
const OUTPUT = path.join(__dirname, 'supabase.js');

// Header yang ditaruh di awal file gabungan
const HEADER = `// ============================================
// SUPABASE.JS — TEMBOK BELAJAR (AUTO-GENERATED)
// JANGAN EDIT FILE INI LANGSUNG!
// Edit file di assets/js/db/*.js lalu jalankan: node build.js
// Generated: ${new Date().toISOString()}
// ============================================

// Cache WAJIB di-load via <script src="../assets/js/core/cache.js"></script> SEBELUM supabase.js
// (tidak ada fallback di sini — kalau cache.js tidak termuat, akan error saat runtime)

`;

function main() {
  if (!fs.existsSync(DB_DIR)) {
    console.error('❌ Folder db/ tidak ditemukan:', DB_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(DB_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();

  if (files.length === 0) {
    console.error('❌ Tidak ada file .js di folder db/');
    process.exit(1);
  }

  console.log('📦 Menggabungkan', files.length, 'file...');
  files.forEach(f => console.log('   -', f));

  const parts = files.map(f => {
    const content = fs.readFileSync(path.join(DB_DIR, f), 'utf8');
    // Hapus baris 'import ...' dan 'export ...' kalau ada
    return content
      .replace(/^\s*import\s+.*$/gm, '')
      .replace(/^\s*export\s+.*$/gm, '');
  });

  const output = HEADER + parts.join('\n\n') + '\n\n// ============================================\n// END OF FILE — AUTO-GENERATED\n// ============================================\n';

  fs.writeFileSync(OUTPUT, output, 'utf8');

  const size = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
  console.log('✅ Berhasil dibuat:', OUTPUT, '(' + size + ' KB)');
  console.log('   Total fungsi: ' + (output.match(/^(async )?function \w+/gm) || []).length);
}

main();