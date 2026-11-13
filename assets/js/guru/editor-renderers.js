// ============================================
// EDITOR-RENDERERS.JS — Tembok Belajar
// Registry RENDER per tipe komponen.
// Dipakai di canvas editor (mode edit) DAN preview (mode preview).
//
// 🎯 CARA MENAMBAH RENDERER BARU:
//   Tambahkan entry di COMPONENT_RENDERERS[type] = (data, comp, ctx) => '<html>';
//   Signature:
//     data = comp.component_data (objek)
//     comp = komponen utuh ({ id, component_type, order_index, ... })
//     ctx  = { mode, escapeHtml, helpers: { convertDriveUrl, toEmbedVideoUrl } }
//
// 🎯 MODE:
//   'edit'    → canvas editor (klik untuk edit, tampil placeholder kalau kosong)
//   'preview' → readonly (tanpa onclick, sembunyikan placeholder)
// ============================================

(function (global) {
  'use strict';

  // ============================================
  // HELPERS LOKAL
  // ============================================

  function esc(t) {
    if (t === null || t === undefined) return '';
    const d = document.createElement('div');
    d.textContent = String(t);
    return d.innerHTML;
  }

  function placeholder(ctx, icon, text) {
    if (ctx.mode === 'preview') return ''; // di preview jangan tampilkan placeholder
    return `<div style="text-align:center; padding:1.5rem; border:2px dashed var(--border); border-radius:8px; cursor:pointer;">
      <i class="fas ${icon}" style="font-size:2rem; color:#94a3b8; margin-bottom:0.5rem; display:block;"></i>
      <p style="color:var(--text-muted); font-size:0.85rem; margin:0;">${esc(text)}</p>
    </div>`;
  }

  // Shortcut: klik hanya kalau mode edit
  function clickAttr(ctx, fnCall) {
    return ctx.mode === 'edit' ? `onclick="${fnCall}"` : '';
  }

  function cursor(ctx) {
    return ctx.mode === 'edit' ? 'cursor:pointer;' : '';
  }

  // ============================================
  // REGISTRY
  // ============================================

  const COMPONENT_RENDERERS = {

    // ============================================
    // TEKS & JUDUL
    // ============================================

    text: (data, comp, ctx) => {
      // Quill di-init setelah DOM ready (di canvas editor)
      if (ctx.mode === 'edit') {
        return `<div id="quill-${comp.id}"></div>`;
      }
      // Preview: render HTML langsung
      const html = data.html || '';
      if (!html.trim()) return '';
      return html;
    },

    heading: (data, comp, ctx) => {
      const level = data.level || 'h2';
      const text = data.text || '';
      const color = data.color || '';
      const align = data.align || 'left';

      const styleArr = [];
      if (color) styleArr.push('color: ' + color);
      styleArr.push('text-align: ' + align);
      const styleStr = styleArr.join('; ');

      if (!text) {
        if (ctx.mode === 'preview') return '';
        return `<div class="heading-preview" ${clickAttr(ctx, `openHeadingModal('${comp.id}')`)}>
          <div class="heading-preview-inner ${level}" style="${styleStr}">
            <span class="heading-placeholder">Klik untuk edit judul...</span>
          </div>
        </div>`;
      }

      if (ctx.mode === 'preview') {
        return `<div class="heading-render-block ${level}" style="${styleStr}">${esc(text)}</div>`;
      }

      return `<div class="heading-preview" ${clickAttr(ctx, `openHeadingModal('${comp.id}')`)}>
        <div class="heading-preview-inner ${level}" style="${styleStr}">${esc(text)}</div>
      </div>`;
    },

    // ============================================
    // MEDIA
    // ============================================

    image: (data, comp, ctx) => {
      const url = data.url || '';
      const alt = data.alt || '';
      const caption = data.caption || '';
      const align = data.align || 'center';

      if (!url) {
        return `<div ${clickAttr(ctx, `openImageModal('${comp.id}')`)}>${placeholder(ctx, 'fa-image', 'Klik untuk menambahkan gambar')}</div>`;
      }

      const displayUrl = ctx.helpers.convertDriveUrl(url, 'image');
      const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };

      // Ukuran gambar: preview lebih besar, edit sedikit dibatasi
      const maxH = ctx.mode === 'preview' ? '500px' : '400px';

      return `<div style="display:flex; flex-direction:column; align-items:${alignMap[align]}; ${cursor(ctx)}" ${clickAttr(ctx, `openImageModal('${comp.id}')`)}>
        <img src="${esc(displayUrl)}" alt="${esc(alt)}" style="max-width:100%; max-height:${maxH}; border-radius:8px;" loading="lazy" referrerpolicy="no-referrer">
        ${caption ? `<div style="font-size:0.78rem; color:var(--text-muted); text-align:center; font-style:italic; margin-top:0.4rem;">${esc(caption)}</div>` : ''}
      </div>`;
    },

    video: (data, comp, ctx) => {
      const url = data.url || '';
      const caption = data.caption || '';

      if (!url) {
        return `<div ${clickAttr(ctx, `openVideoModal('${comp.id}')`)}>${placeholder(ctx, 'fa-video', 'Klik untuk menambahkan video')}</div>`;
      }

      const embedUrl = ctx.helpers.toEmbedVideoUrl(url);

      if (!embedUrl) {
        return `<div ${clickAttr(ctx, `openVideoModal('${comp.id}')`)} style="padding:1rem; background:#fef3c7; color:#92400e; border-radius:8px; ${cursor(ctx)}">⚠️ URL video tidak dikenali</div>`;
      }

      return `<div ${clickAttr(ctx, `openVideoModal('${comp.id}')`)} style="${cursor(ctx)}">
        <div style="position:relative; padding-bottom:56.25%; height:0; border-radius:8px; overflow:hidden; background:#000;">
          <iframe src="${esc(embedUrl)}" style="position:absolute; inset:0; width:100%; height:100%; border:0;" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>
        ${caption ? `<div style="font-size:0.78rem; color:var(--text-muted); text-align:center; margin-top:0.4rem;">${esc(caption)}</div>` : ''}
      </div>`;
    },

    audio: (data, comp, ctx) => {
      const url = data.url || '';
      const caption = data.caption || '';

      if (!url) {
        return `<div ${clickAttr(ctx, `openAudioModal('${comp.id}')`)}>${placeholder(ctx, 'fa-volume-high', 'Klik untuk menambahkan audio')}</div>`;
      }

      return `<div ${clickAttr(ctx, `openAudioModal('${comp.id}')`)} style="${cursor(ctx)}">
        <audio controls style="width:100%; margin-bottom:0.4rem;"><source src="${esc(url)}"></audio>
        ${caption ? `<div style="font-size:0.78rem; color:var(--text-muted); text-align:center;">${esc(caption)}</div>` : ''}
      </div>`;
    },

    table: (data, comp, ctx) => {
      const columns = data.columns || [];
      const rows = data.rows || [];
      const widths = data.widths || [];

      if (columns.length === 0) {
        return `<div ${clickAttr(ctx, `openTableModal('${comp.id}')`)}>${placeholder(ctx, 'fa-table', 'Klik untuk menambahkan tabel')}</div>`;
      }

      return `<div ${clickAttr(ctx, `openTableModal('${comp.id}')`)} style="overflow-x:auto; ${cursor(ctx)}">
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; table-layout:fixed;">
          <thead><tr style="background:var(--green-lighter);">
            ${columns.map((c, i) => `<th style="padding:0.5rem 0.7rem; border:1px solid var(--border); text-align:left; font-weight:700; color:var(--green-dark); ${widths[i] ? 'width:' + widths[i] + '%' : ''}">${esc(c)}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${rows.map(row => `<tr>${columns.map((_, i) => `<td style="padding:0.5rem 0.7rem; border:1px solid var(--border); word-break:break-word;">${esc(row[i] || '')}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    },

    // ============================================
    // LKPD
    // ============================================

    identitas_siswa: (data, comp, ctx) => {
      const shows = [];
      if (data.show_name !== false) shows.push('Nama');
      if (data.show_nisn !== false) shows.push('NISN');
      if (data.show_kelas) shows.push('Kelas');
      if (data.show_tanggal) shows.push('Tanggal');

      const label = data.label || 'Identitas Siswa';

      if (ctx.mode === 'preview') {
        const fields = [];
        if (data.show_name !== false) fields.push({ l: 'Nama', v: '(otomatis)' });
        if (data.show_nisn !== false) fields.push({ l: 'NISN', v: '(otomatis)' });
        if (data.show_kelas) fields.push({ l: 'Kelas', v: '(otomatis)' });
        if (data.show_tanggal) fields.push({ l: 'Tanggal', v: '(hari ini)' });
        return `<div class="identitas-box">
          <div style="font-weight:800; color:var(--green-dark); margin-bottom:0.6rem; font-size:0.9rem;"><i class="fas fa-id-card"></i> ${esc(label)}</div>
          ${fields.map(f => `<div class="identitas-row"><span class="label">${esc(f.l)}</span><span class="value" style="color:var(--text-muted); font-style:italic;">${esc(f.v)}</span></div>`).join('')}
        </div>`;
      }

      return `<div class="lkpd-preview-box" ${clickAttr(ctx, `openIdentitasModal('${comp.id}')`)}>
        <div style="padding:1rem; background:var(--bg-soft); border:2px dashed var(--green-light); border-radius:8px;">
          <div style="font-weight:800; margin-bottom:0.4rem; color:var(--green-dark); font-size:0.9rem;"><i class="fas fa-id-card"></i> ${esc(label)}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">Field: <strong>${shows.join(', ') || '(kosong)'}</strong> · Auto-fill</div>
          <div class="lkpd-hint">Klik untuk edit</div>
        </div>
      </div>`;
    },

    petunjuk: (data, comp, ctx) => {
      const title = data.title || 'Petunjuk';
      const text = data.text || '';

      if (ctx.mode === 'preview') {
        if (!text) return '';
        return `<div class="petunjuk-box">
          <div class="petunjuk-title"><i class="fas fa-circle-info"></i> ${esc(title)}</div>
          <div class="petunjuk-text">${esc(text)}</div>
        </div>`;
      }

      return `<div class="lkpd-preview-box" ${clickAttr(ctx, `openPetunjukModal('${comp.id}')`)}>
        <div style="padding:1rem 1.2rem; background:#fef3c7; border-left:4px solid var(--warning); border-radius:8px;">
          <div style="font-weight:800; color:#92400e; margin-bottom:0.4rem; font-size:0.9rem;"><i class="fas fa-circle-info"></i> ${esc(title)}</div>
          <div style="font-size:0.85rem; color:#78350f; white-space:pre-wrap;">${esc(text || '(Kosong)')}</div>
          <div class="lkpd-hint" style="background:#fde68a; color:#92400e;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    input_teks: (data, comp, ctx) => {
      const label = data.label || '';
      const placeholder_ = data.placeholder || '';
      const required = !!data.required;

      if (ctx.mode === 'preview') {
        return `<div class="lkpd-field">
          <div class="lkpd-label">${esc(label || '(Belum ada label)')}${required ? '<span class="req">*</span>' : ''}</div>
          <input type="text" class="lkpd-readonly-input" placeholder="${esc(placeholder_ || 'Jawaban siswa...')}" readonly>
        </div>`;
      }

      return `<div class="lkpd-preview-box" ${clickAttr(ctx, `openInputTeksModal('${comp.id}')`)}>
        <div class="lkpd-label-preview">${esc(label || '(Belum ada label)')} ${required ? '<span style="color:var(--danger);">*</span>' : ''}</div>
        <input type="text" class="lkpd-input-preview" placeholder="${esc(placeholder_)}" readonly>
        <div class="lkpd-hint">Klik untuk edit</div>
      </div>`;
    },

    textarea: (data, comp, ctx) => {
      const label = data.label || '';
      const placeholder_ = data.placeholder || '';
      const rows = data.rows || 4;
      const required = !!data.required;

      if (ctx.mode === 'preview') {
        return `<div class="lkpd-field">
          <div class="lkpd-label">${esc(label || '(Belum ada label)')}${required ? '<span class="req">*</span>' : ''}</div>
          <textarea class="lkpd-readonly-textarea" rows="${rows}" placeholder="${esc(placeholder_ || 'Jawaban siswa...')}" readonly></textarea>
        </div>`;
      }

      return `<div class="lkpd-preview-box" ${clickAttr(ctx, `openTextareaModal('${comp.id}')`)}>
        <div class="lkpd-label-preview">${esc(label || '(Belum ada label)')} ${required ? '<span style="color:var(--danger);">*</span>' : ''}</div>
        <textarea class="lkpd-input-preview" rows="${rows}" placeholder="${esc(placeholder_)}" readonly></textarea>
        <div class="lkpd-hint">Klik untuk edit</div>
      </div>`;
    },

    checkbox: (data, comp, ctx) => {
      const opts = data.options || [];
      const label = data.label || '';
      const required = !!data.required;

      if (ctx.mode === 'preview') {
        return `<div class="lkpd-field">
          <div class="lkpd-label">${esc(label || '(Belum ada label)')}${required ? '<span class="req">*</span>' : ''}</div>
          ${opts.map(o => `<label class="lkpd-option-item"><input type="checkbox" disabled> ${esc(o)}</label>`).join('')}
        </div>`;
      }

      return `<div class="lkpd-preview-box" ${clickAttr(ctx, `openOptionsModal('${comp.id}', 'checkbox')`)}>
        <div class="lkpd-label-preview">${esc(label || '(Belum ada label)')} ${required ? '<span style="color:var(--danger);">*</span>' : ''}</div>
        ${opts.map(o => `<label class="lkpd-option-item"><input type="checkbox" disabled> ${esc(o)}</label>`).join('')}
        <div class="lkpd-hint">Klik untuk edit · ${opts.length} opsi</div>
      </div>`;
    },

    radio: (data, comp, ctx) => {
      const opts = data.options || [];
      const label = data.label || '';
      const required = !!data.required;

      if (ctx.mode === 'preview') {
        return `<div class="lkpd-field">
          <div class="lkpd-label">${esc(label || '(Belum ada label)')}${required ? '<span class="req">*</span>' : ''}</div>
          ${opts.map(o => `<label class="lkpd-option-item"><input type="radio" disabled> ${esc(o)}</label>`).join('')}
        </div>`;
      }

      return `<div class="lkpd-preview-box" ${clickAttr(ctx, `openOptionsModal('${comp.id}', 'radio')`)}>
        <div class="lkpd-label-preview">${esc(label || '(Belum ada label)')} ${required ? '<span style="color:var(--danger);">*</span>' : ''}</div>
        ${opts.map(o => `<label class="lkpd-option-item"><input type="radio" disabled> ${esc(o)}</label>`).join('')}
        <div class="lkpd-hint">Klik untuk edit · ${opts.length} opsi</div>
      </div>`;
    },

    dropdown: (data, comp, ctx) => {
      const opts = data.options || [];
      const label = data.label || '';
      const required = !!data.required;

      if (ctx.mode === 'preview') {
        return `<div class="lkpd-field">
          <div class="lkpd-label">${esc(label || '(Belum ada label)')}${required ? '<span class="req">*</span>' : ''}</div>
          <select class="lkpd-readonly-input" disabled>
            <option>-- Pilih --</option>
            ${opts.map(o => `<option>${esc(o)}</option>`).join('')}
          </select>
        </div>`;
      }

      return `<div class="lkpd-preview-box" ${clickAttr(ctx, `openOptionsModal('${comp.id}', 'dropdown')`)}>
        <div class="lkpd-label-preview">${esc(label || '(Belum ada label)')} ${required ? '<span style="color:var(--danger);">*</span>' : ''}</div>
        <select class="lkpd-input-preview" disabled>
          <option>-- Pilih --</option>
          ${opts.map(o => `<option>${esc(o)}</option>`).join('')}
        </select>
        <div class="lkpd-hint">Klik untuk edit · ${opts.length} opsi</div>
      </div>`;
    },

    tabel_isian: (data, comp, ctx) => {
      const columns = data.columns || [];
      const rows = data.rows || [];
      const label = data.label || '';

      if (columns.length === 0) {
        return `<div ${clickAttr(ctx, `openTabelIsianModal('${comp.id}')`)}>${placeholder(ctx, 'fa-table-cells', 'Klik untuk menambahkan tabel isian')}</div>`;
      }

      const tableHtml = `<div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
          <thead><tr style="background:var(--green-lighter);">
            ${columns.map(c => `<th style="padding:0.5rem 0.7rem; border:1px solid var(--border); text-align:left; font-weight:700; color:var(--green-dark);">${esc(c)}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${rows.map(r => `<tr>${columns.map((_, i) => `<td style="padding:0.5rem 0.7rem; border:1px solid var(--border); color:var(--text-muted); font-style:italic;">${esc(r[i] || '(draft)')}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;

      if (ctx.mode === 'preview') {
        return `<div class="lkpd-field">${label ? `<div class="lkpd-label">${esc(label)}</div>` : ''}${tableHtml}</div>`;
      }

      return `<div class="lkpd-preview-box" ${clickAttr(ctx, `openTabelIsianModal('${comp.id}')`)}>
        ${label ? `<div class="lkpd-label-preview">${esc(label)}</div>` : ''}
        ${tableHtml}
        <div class="lkpd-hint">Klik untuk edit · ${rows.length}×${columns.length}</div>
      </div>`;
    },

    penilaian_diri: (data, comp, ctx) => {
      const label = data.label || '';
      const min = data.min || 1;
      const max = data.max || 5;
      const labels = data.labels || [];

      const opts = [];
      for (let i = min; i <= max; i++) {
        const lbl = labels[i - min] || `Skala ${i}`;
        opts.push({ val: i, lbl });
      }

      if (ctx.mode === 'preview') {
        return `<div class="lkpd-field">
          <div class="lkpd-label">${esc(label || '(Belum ada label)')}</div>
          ${opts.map(o => `<label class="penilaian-diri-item"><input type="radio" disabled> <strong>${o.val}</strong> — ${esc(o.lbl)}</label>`).join('')}
        </div>`;
      }

      return `<div class="lkpd-preview-box" ${clickAttr(ctx, `openPenilaianDiriModal('${comp.id}')`)}>
        <div class="lkpd-label-preview">${esc(label || '(Belum ada label)')}</div>
        ${opts.map(o => `<label class="lkpd-option-item"><input type="radio" disabled> ${o.val} — ${esc(o.lbl)}</label>`).join('')}
        <div class="lkpd-hint">Skala ${min}-${max}</div>
      </div>`;
    },

    tombol_submit: (data, comp, ctx) => {
      const label = data.label || 'Kumpulkan Jawaban';

      if (ctx.mode === 'preview') {
        return `<div class="submit-btn-preview">
          <button><i class="fas fa-paper-plane"></i> ${esc(label)}</button>
        </div>`;
      }

      return `<div class="lkpd-preview-box" ${clickAttr(ctx, `openTombolSubmitModal('${comp.id}')`)}>
        <div style="text-align:center; padding:1rem; background:var(--green-lighter); border:2px dashed var(--green); border-radius:8px;">
          <button class="btn-primary" style="pointer-events:none; padding:0.6rem 1.5rem;">
            <i class="fas fa-paper-plane"></i> ${esc(label)}
          </button>
          <div class="lkpd-hint">Klik untuk edit</div>
        </div>
      </div>`;
    },

    // ============================================
    // ASESMEN
    // ============================================

    asesmen_setting: (data, comp, ctx) => {
      const title = data.title || '';
      const duration = data.duration || 30;
      const autoGrade = !!data.auto_grade;

      if (ctx.mode === 'preview') {
        return `<div class="asesmen-setting-box">
          <div class="asesmen-setting-title"><i class="fas fa-gear"></i> Pengaturan Asesmen</div>
          <div class="asesmen-setting-info">
            ${title ? `<div><strong>Judul:</strong> ${esc(title)}</div>` : ''}
            ${data.description ? `<div><strong>Deskripsi:</strong> ${esc(data.description)}</div>` : ''}
            <div><strong>Durasi:</strong> ${duration} menit</div>
            <div><strong>Auto-grade:</strong> ${autoGrade ? 'Ya (otomatis untuk PG)' : 'Manual'}</div>
          </div>
        </div>`;
      }

      return `<div class="asesmen-preview-box" ${clickAttr(ctx, `openAsesmenSettingModal('${comp.id}')`)}>
        <div style="padding:1rem; background:#ede9fe; border-left:4px solid var(--purple); border-radius:8px;">
          <div style="font-weight:800; color:#6d28d9; margin-bottom:0.4rem; font-size:0.9rem;"><i class="fas fa-gear"></i> Pengaturan Asesmen</div>
          <div style="font-size:0.8rem; color:#5b21b6;">
            <div><strong>Judul:</strong> ${esc(title || '-')}</div>
            <div><strong>Durasi:</strong> ${duration} menit</div>
            <div><strong>Auto-grade:</strong> ${autoGrade ? 'Ya' : 'Tidak'}</div>
          </div>
          <div class="lkpd-hint" style="background:#ddd6fe; color:#6d28d9;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    soal_pg: (data, comp, ctx) => {
      const opts = data.options || [];
      const question = data.question || '';
      const points = data.points || 10;

      if (ctx.mode === 'preview') {
        return `<div class="asesmen-soal-box">
          <div class="asesmen-soal-num">PG · ${points} poin</div>
          <div class="asesmen-soal-question">${esc(question || '(Belum ada pertanyaan)')}</div>
          ${opts.map((o, i) => `<label class="asesmen-jawaban-item"><input type="radio" name="pg_${comp.id}" disabled><div class="asesmen-jawaban-label">${String.fromCharCode(65 + i)}</div><div>${esc(o)}</div></label>`).join('')}
        </div>`;
      }

      return `<div class="asesmen-preview-box" ${clickAttr(ctx, `openSoalPGModal('${comp.id}')`)}>
        <div class="asesmen-soal-preview">
          <span class="asesmen-soal-number">PG · ${points} poin</span>
          <div class="asesmen-soal-text">${esc(question || '(Belum ada pertanyaan)')}</div>
          ${opts.map((o, i) => `<div class="asesmen-jawaban-item ${i === data.correct ? 'correct' : ''}"><div class="asesmen-jawaban-label">${String.fromCharCode(65 + i)}</div><div>${esc(o)}</div>${i === data.correct ? '<i class="fas fa-check" style="margin-left:auto; color:var(--green);"></i>' : ''}</div>`).join('')}
          <div class="lkpd-hint" style="background:#ddd6fe; color:#6d28d9;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    soal_pg_kompleks: (data, comp, ctx) => {
      const opts = data.options || [];
      const correct = data.correct || [];
      const question = data.question || '';
      const points = data.points || 15;

      if (ctx.mode === 'preview') {
        return `<div class="asesmen-soal-box">
          <div class="asesmen-soal-num">PG Kompleks · ${points} poin</div>
          <div class="asesmen-soal-question">${esc(question || '(Belum ada pertanyaan)')}</div>
          ${opts.map((o, i) => `<label class="asesmen-jawaban-item"><input type="checkbox" disabled><div class="asesmen-jawaban-label">${String.fromCharCode(65 + i)}</div><div>${esc(o)}</div></label>`).join('')}
        </div>`;
      }

      return `<div class="asesmen-preview-box" ${clickAttr(ctx, `openSoalPGKModal('${comp.id}')`)}>
        <div class="asesmen-soal-preview">
          <span class="asesmen-soal-number">PG Kompleks · ${points} poin</span>
          <div class="asesmen-soal-text">${esc(question || '(Belum ada pertanyaan)')}</div>
          ${opts.map((o, i) => `<div class="asesmen-jawaban-item ${correct.includes(i) ? 'correct' : ''}"><div class="asesmen-jawaban-label">${String.fromCharCode(65 + i)}</div><div>${esc(o)}</div>${correct.includes(i) ? '<i class="fas fa-check" style="margin-left:auto; color:var(--green);"></i>' : ''}</div>`).join('')}
          <div class="lkpd-hint" style="background:#ddd6fe; color:#6d28d9;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    soal_esai: (data, comp, ctx) => {
      const question = data.question || '';
      const guide = data.guide || '';
      const points = data.points || 20;

      if (ctx.mode === 'preview') {
        return `<div class="asesmen-soal-box">
          <div class="asesmen-soal-num">Esai · ${points} poin</div>
          <div class="asesmen-soal-question">${esc(question || '(Belum ada pertanyaan)')}</div>
          ${guide ? `<div style="font-size:0.78rem; color:var(--text-muted); background:white; padding:0.5rem 0.8rem; border-radius:6px; border-left:3px solid var(--purple); margin-bottom:0.6rem;"><strong>Panduan:</strong> ${esc(guide)}</div>` : ''}
          <textarea class="lkpd-readonly-textarea" placeholder="Jawaban esai siswa..." readonly style="min-height:100px;"></textarea>
        </div>`;
      }

      return `<div class="asesmen-preview-box" ${clickAttr(ctx, `openSoalEsaiModal('${comp.id}')`)}>
        <div class="asesmen-soal-preview">
          <span class="asesmen-soal-number">Esai · ${points} poin</span>
          <div class="asesmen-soal-text">${esc(question || '(Belum ada pertanyaan)')}</div>
          <textarea class="lkpd-input-preview" rows="2" placeholder="Jawaban siswa..." readonly style="margin-top:0.5rem;"></textarea>
          <div class="lkpd-hint" style="background:#ddd6fe; color:#6d28d9;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    soal_menjodohkan: (data, comp, ctx) => {
      const left = data.left || [];
      const right = data.right || [];
      const question = data.question || '';
      const points = data.points || 15;

      const gridHtml = `<div class="${ctx.mode === 'preview' ? 'asesmen-jodoh-grid' : ''}" style="${ctx.mode === 'edit' ? 'display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;' : ''}">
        <div class="${ctx.mode === 'preview' ? 'asesmen-jodoh-col' : ''}">
          ${left.map((l, i) => ctx.mode === 'preview'
            ? `<div class="asesmen-jodoh-item"><strong>${i + 1}.</strong> ${esc(l)}</div>`
            : `<div style="padding:0.4rem 0.7rem; background:white; border-radius:6px; margin-bottom:0.3rem; font-size:0.8rem;"><strong>${i + 1}.</strong> ${esc(l)}</div>`
          ).join('')}
        </div>
        <div class="${ctx.mode === 'preview' ? 'asesmen-jodoh-col' : ''}">
          ${right.map((r, i) => ctx.mode === 'preview'
            ? `<div class="asesmen-jodoh-item"><strong>${String.fromCharCode(65 + i)}.</strong> ${esc(r)}</div>`
            : `<div style="padding:0.4rem 0.7rem; background:white; border-radius:6px; margin-bottom:0.3rem; font-size:0.8rem;"><strong>${String.fromCharCode(65 + i)}.</strong> ${esc(r)}</div>`
          ).join('')}
        </div>
      </div>`;

      if (ctx.mode === 'preview') {
        return `<div class="asesmen-soal-box">
          <div class="asesmen-soal-num">Menjodohkan · ${points} poin</div>
          <div class="asesmen-soal-question">${esc(question || '(Belum ada instruksi)')}</div>
          ${gridHtml}
        </div>`;
      }

      return `<div class="asesmen-preview-box" ${clickAttr(ctx, `openSoalJodohModal('${comp.id}')`)}>
        <div class="asesmen-soal-preview">
          <span class="asesmen-soal-number">Menjodohkan · ${points} poin</span>
          <div class="asesmen-soal-text">${esc(question || '(Belum ada instruksi)')}</div>
          ${gridHtml}
          <div class="lkpd-hint" style="background:#ddd6fe; color:#6d28d9;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    soal_benar_salah: (data, comp, ctx) => {
      const question = data.question || '';
      const correct = data.correct === true;
      const points = data.points || 5;

      if (ctx.mode === 'preview') {
        return `<div class="asesmen-soal-box">
          <div class="asesmen-soal-num">Benar/Salah · ${points} poin</div>
          <div class="asesmen-soal-question">${esc(question || '(Belum ada pernyataan)')}</div>
          <div class="asesmen-bs-row">
            <div class="asesmen-bs-item">BENAR</div>
            <div class="asesmen-bs-item">SALAH</div>
          </div>
        </div>`;
      }

      return `<div class="asesmen-preview-box" ${clickAttr(ctx, `openSoalBSModal('${comp.id}')`)}>
        <div class="asesmen-soal-preview">
          <span class="asesmen-soal-number">Benar/Salah · ${points} poin</span>
          <div class="asesmen-soal-text">${esc(question || '(Belum ada pernyataan)')}</div>
          <div style="display:flex; gap:0.5rem;">
            <span class="asesmen-jawaban-item ${correct ? 'correct' : ''}" style="flex:1; justify-content:center;">BENAR</span>
            <span class="asesmen-jawaban-item ${!correct ? 'correct' : ''}" style="flex:1; justify-content:center;">SALAH</span>
          </div>
          <div class="lkpd-hint" style="background:#ddd6fe; color:#6d28d9;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    // ============================================
    // REFLEKSI
    // ============================================

    pertanyaan_refleksi: (data, comp, ctx) => {
      const question = data.question || '';
      const placeholder_ = data.placeholder || '';
      const isTextarea = (data.answer_type || 'textarea') === 'textarea';

      const inputHtml = isTextarea
        ? `<textarea class="lkpd-readonly-textarea" placeholder="${esc(placeholder_ || 'Refleksi siswa...')}" readonly></textarea>`
        : `<input type="text" class="lkpd-readonly-input" placeholder="${esc(placeholder_ || 'Refleksi siswa...')}" readonly>`;

      if (ctx.mode === 'preview') {
        return `<div class="refleksi-question-box">
          <div class="refleksi-question-title"><i class="fas fa-question"></i> Pertanyaan Refleksi</div>
          <div class="refleksi-question-text">${esc(question || '(Belum ada pertanyaan)')}</div>
          ${inputHtml}
        </div>`;
      }

      return `<div class="refleksi-preview-box" ${clickAttr(ctx, `openPertanyaanRefleksiModal('${comp.id}')`)}>
        <div style="padding:1rem 1.2rem; background:#fce7f3; border-left:4px solid var(--pink); border-radius:8px;">
          <div style="font-weight:800; color:#be185d; margin-bottom:0.4rem; font-size:0.9rem;"><i class="fas fa-question"></i> Pertanyaan Refleksi</div>
          <div style="font-size:0.88rem; color:#831843;">${esc(question || '(Belum ada pertanyaan)')}</div>
          <div class="lkpd-hint" style="background:#fbcfe8; color:#be185d;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    mood_tracker: (data, comp, ctx) => {
      const label = data.label || 'Mood Tracker';
      const opts = data.options || [];

      const parsed = opts.map(o => {
        const parts = String(o).split(' ');
        return { emoji: parts[0] || '😐', label: parts.slice(1).join(' ') || o };
      });

      if (ctx.mode === 'preview') {
        return `<div class="refleksi-question-box">
          <div class="refleksi-question-title"><i class="fas fa-face-smile"></i> ${esc(label)}</div>
          <div class="mood-grid">
            ${parsed.map(p => `<div class="mood-item-card"><span class="mood-emoji">${p.emoji}</span><span>${esc(p.label)}</span></div>`).join('')}
          </div>
        </div>`;
      }

      return `<div class="refleksi-preview-box" ${clickAttr(ctx, `openMoodTrackerModal('${comp.id}')`)}>
        <div style="padding:1rem 1.2rem; background:#fce7f3; border-left:4px solid var(--pink); border-radius:8px;">
          <div style="font-weight:800; color:#be185d; margin-bottom:0.6rem; font-size:0.9rem;"><i class="fas fa-face-smile"></i> ${esc(label)}</div>
          <div class="mood-tracker-preview">
            ${parsed.map(p => `<div class="mood-item"><span class="emoji-big">${p.emoji}</span>${esc(p.label)}</div>`).join('')}
          </div>
          <div class="lkpd-hint" style="background:#fbcfe8; color:#be185d;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    target_belajar: (data, comp, ctx) => {
      const label = data.label || '';
      const placeholder_ = data.placeholder || '';

      if (ctx.mode === 'preview') {
        return `<div class="refleksi-question-box">
          <div class="refleksi-question-title"><i class="fas fa-bullseye"></i> Target Belajar</div>
          <div class="refleksi-question-text">${esc(label || '(Belum ada label)')}</div>
          <input type="text" class="lkpd-readonly-input" placeholder="${esc(placeholder_ || 'Target siswa...')}" readonly>
        </div>`;
      }

      return `<div class="refleksi-preview-box" ${clickAttr(ctx, `openTargetBelajarModal('${comp.id}')`)}>
        <div style="padding:1rem 1.2rem; background:#fce7f3; border-left:4px solid var(--pink); border-radius:8px;">
          <div style="font-weight:800; color:#be185d; margin-bottom:0.4rem; font-size:0.9rem;"><i class="fas fa-bullseye"></i> Target Belajar</div>
          <div style="font-size:0.88rem; color:#831843; margin-bottom:0.5rem;">${esc(label || '(Belum ada label)')}</div>
          <input type="text" class="lkpd-input-preview" placeholder="${esc(placeholder_)}" readonly>
          <div class="lkpd-hint" style="background:#fbcfe8; color:#be185d;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    tombol_submit_refleksi: (data, comp, ctx) => {
      const label = data.label || 'Kirim Refleksi';

      if (ctx.mode === 'preview') {
        return `<div class="submit-btn-preview" style="background:#fce7f3; border-color:var(--pink);">
          <button style="background:var(--pink);"><i class="fas fa-paper-plane"></i> ${esc(label)}</button>
        </div>`;
      }

      return `<div class="refleksi-preview-box" ${clickAttr(ctx, `openTombolSubmitRefleksiModal('${comp.id}')`)}>
        <div style="text-align:center; padding:1rem; background:#fce7f3; border:2px dashed var(--pink); border-radius:8px;">
          <button style="pointer-events:none; padding:0.6rem 1.5rem; background:var(--pink); color:white; border:none; border-radius:8px; font-weight:700;">
            <i class="fas fa-paper-plane"></i> ${esc(label)}
          </button>
          <div class="lkpd-hint" style="background:#fbcfe8; color:#be185d;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    // ============================================
    // DISKUSI
    // ============================================

    topik_diskusi: (data, comp, ctx) => {
      const title = data.title || 'Topik Diskusi';
      const description = data.description || '';

      if (ctx.mode === 'preview') {
        return `<div class="diskusi-topik-box">
          <div class="diskusi-topik-title"><i class="fas fa-comment-dots"></i> ${esc(title)}</div>
          <div class="diskusi-topik-desc">${esc(description)}</div>
        </div>`;
      }

      return `<div class="refleksi-preview-box" ${clickAttr(ctx, `openTopikDiskusiModal('${comp.id}')`)}>
        <div style="padding:1rem 1.2rem; background:#d1fae5; border-left:4px solid #10b981; border-radius:8px;">
          <div style="font-weight:800; color:#047857; margin-bottom:0.4rem; font-size:0.9rem;"><i class="fas fa-comment-dots"></i> ${esc(title)}</div>
          <div style="font-size:0.85rem; color:#065f46; white-space:pre-wrap;">${esc(description || '(Belum ada deskripsi)')}</div>
          <div class="lkpd-hint" style="background:#a7f3d0; color:#047857;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    aturan_diskusi: (data, comp, ctx) => {
      const title = data.title || 'Aturan Diskusi';
      const text = data.text || '';

      if (ctx.mode === 'preview') {
        return `<div class="diskusi-aturan-box">
          <div class="diskusi-aturan-title"><i class="fas fa-scroll"></i> ${esc(title)}</div>
          <div class="diskusi-aturan-text">${esc(text)}</div>
        </div>`;
      }

      return `<div class="refleksi-preview-box" ${clickAttr(ctx, `openAturanDiskusiModal('${comp.id}')`)}>
        <div style="padding:1rem 1.2rem; background:#fef3c7; border-left:4px solid var(--warning); border-radius:8px;">
          <div style="font-weight:800; color:#92400e; margin-bottom:0.4rem; font-size:0.9rem;"><i class="fas fa-scroll"></i> ${esc(title)}</div>
          <div style="font-size:0.85rem; color:#78350f; white-space:pre-wrap;">${esc(text || '(Belum ada aturan)')}</div>
          <div class="lkpd-hint" style="background:#fde68a; color:#92400e;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    kolom_komentar: (data, comp, ctx) => {
      const label = data.label || 'Diskusi Kelas';
      const placeholder_ = data.placeholder || 'Tulis komentar...';

      if (ctx.mode === 'preview') {
        return `<div class="komentar-box">
          <div class="komentar-header"><i class="fas fa-comments"></i> ${esc(label)}</div>
          <div class="komentar-input-preview">
            <input type="text" placeholder="${esc(placeholder_)}" readonly>
            <button>Kirim</button>
          </div>
        </div>`;
      }

      return `<div class="refleksi-preview-box" ${clickAttr(ctx, `openKolomKomentarModal('${comp.id}')`)}>
        <div style="padding:1rem 1.2rem; background:var(--bg-soft); border:2px dashed #10b981; border-radius:8px;">
          <div style="font-weight:800; color:#047857; margin-bottom:0.4rem; font-size:0.9rem;"><i class="fas fa-comments"></i> ${esc(label)}</div>
          <div style="padding:0.6rem 0.9rem; background:white; border:1px solid var(--border); border-radius:8px; color:var(--text-muted); font-size:0.82rem; font-style:italic;">${esc(placeholder_)}</div>
          <div class="lkpd-hint" style="background:#a7f3d0; color:#047857;">Klik untuk edit</div>
        </div>
      </div>`;
    },

    // ============================================
    // LAINNYA
    // ============================================

    note: (data, comp, ctx) => {
      const variant = data.variant || 'info';
      const title = data.title || '';
      const text = data.text || '';

      if (!title && !text) {
        if (ctx.mode === 'preview') return '';
        return `<div ${clickAttr(ctx, `openNoteModal('${comp.id}')`)}>${placeholder(ctx, 'fa-note-sticky', 'Klik untuk menambahkan note')}</div>`;
      }

      const vMap = {
        info:    { bg: '#dbeafe', color: '#1e40af', border: '#3b82f6', icon: 'fa-circle-info' },
        success: { bg: '#d1fae5', color: '#047857', border: '#10b981', icon: 'fa-circle-check' },
        warning: { bg: '#fef3c7', color: '#92400e', border: '#f59e0b', icon: 'fa-triangle-exclamation' },
        danger:  { bg: '#fee2e2', color: '#b91c1c', border: '#ef4444', icon: 'fa-circle-xmark' }
      };
      const v = vMap[variant] || vMap.info;

      const inner = `<div style="padding:0.9rem 1.1rem; background:${v.bg}; border-left:4px solid ${v.border}; border-radius:8px; color:${v.color};">
        ${title ? `<div style="font-weight:800; margin-bottom:0.3rem; display:flex; align-items:center; gap:6px;"><i class="fas ${v.icon}"></i> ${esc(title)}</div>` : ''}
        <div style="font-size:0.88rem; white-space:pre-wrap;">${esc(text)}</div>
      </div>`;

      if (ctx.mode === 'preview') return inner;

      return `<div ${clickAttr(ctx, `openNoteModal('${comp.id}')`)} style="cursor:pointer;">${inner}</div>`;
    },

    accordion: (data, comp, ctx) => {
      const items = data.items || [];

      if (items.length === 0) {
        return `<div ${clickAttr(ctx, `openAccordionModal('${comp.id}')`)}>${placeholder(ctx, 'fa-list', 'Klik untuk menambahkan accordion')}</div>`;
      }

      const inner = items.map(it => `<details style="margin-bottom:0.5rem; background:var(--bg-soft); border-radius:8px; border:1px solid var(--border);">
        <summary style="padding:0.7rem 1rem; cursor:pointer; font-weight:700; font-size:0.88rem; color:var(--text);">${esc(it.title || 'Tanpa judul')}</summary>
        <div style="padding:0.8rem 1rem; border-top:1px solid var(--border); font-size:0.85rem; color:var(--text-secondary); line-height:1.6; white-space:pre-wrap;">${esc(it.content || '')}</div>
      </details>`).join('');

      if (ctx.mode === 'preview') return inner;

      return `<div ${clickAttr(ctx, `openAccordionModal('${comp.id}')`)} style="cursor:pointer;">${inner}</div>`;
    },

    file: (data, comp, ctx) => {
      const url = data.url || '';
      const label = data.label || 'Download File';
      const description = data.description || '';

      if (!url) {
        return `<div ${clickAttr(ctx, `openFileModal('${comp.id}')`)}>${placeholder(ctx, 'fa-file-arrow-down', 'Klik untuk menambahkan file')}</div>`;
      }

      const inner = `<div style="display:flex; align-items:center; gap:0.9rem; padding:0.9rem 1.1rem; background:var(--green-lighter); border:1px solid var(--green-light); border-radius:8px;">
        <div style="width:44px; height:44px; background:var(--green); color:white; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;"><i class="fas fa-file-arrow-down"></i></div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:700; font-size:0.88rem; color:var(--green-dark);">${esc(label)}</div>
          ${description ? `<div style="font-size:0.75rem; color:var(--text-muted);">${esc(description)}</div>` : ''}
        </div>
        <i class="fas fa-download" style="color:var(--green);"></i>
      </div>`;

      if (ctx.mode === 'preview') {
        return `<a href="${esc(url)}" target="_blank" rel="noopener" style="text-decoration:none; display:block;">${inner}</a>`;
      }

      return `<div ${clickAttr(ctx, `openFileModal('${comp.id}')`)} style="cursor:pointer;">${inner}</div>`;
    },

    embed: (data, comp, ctx) => {
      const url = data.url || '';
      const height = data.height || 500;

      if (!url) {
        return `<div ${clickAttr(ctx, `openEmbedModal('${comp.id}')`)}>${placeholder(ctx, 'fa-code', 'Klik untuk menambahkan embed')}</div>`;
      }

      const iframe = `<iframe src="${esc(url)}" style="width:100%; height:${height}px; border:1px solid var(--border); border-radius:8px; background:white;" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;

      if (ctx.mode === 'preview') return iframe;

      return `<div ${clickAttr(ctx, `openEmbedModal('${comp.id}')`)} style="cursor:pointer;">${iframe}</div>`;
    },

  }; // END COMPONENT_RENDERERS

  // ============================================
  // DRIVE URL HELPERS (dipakai renderer)
  // ============================================

  function extractDriveId(url) {
    if (!url) return null;
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/,
      /\/d\/([a-zA-Z0-9_-]+)/,
      /[?&]id=([a-zA-Z0-9_-]+)/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }

  function convertDriveUrl(url, type = 'image') {
    if (!url) return '';
    const id = extractDriveId(url);
    if (!id) return url;
    if (type === 'image') return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
    if (type === 'video') return `https://drive.google.com/file/d/${id}/preview`;
    return url;
  }

  function toEmbedVideoUrl(url) {
    if (!url) return '';
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    const driveId = extractDriveId(url);
    if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
    if (url.includes('embed') || url.includes('/iframe')) return url;
    return '';
  }

  // ============================================
  // MAIN FUNCTION: render satu komponen
  // ============================================

  /**
   * Render satu komponen ke HTML string.
   *
   * @param {object} comp    - objek komponen ({ id, component_type, component_data, ... })
   * @param {object} opts    - { mode: 'edit' | 'preview' }
   * @returns {string} HTML
   */
  function renderComponent(comp, opts) {
    if (!comp || !comp.component_type) {
      return '<p style="color:var(--danger); font-size:0.85rem;">[Komponen tidak valid]</p>';
    }

    const mode = (opts && opts.mode) || 'edit';
    const renderer = COMPONENT_RENDERERS[comp.component_type];

    if (!renderer) {
      console.warn('[editor-renderers] Tidak ada renderer untuk:', comp.component_type);
      return `<p style="color:var(--text-muted); font-style:italic; font-size:0.85rem;">[Komponen "${esc(comp.component_type)}" — renderer belum tersedia]</p>`;
    }

    const ctx = {
      mode,
      escapeHtml: esc,
      helpers: { convertDriveUrl, toEmbedVideoUrl }
    };

    try {
      return renderer(comp.component_data || {}, comp, ctx);
    } catch (err) {
      console.error('[editor-renderers] Error render', comp.component_type, err);
      return `<div style="padding:0.8rem; background:#fee2e2; color:#b91c1c; border-radius:6px; font-size:0.82rem;">⚠️ Gagal render komponen: ${esc(err.message)}</div>`;
    }
  }

  // ============================================
  // EXPORT
  // ============================================

  global.COMPONENT_RENDERERS = COMPONENT_RENDERERS;
  global.renderComponent = renderComponent;
  global.convertDriveUrl = convertDriveUrl;
  global.toEmbedVideoUrl = toEmbedVideoUrl;
  global.extractDriveId = extractDriveId;

  console.log('[editor-renderers] Loaded. Total renderer:', Object.keys(COMPONENT_RENDERERS).length);

})(window);