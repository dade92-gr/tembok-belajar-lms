// ============================================
// EDITOR-TOOLS.JS — Tembok Belajar
// Registry TOOL untuk unit-editor.
// TIDAK berisi renderer / modal / logic — hanya DATA + sidebar renderer.
//
// 🎯 CARA MENAMBAH TOOL BARU:
//   1. Tambah objek { type, label, icon } di EDITOR_TOOL_GROUPS (grup sesuai)
//   2. Tambah entry di COMPONENT_DEFAULTS[type] = { ... } (data awal)
//   3. Tambah entry di COMPONENT_TYPE_LABEL[type] = 'Label' (untuk badge canvas)
//   4. (Opsional) tambah renderer di editor-renderers.js
//   5. (Opsional) tambah modal di editor-modals.js
//   → Sidebar otomatis menampilkan tombol baru.
// ============================================

/**
 * Grup & tool yang muncul di sidebar kanan editor.
 * Urutan grup = urutan render. Urutan tools = urutan tombol.
 */
const EDITOR_TOOL_GROUPS = [
  {
    id: 'teks',
    label: 'Teks & Judul',
    icon: 'fa-text-height',
    tools: [
      { type: 'text',    label: 'Teks (Rich)', icon: 'fa-paragraph' },
      { type: 'heading', label: 'Judul',       icon: 'fa-heading' },
    ]
  },
  {
    id: 'media',
    label: 'Media',
    icon: 'fa-photo-film',
    tools: [
      { type: 'image',  label: 'Gambar', icon: 'fa-image' },
      { type: 'video',  label: 'Video',  icon: 'fa-video' },
      { type: 'audio',  label: 'Audio',  icon: 'fa-volume-high' },
      { type: 'table',  label: 'Tabel',  icon: 'fa-table' },
    ]
  },
  {
    id: 'lkpd',
    label: 'Lembar Aktivitas',
    icon: 'fa-pen-to-square',
    tools: [
      { type: 'identitas_siswa',  label: 'Identitas Siswa',  icon: 'fa-id-card' },
      { type: 'petunjuk',         label: 'Petunjuk',         icon: 'fa-circle-info' },
      { type: 'input_teks',       label: 'Input Teks',       icon: 'fa-keyboard' },
      { type: 'textarea',         label: 'Textarea',         icon: 'fa-align-left' },
      { type: 'checkbox',         label: 'Checkbox',         icon: 'fa-square-check' },
      { type: 'radio',            label: 'Radio',            icon: 'fa-circle-dot' },
      { type: 'dropdown',         label: 'Dropdown',         icon: 'fa-caret-down' },
      { type: 'tabel_isian',      label: 'Tabel Isian',      icon: 'fa-table-cells' },
      { type: 'penilaian_diri',   label: 'Penilaian Diri',   icon: 'fa-star-half-stroke' },
      { type: 'tombol_submit',    label: 'Tombol Submit',    icon: 'fa-paper-plane' },
    ]
  },
  {
    id: 'asesmen',
    label: 'Asesmen',
    icon: 'fa-clipboard-check',
    tools: [
      { type: 'asesmen_setting',    label: 'Pengaturan Asesmen', icon: 'fa-gear' },
      { type: 'soal_pg',            label: 'Soal PG',            icon: 'fa-list-ol' },
      { type: 'soal_pg_kompleks',   label: 'Soal PG Kompleks',   icon: 'fa-list-check' },
      { type: 'soal_esai',          label: 'Soal Esai',          icon: 'fa-pen-nib' },
      { type: 'soal_menjodohkan',   label: 'Menjodohkan',        icon: 'fa-arrows-left-right' },
      { type: 'soal_benar_salah',   label: 'Benar/Salah',        icon: 'fa-check-double' },
    ]
  },
  {
    id: 'refleksi',
    label: 'Refleksi',
    icon: 'fa-brain',
    tools: [
      { type: 'pertanyaan_refleksi',   label: 'Pertanyaan Refleksi', icon: 'fa-question' },
      { type: 'mood_tracker',          label: 'Mood Tracker',        icon: 'fa-face-smile' },
      { type: 'target_belajar',        label: 'Target Belajar',      icon: 'fa-bullseye' },
      { type: 'tombol_submit_refleksi', label: 'Tombol Submit Refleksi', icon: 'fa-paper-plane' },
    ]
  },
  {
    id: 'diskusi',
    label: 'Diskusi',
    icon: 'fa-comments',
    tools: [
      { type: 'topik_diskusi',   label: 'Topik Diskusi',   icon: 'fa-comment-dots' },
      { type: 'aturan_diskusi',  label: 'Aturan Diskusi',  icon: 'fa-scroll' },
      { type: 'kolom_komentar',  label: 'Kolom Komentar',  icon: 'fa-comment' },
    ]
  },
  {
    id: 'lainnya',
    label: 'Lainnya',
    icon: 'fa-box',
    tools: [
      { type: 'note',      label: 'Note Box',       icon: 'fa-note-sticky' },
      { type: 'accordion', label: 'Accordion',      icon: 'fa-list' },
      { type: 'file',      label: 'File Download',  icon: 'fa-file-arrow-down' },
      { type: 'embed',     label: 'Embed',          icon: 'fa-code' },
    ]
  },
];

/**
 * Data awal (default component_data) saat komponen baru dibuat.
 * Kunci = component_type. Value = objek JSON yang akan disimpan.
 */
const COMPONENT_DEFAULTS = {
  // ===== Teks & Judul =====
  text:    { html: '' },
  heading: { text: '', level: 'h2', align: 'left', color: '#0f172a' },

  // ===== Media =====
  image: { url: '', alt: '', caption: '', align: 'center' },
  video: { url: '', caption: '' },
  audio: { url: '', caption: '' },
  table: { columns: [], rows: [], widths: [] },

  // ===== LKPD =====
  identitas_siswa:  { label: 'Identitas Siswa', show_name: true, show_nisn: true, show_kelas: false, show_tanggal: false },
  petunjuk:         { title: 'Petunjuk Pengerjaan', text: '' },
  input_teks:       { label: '', placeholder: '', required: false },
  textarea:         { label: '', placeholder: '', rows: 4, required: false },
  checkbox:         { label: '', options: ['Opsi 1', 'Opsi 2'], required: false },
  radio:            { label: '', options: ['Opsi 1', 'Opsi 2'], required: false },
  dropdown:         { label: '', options: ['Opsi 1', 'Opsi 2'], required: false },
  tabel_isian:      { label: '', columns: [], rows: [] },
  penilaian_diri:   { label: '', min: 1, max: 5, labels: [] },
  tombol_submit:    { label: 'Kumpulkan Jawaban', success_message: 'Jawaban berhasil dikumpulkan!' },

  // ===== Asesmen =====
  asesmen_setting:  { title: '', description: '', duration: 30, auto_grade: false },
  soal_pg:          { question: '', options: ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'], correct: 0, points: 10, feedback: '' },
  soal_pg_kompleks: { question: '', options: ['Opsi A', 'Opsi B', 'Opsi C'], correct: [0], points: 15, feedback: '' },
  soal_esai:        { question: '', guide: '', points: 20, min_words: 10 },
  soal_menjodohkan: { question: '', left: ['', ''], right: ['', ''], points: 15 },
  soal_benar_salah: { question: '', correct: true, points: 5, feedback: '' },

  // ===== Refleksi =====
  pertanyaan_refleksi:    { question: '', placeholder: '', answer_type: 'textarea' },
  mood_tracker:           { label: '', options: ['😢 Sedih', '😐 Biasa', '😊 Senang', '😄 Sangat Senang'] },
  target_belajar:         { label: '', placeholder: '' },
  tombol_submit_refleksi: { label: 'Kirim Refleksi', success_message: 'Refleksi berhasil dikirim!' },

  // ===== Diskusi =====
  topik_diskusi:  { title: '', description: '' },
  aturan_diskusi: { title: 'Aturan Diskusi', text: '' },
  kolom_komentar: { label: 'Diskusi Kelas', placeholder: 'Tulis komentar...' },

  // ===== Lainnya =====
  note:      { variant: 'info', title: '', text: '' },
  accordion: { items: [] },
  file:      { url: '', label: 'Download File', description: '' },
  embed:     { url: '', height: 500 },
};

/**
 * Label human-readable untuk badge "type" di canvas editor.
 */
const COMPONENT_TYPE_LABEL = {
  text: 'Teks', heading: 'Judul', image: 'Gambar', video: 'Video',
  audio: 'Audio', table: 'Tabel', note: 'Note Box', accordion: 'Accordion',
  file: 'File Download', embed: 'Embed',
  identitas_siswa: 'Identitas', petunjuk: 'Petunjuk',
  input_teks: 'Input Teks', textarea: 'Textarea',
  checkbox: 'Checkbox', radio: 'Radio', dropdown: 'Dropdown',
  tabel_isian: 'Tabel Isian', penilaian_diri: 'Penilaian Diri',
  tombol_submit: 'Tombol Submit',
  asesmen_setting: 'Setting Asesmen', soal_pg: 'Soal PG',
  soal_pg_kompleks: 'PG Kompleks', soal_esai: 'Esai',
  soal_menjodohkan: 'Menjodohkan', soal_benar_salah: 'Benar/Salah',
  pertanyaan_refleksi: 'Pertanyaan Refleksi', mood_tracker: 'Mood Tracker',
  target_belajar: 'Target Belajar', tombol_submit_refleksi: 'Tombol Refleksi',
  topik_diskusi: 'Topik Diskusi', aturan_diskusi: 'Aturan Diskusi',
  kolom_komentar: 'Kolom Komentar',
};

/**
 * Warna & label badge tipe aktivitas (untuk sidebar kiri).
 */
const ACTIVITY_TYPE_LABEL = {
  materi: '📖 Materi',
  lkpd: '📝 Lembar Aktivitas',          // backward compat (data lama)
  lembar_aktivitas: '📝 Lembar Aktivitas',
  asesmen: '✍️ Asesmen',
  refleksi: '💭 Refleksi',
  diskusi: '💬 Diskusi',
  custom: '🔧 Custom',
};

// ============================================
// HELPER: RENDER SIDEBAR TOOL
// ============================================

/**
 * Render seluruh tombol tool ke container sidebar kanan.
 * Dipanggil sekali saat init, setelah itu tombol disabled sampai user
 * memilih aktivitas.
 *
 * @param {string} containerSelector - selector container, default '.component-tools'
 * @param {function} onToolClick    - callback(type) saat tombol diklik
 */
function renderToolSidebar(containerSelector, onToolClick) {
  const container = document.querySelector(containerSelector || '.component-tools');
  if (!container) {
    console.warn('[editor-tools] Container sidebar tidak ditemukan:', containerSelector);
    return;
  }

  const html = EDITOR_TOOL_GROUPS.map(group => {
    const buttons = group.tools.map(tool => {
      // ID tombol dibuat otomatis: tool-{type}, misal: tool-text, tool-image
      const btnId = 'tool-' + tool.type;
      return `<button class="tool-btn" id="${btnId}" data-tool-type="${tool.type}" disabled>
        <i class="fas ${tool.icon}"></i> ${tool.label}
      </button>`;
    }).join('');

    return `<div class="tool-section">
      <div class="tool-section-title"><i class="fas ${group.icon}"></i> ${group.label}</div>
      ${buttons}
    </div>`;
  }).join('');

  container.innerHTML = html;

  // Pasang event listener ke semua tombol
  container.querySelectorAll('.tool-btn[data-tool-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const type = btn.dataset.toolType;
      if (typeof onToolClick === 'function') onToolClick(type);
    });
  });
}

/**
 * Enable / disable semua tombol tool.
 * Dipanggil saat aktivitas dipilih / belum dipilih.
 */
function setToolSidebarEnabled(enabled) {
  document.querySelectorAll('.tool-btn[data-tool-type]').forEach(btn => {
    btn.disabled = !enabled;
  });
}

// ============================================
// HELPER: DEFAULT DATA & LABEL
// ============================================

/**
 * Ambil default component_data untuk tipe tertentu.
 * Return salinan (deep clone) agar tidak ada mutasi ke objek asli.
 */
function getComponentDefaults(type) {
  const def = COMPONENT_DEFAULTS[type];
  if (!def) {
    console.warn('[editor-tools] Tidak ada default untuk tipe:', type);
    return {};
  }
  return JSON.parse(JSON.stringify(def));
}

/**
 * Ambil label human-readable dari tipe komponen.
 */
function getComponentTypeLabel(type) {
  return COMPONENT_TYPE_LABEL[type] || type;
}

/**
 * Cek apakah tipe komponen terdaftar di registry.
 */
function isKnownComponentType(type) {
  return Object.prototype.hasOwnProperty.call(COMPONENT_DEFAULTS, type);
}

/**
 * Ambil info tool (label, icon) dari registry untuk keperluan log / UI.
 */
function getToolInfo(type) {
  for (const group of EDITOR_TOOL_GROUPS) {
    for (const tool of group.tools) {
      if (tool.type === type) return { ...tool, group: group.id, groupLabel: group.label };
    }
  }
  return null;
}

// Expose ke window (script non-module)
window.EDITOR_TOOL_GROUPS = EDITOR_TOOL_GROUPS;
window.COMPONENT_DEFAULTS = COMPONENT_DEFAULTS;
window.COMPONENT_TYPE_LABEL = COMPONENT_TYPE_LABEL;
window.ACTIVITY_TYPE_LABEL = ACTIVITY_TYPE_LABEL;
window.renderToolSidebar = renderToolSidebar;
window.setToolSidebarEnabled = setToolSidebarEnabled;
window.getComponentDefaults = getComponentDefaults;
window.getComponentTypeLabel = getComponentTypeLabel;
window.isKnownComponentType = isKnownComponentType;
window.getToolInfo = getToolInfo;

console.log('[editor-tools] Loaded. Total tool:', EDITOR_TOOL_GROUPS.reduce((n, g) => n + g.tools.length, 0));