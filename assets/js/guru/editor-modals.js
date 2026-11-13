// ============================================
// EDITOR-MODALS.JS — Tembok Belajar
// Registry MODAL + handler SAVE per tipe komponen.
//
// 🎯 CARA MENAMBAH MODAL BARU:
//   1. Tambah markup modal di unit-editor.html (id="modalXxx")
//   2. Tambah entry di EditorModals[type] = { open, close, save }
//   3. Tambah open function global di window (untuk onclick handler)
//
// 🎯 STRUKTUR:
//   EditorModals = { _state, _helpers, ...registry }
//   Setiap entry punya: open(compId), close(), save()
//
// 🎯 STATE PATTERN:
//   Setiap modal punya state lokal di _state[type].
//   Setelah save → update DB → trigger re-render via callback.
// ============================================

(function (global) {
  'use strict';

  // ============================================
  // DEPENDENCIES INJECTED DARI SHELL
  // Shell (unit-editor.html) wajib set:
  //   window.EDITOR_CTX = {
  //     currentUser, currentUnit, activities,
  //     getActiveActivityId: () => string,
  //     getComponents: () => array,
  //     reloadComponents: async () => void,
  //     showToast: (msg, type) => void,
  //     updateComponentInState: (compId, newData) => void
  //   }
  // ============================================

  function ctx() {
    return window.EDITOR_CTX || {};
  }

  function esc(t) {
    if (t === null || t === undefined) return '';
    const d = document.createElement('div');
    d.textContent = String(t);
    return d.innerHTML;
  }

  function showToast(msg, type) {
    if (typeof ctx().showToast === 'function') return ctx().showToast(msg, type);
    console.log('[toast]', type || 'info', msg);
  }

  function $(id) { return document.getElementById(id); }

  function setHidden(id, hidden) {
    const el = $(id);
    if (!el) return;
    if (hidden) el.classList.add('hidden');
    else el.classList.remove('hidden');
  }

  function openOverlay(id) {
    const el = $(id);
    if (el) el.classList.add('active');
  }

  function closeOverlay(id) {
    const el = $(id);
    if (el) el.classList.remove('active');
  }

  // Update component data di state + DB + re-render
  async function persistAndRerender(compId, newData, successMsg) {
    try {
      await updateActivityComponent(compId, { component_data: newData });

      // Update state lokal supaya tidak perlu fetch ulang
      if (typeof ctx().updateComponentInState === 'function') {
        ctx().updateComponentInState(compId, newData);
      }

      // Re-render canvas (kecuali text — biar Quill tidak reset)
      if (typeof ctx().reloadComponents === 'function') {
        await ctx().reloadComponents();
      }

      if (successMsg) showToast(successMsg, 'success');
      return true;
    } catch (err) {
      console.error('[editor-modals] persist error:', err);
      showToast('Gagal: ' + (err.message || 'Unknown error'), 'error');
      return false;
    }
  }

  function getComp(compId) {
    const comps = (typeof ctx().getComponents === 'function') ? ctx().getComponents() : [];
    return comps.find(c => String(c.id) === String(compId));
  }

  // ============================================
  // GLOBAL STATE
  // ============================================
  const _state = {
    heading:  { editingCompId: null },
    image:    { editingCompId: null },
    video:    { editingCompId: null },
    audio:    { editingCompId: null },
    table:    { editingCompId: null, columns: [], rows: [], widths: [] },
    note:     { editingCompId: null },
    accordion:{ editingCompId: null, items: [] },
    file:     { editingCompId: null },
    embed:    { editingCompId: null },

    // LKPD
    identitas:       { editingCompId: null },
    petunjuk:        { editingCompId: null },
    input_teks:      { editingCompId: null },
    textarea:        { editingCompId: null },
    options:         { editingCompId: null, type: null, label: '', options: [], required: false },
    tabel_isian:     { editingCompId: null, label: '', columns: [], rows: [] },
    penilaian_diri:  { editingCompId: null },
    tombol_submit:   { editingCompId: null },

    // Asesmen
    asesmen_setting: { editingCompId: null },
    soal_pg:         { editingCompId: null, question: '', options: [], correct: 0, points: 10, feedback: '' },
    soal_pg_kompleks:{ editingCompId: null, question: '', options: [], correct: [], points: 15, feedback: '' },
    soal_esai:       { editingCompId: null },
    soal_menjodohkan:{ editingCompId: null, question: '', left: [], right: [], points: 15 },
    soal_benar_salah:{ editingCompId: null },

    // Refleksi
    pertanyaan_refleksi:    { editingCompId: null },
    mood_tracker:           { editingCompId: null },
    target_belajar:         { editingCompId: null },
    tombol_submit_refleksi: { editingCompId: null },

    // Diskusi
    topik_diskusi:  { editingCompId: null },
    aturan_diskusi: { editingCompId: null },
    kolom_komentar: { editingCompId: null },

    // Color picker (dipakai Quill)
    colorPicker: { quill: null, type: null }
  };

  // ============================================
  // PRESET COLORS (dipakai Quill color picker)
  // ============================================
  const PRESET_COLORS = [
    '#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#a7f3d0',
    '#bae6fd', '#c7d2fe', '#ddd6fe', '#fbcfe8', '#e2e8f0',
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981',
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
    '#7f1d1d', '#7c2d12', '#713f12', '#14532d', '#064e3b',
    '#1e3a8a', '#312e81', '#4c1d95', '#831843', '#0f172a'
  ];

  // ============================================
  // MODALS — REKAP
  // ============================================

  const EditorModals = {

    // ============================================
    // 1. HEADING
    // ============================================
    heading: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.heading.editingCompId = compId;
        const data = comp.component_data || {};

        $('headingTextInput').value = data.text || '';
        $('headingLevelSelect').value = data.level || 'h2';
        $('headingAlignSelect').value = data.align || 'left';
        $('headingColorInput').value = data.color || '#0f172a';

        updateHeadingPreview();
        openOverlay('modalHeadingEditor');
      },
      close() {
        closeOverlay('modalHeadingEditor');
        _state.heading.editingCompId = null;
      },
      async save() {
        const compId = _state.heading.editingCompId;
        if (!compId) return;

        const newData = {
          text: $('headingTextInput').value.trim(),
          level: $('headingLevelSelect').value,
          align: $('headingAlignSelect').value,
          color: $('headingColorInput').value
        };

        const ok = await persistAndRerender(compId, newData, '✅ Judul diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // 2. IMAGE
    // ============================================
    image: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.image.editingCompId = compId;
        const data = comp.component_data || {};

        $('imageUrlInput').value = data.url || '';
        $('imageAltInput').value = data.alt || '';
        $('imageCaptionInput').value = data.caption || '';
        $('imageAlignSelect').value = data.align || 'center';

        updateImagePreview();
        openOverlay('modalImageEditor');
      },
      close() {
        closeOverlay('modalImageEditor');
        _state.image.editingCompId = null;
      },
      async save() {
        const compId = _state.image.editingCompId;
        if (!compId) return;

        const url = $('imageUrlInput').value.trim();
        if (!url) { showToast('URL wajib', 'error'); return; }

        const newData = {
          url,
          alt: $('imageAltInput').value.trim(),
          caption: $('imageCaptionInput').value.trim(),
          align: $('imageAlignSelect').value
        };

        const ok = await persistAndRerender(compId, newData, '✅ Gambar diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // 3. VIDEO
    // ============================================
    video: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.video.editingCompId = compId;
        const data = comp.component_data || {};

        $('videoUrlInput').value = data.url || '';
        $('videoCaptionInput').value = data.caption || '';

        updateVideoPreview();
        openOverlay('modalVideoEditor');
      },
      close() {
        closeOverlay('modalVideoEditor');
        _state.video.editingCompId = null;
      },
      async save() {
        const compId = _state.video.editingCompId;
        if (!compId) return;

        const url = $('videoUrlInput').value.trim();
        if (!url) { showToast('URL wajib', 'error'); return; }

        const newData = { url, caption: $('videoCaptionInput').value.trim() };
        const ok = await persistAndRerender(compId, newData, '✅ Video diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // 4. AUDIO
    // ============================================
    audio: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.audio.editingCompId = compId;
        const data = comp.component_data || {};

        $('audioUrlInput').value = data.url || '';
        $('audioCaptionInput').value = data.caption || '';

        updateAudioPreview();
        openOverlay('modalAudioEditor');
      },
      close() {
        closeOverlay('modalAudioEditor');
        _state.audio.editingCompId = null;
      },
      async save() {
        const compId = _state.audio.editingCompId;
        if (!compId) return;

        const url = $('audioUrlInput').value.trim();
        if (!url) { showToast('URL wajib', 'error'); return; }

        const newData = { url, caption: $('audioCaptionInput').value.trim() };
        const ok = await persistAndRerender(compId, newData, '✅ Audio diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // 5. TABLE
    // ============================================
    table: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.table.editingCompId = compId;
        const data = comp.component_data || {};

        _state.table.columns = [...(data.columns || [])];
        _state.table.rows = (data.rows || []).map(r => [...r]);
        _state.table.widths = [...(data.widths || [])];

        if (_state.table.columns.length === 0) {
          _state.table.columns = ['Kolom 1', 'Kolom 2'];
          _state.table.rows = [['', ''], ['', '']];
          _state.table.widths = [50, 50];
        }
        while (_state.table.widths.length < _state.table.columns.length) {
          _state.table.widths.push(100 / _state.table.columns.length);
        }

        renderTableEditor();
        openOverlay('modalTableEditor');
      },
      close() {
        closeOverlay('modalTableEditor');
        _state.table.editingCompId = null;
        _state.table.columns = [];
        _state.table.rows = [];
        _state.table.widths = [];
      },
      addColumn() {
        if (_state.table.columns.length === 0) return;
        _state.table.columns.push('Kolom ' + (_state.table.columns.length + 1));
        _state.table.rows.forEach(r => r.push(''));
        const n = _state.table.columns.length;
        _state.table.widths = new Array(n).fill(100 / n);
        renderTableEditor();
      },
      addRow() {
        if (_state.table.columns.length === 0) return;
        _state.table.rows.push(new Array(_state.table.columns.length).fill(''));
        renderTableEditor();
      },
      updateColumn(ci, v) { _state.table.columns[ci] = v; },
      updateCell(ri, ci, v) { _state.table.rows[ri][ci] = v; },
      deleteColumn(ci) {
        if (_state.table.columns.length <= 1) { showToast('Minimal 1 kolom', 'error'); return; }
        _state.table.columns.splice(ci, 1);
        _state.table.widths.splice(ci, 1);
        _state.table.rows.forEach(r => r.splice(ci, 1));
        renderTableEditor();
      },
      async save() {
        const compId = _state.table.editingCompId;
        if (!compId) return;

        const newData = {
          columns: [..._state.table.columns],
          rows: _state.table.rows.map(r => [...r]),
          widths: [..._state.table.widths]
        };

        const ok = await persistAndRerender(compId, newData, '✅ Tabel diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // 6. NOTE
    // ============================================
    note: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.note.editingCompId = compId;
        const data = comp.component_data || {};

        $('noteTitleInput').value = data.title || '';
        $('noteTextInput').value = data.text || '';
        document.querySelectorAll('input[name="noteVariant"]').forEach(r => {
          r.checked = (r.value === (data.variant || 'info'));
        });

        updateNotePreview();
        openOverlay('modalNoteEditor');
      },
      close() {
        closeOverlay('modalNoteEditor');
        _state.note.editingCompId = null;
      },
      async save() {
        const compId = _state.note.editingCompId;
        if (!compId) return;

        const variant = (document.querySelector('input[name="noteVariant"]:checked') || {}).value || 'info';
        const title = $('noteTitleInput').value.trim();
        const text = $('noteTextInput').value.trim();

        if (!title && !text) { showToast('Isi judul atau teks', 'error'); return; }

        const ok = await persistAndRerender(compId, { variant, title, text }, '✅ Note diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // 7. ACCORDION
    // ============================================
    accordion: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.accordion.editingCompId = compId;
        const data = comp.component_data || {};

        _state.accordion.items = (data.items || []).map(it => ({
          title: it.title || '',
          content: it.content || ''
        }));
        if (_state.accordion.items.length === 0) {
          _state.accordion.items = [{ title: '', content: '' }];
        }

        renderAccordionEditor();
        openOverlay('modalAccordionEditor');
      },
      close() {
        closeOverlay('modalAccordionEditor');
        _state.accordion.editingCompId = null;
        _state.accordion.items = [];
      },
      addItem() {
        _state.accordion.items.push({ title: '', content: '' });
        renderAccordionEditor();
      },
      deleteItem(i) {
        if (_state.accordion.items.length <= 1) { showToast('Minimal 1 item', 'error'); return; }
        _state.accordion.items.splice(i, 1);
        renderAccordionEditor();
      },
      updateTitle(i, v) { _state.accordion.items[i].title = v; },
      updateContent(i, v) { _state.accordion.items[i].content = v; },
      async save() {
        const compId = _state.accordion.editingCompId;
        if (!compId) return;

        const newData = {
          items: _state.accordion.items.map(it => ({ title: it.title, content: it.content }))
        };

        const ok = await persistAndRerender(compId, newData, '✅ Accordion diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // 8. FILE
    // ============================================
    file: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.file.editingCompId = compId;
        const data = comp.component_data || {};

        $('fileUrlInput').value = data.url || '';
        $('fileLabelInput').value = data.label || 'Download File';
        $('fileDescInput').value = data.description || '';

        openOverlay('modalFileEditor');
      },
      close() {
        closeOverlay('modalFileEditor');
        _state.file.editingCompId = null;
      },
      async save() {
        const compId = _state.file.editingCompId;
        if (!compId) return;

        const url = $('fileUrlInput').value.trim();
        const label = $('fileLabelInput').value.trim();
        if (!url || !label) { showToast('URL & label wajib', 'error'); return; }

        const newData = { url, label, description: $('fileDescInput').value.trim() };
        const ok = await persistAndRerender(compId, newData, '✅ File diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // 9. EMBED
    // ============================================
    embed: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.embed.editingCompId = compId;
        const data = comp.component_data || {};

        $('embedUrlInput').value = data.url || '';
        $('embedHeightInput').value = data.height || 500;

        openOverlay('modalEmbedEditor');
      },
      close() {
        closeOverlay('modalEmbedEditor');
        _state.embed.editingCompId = null;
      },
      async save() {
        const compId = _state.embed.editingCompId;
        if (!compId) return;

        const url = $('embedUrlInput').value.trim();
        if (!url) { showToast('URL wajib', 'error'); return; }

        const newData = {
          url,
          height: parseInt($('embedHeightInput').value) || 500
        };
        const ok = await persistAndRerender(compId, newData, '✅ Embed diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // LKPD MODALS
    // ============================================

    // ===== 10. IDENTITAS SISWA =====
    identitas_siswa: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.identitas.editingCompId = compId;
        const data = comp.component_data || {};

        $('identitasLabelInput').value = data.label || 'Identitas Siswa';
        $('identitasShowName').checked = data.show_name !== false;
        $('identitasShowNisn').checked = data.show_nisn !== false;
        $('identitasShowKelas').checked = !!data.show_kelas;
        $('identitasShowTanggal').checked = !!data.show_tanggal;

        openOverlay('modalIdentitas');
      },
      close() {
        closeOverlay('modalIdentitas');
        _state.identitas.editingCompId = null;
      },
      async save() {
        const compId = _state.identitas.editingCompId;
        if (!compId) return;

        const newData = {
          label: $('identitasLabelInput').value.trim() || 'Identitas Siswa',
          show_name: $('identitasShowName').checked,
          show_nisn: $('identitasShowNisn').checked,
          show_kelas: $('identitasShowKelas').checked,
          show_tanggal: $('identitasShowTanggal').checked
        };

        const ok = await persistAndRerender(compId, newData, '✅ Identitas diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 11. PETUNJUK =====
    petunjuk: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.petunjuk.editingCompId = compId;
        const data = comp.component_data || {};

        $('petunjukTitleInput').value = data.title || 'Petunjuk Pengerjaan';
        $('petunjukTextInput').value = data.text || '';

        openOverlay('modalPetunjuk');
      },
      close() {
        closeOverlay('modalPetunjuk');
        _state.petunjuk.editingCompId = null;
      },
      async save() {
        const compId = _state.petunjuk.editingCompId;
        if (!compId) return;

        const text = $('petunjukTextInput').value.trim();
        if (!text) { showToast('Isi petunjuk wajib', 'error'); return; }

        const newData = {
          title: $('petunjukTitleInput').value.trim() || 'Petunjuk',
          text
        };

        const ok = await persistAndRerender(compId, newData, '✅ Petunjuk diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 12. INPUT TEKS =====
    input_teks: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.input_teks.editingCompId = compId;
        const data = comp.component_data || {};

        $('inputTeksLabelInput').value = data.label || '';
        $('inputTeksPlaceholderInput').value = data.placeholder || '';
        $('inputTeksRequiredInput').value = data.required ? 'true' : 'false';

        openOverlay('modalInputTeks');
      },
      close() {
        closeOverlay('modalInputTeks');
        _state.input_teks.editingCompId = null;
      },
      async save() {
        const compId = _state.input_teks.editingCompId;
        if (!compId) return;

        const label = $('inputTeksLabelInput').value.trim();
        if (!label) { showToast('Label wajib', 'error'); return; }

        const newData = {
          label,
          placeholder: $('inputTeksPlaceholderInput').value.trim(),
          required: $('inputTeksRequiredInput').value === 'true'
        };

        const ok = await persistAndRerender(compId, newData, '✅ Input teks diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 13. TEXTAREA =====
    textarea: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.textarea.editingCompId = compId;
        const data = comp.component_data || {};

        $('textareaLabelInput').value = data.label || '';
        $('textareaPlaceholderInput').value = data.placeholder || '';
        $('textareaRowsInput').value = data.rows || 4;
        $('textareaRequiredInput').value = data.required ? 'true' : 'false';

        openOverlay('modalTextarea');
      },
      close() {
        closeOverlay('modalTextarea');
        _state.textarea.editingCompId = null;
      },
      async save() {
        const compId = _state.textarea.editingCompId;
        if (!compId) return;

        const label = $('textareaLabelInput').value.trim();
        if (!label) { showToast('Label wajib', 'error'); return; }

        const newData = {
          label,
          placeholder: $('textareaPlaceholderInput').value.trim(),
          rows: parseInt($('textareaRowsInput').value) || 4,
          required: $('textareaRequiredInput').value === 'true'
        };

        const ok = await persistAndRerender(compId, newData, '✅ Textarea diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 14. OPTIONS (checkbox / radio / dropdown) =====
    options: {
      open(compId, type) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.options.editingCompId = compId;
        _state.options.type = type;

        const data = comp.component_data || {};
        _state.options.label = data.label || '';
        _state.options.options = [...(data.options || ['Opsi 1', 'Opsi 2'])];
        _state.options.required = data.required || false;

        const titles = { checkbox: 'Checkbox (Pilih Banyak)', radio: 'Radio (Pilih Satu)', dropdown: 'Dropdown' };
        const iconMap = { checkbox: 'square-check', radio: 'circle-dot', dropdown: 'caret-down' };

        $('optionsModalTitle').innerHTML = `<i class="fas fa-${iconMap[type]}"></i> Edit ${titles[type]}`;
        $('optionsLabelInput').value = _state.options.label;
        $('optionsRequiredInput').value = _state.options.required ? 'true' : 'false';

        renderOptionsEditor();
        openOverlay('modalOptions');
      },
      close() {
        closeOverlay('modalOptions');
        _state.options.editingCompId = null;
        _state.options.type = null;
        _state.options.options = [];
        _state.options.label = '';
      },
      addOption() {
        _state.options.options.push('Opsi ' + (_state.options.options.length + 1));
        renderOptionsEditor();
      },
      removeOption(i) {
        if (_state.options.options.length <= 1) return;
        _state.options.options.splice(i, 1);
        renderOptionsEditor();
      },
      updateOption(i, v) {
        _state.options.options[i] = v;
      },
      async save() {
        const compId = _state.options.editingCompId;
        if (!compId) return;

        const label = $('optionsLabelInput').value.trim();
        if (!label) { showToast('Label wajib', 'error'); return; }

        const validOptions = _state.options.options.filter(o => o.trim());
        if (validOptions.length === 0) { showToast('Minimal 1 opsi', 'error'); return; }

        const newData = {
          label,
          options: validOptions,
          required: $('optionsRequiredInput').value === 'true'
        };

        const ok = await persistAndRerender(compId, newData, '✅ Opsi diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 15. TABEL ISIAN =====
    tabel_isian: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.tabel_isian.editingCompId = compId;
        const data = comp.component_data || {};

        _state.tabel_isian.label = data.label || '';
        _state.tabel_isian.columns = [...(data.columns || [])];
        _state.tabel_isian.rows = (data.rows || []).map(r => [...r]);

        if (_state.tabel_isian.columns.length === 0) {
          _state.tabel_isian.columns = ['Kolom 1', 'Kolom 2'];
          _state.tabel_isian.rows = [['', ''], ['', '']];
        }

        $('tabelIsianLabelInput').value = _state.tabel_isian.label;
        renderTabelIsianEditor();
        openOverlay('modalTabelIsian');
      },
      close() {
        closeOverlay('modalTabelIsian');
        _state.tabel_isian.editingCompId = null;
        _state.tabel_isian.columns = [];
        _state.tabel_isian.rows = [];
        _state.tabel_isian.label = '';
      },
      addColumn() {
        _state.tabel_isian.columns.push('Kolom ' + (_state.tabel_isian.columns.length + 1));
        _state.tabel_isian.rows.forEach(r => r.push(''));
        renderTabelIsianEditor();
      },
      addRow() {
        _state.tabel_isian.rows.push(new Array(_state.tabel_isian.columns.length).fill(''));
        renderTabelIsianEditor();
      },
      updateColumn(ci, v) { _state.tabel_isian.columns[ci] = v; },
      updateCell(ri, ci, v) { _state.tabel_isian.rows[ri][ci] = v; },
      deleteColumn(ci) {
        if (_state.tabel_isian.columns.length <= 1) return;
        _state.tabel_isian.columns.splice(ci, 1);
        _state.tabel_isian.rows.forEach(r => r.splice(ci, 1));
        renderTabelIsianEditor();
      },
      async save() {
        const compId = _state.tabel_isian.editingCompId;
        if (!compId) return;

        const newData = {
          label: $('tabelIsianLabelInput').value.trim(),
          columns: [..._state.tabel_isian.columns],
          rows: _state.tabel_isian.rows.map(r => [...r])
        };

        const ok = await persistAndRerender(compId, newData, '✅ Tabel isian diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 16. PENILAIAN DIRI =====
    penilaian_diri: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.penilaian_diri.editingCompId = compId;
        const data = comp.component_data || {};

        $('penilaianDiriLabelInput').value = data.label || '';
        $('penilaianDiriMinInput').value = data.min || 1;
        $('penilaianDiriMaxInput').value = data.max || 5;
        $('penilaianDiriLabelsInput').value = (data.labels || []).join(', ');

        openOverlay('modalPenilaianDiri');
      },
      close() {
        closeOverlay('modalPenilaianDiri');
        _state.penilaian_diri.editingCompId = null;
      },
      async save() {
        const compId = _state.penilaian_diri.editingCompId;
        if (!compId) return;

        const label = $('penilaianDiriLabelInput').value.trim();
        if (!label) { showToast('Label wajib', 'error'); return; }

        const labelsRaw = $('penilaianDiriLabelsInput').value.trim();
        const labels = labelsRaw ? labelsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

        const newData = {
          label,
          min: parseInt($('penilaianDiriMinInput').value) || 1,
          max: parseInt($('penilaianDiriMaxInput').value) || 5,
          labels
        };

        const ok = await persistAndRerender(compId, newData, '✅ Penilaian diri diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 17. TOMBOL SUBMIT =====
    tombol_submit: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.tombol_submit.editingCompId = compId;
        const data = comp.component_data || {};

        $('tombolSubmitLabelInput').value = data.label || 'Kumpulkan Jawaban';
        $('tombolSubmitMsgInput').value = data.success_message || 'Jawaban berhasil dikumpulkan!';

        openOverlay('modalTombolSubmit');
      },
      close() {
        closeOverlay('modalTombolSubmit');
        _state.tombol_submit.editingCompId = null;
      },
      async save() {
        const compId = _state.tombol_submit.editingCompId;
        if (!compId) return;

        const newData = {
          label: $('tombolSubmitLabelInput').value.trim() || 'Kumpulkan Jawaban',
          success_message: $('tombolSubmitMsgInput').value.trim() || 'Jawaban berhasil dikumpulkan!'
        };

        const ok = await persistAndRerender(compId, newData, '✅ Tombol diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // ASESMEN MODALS
    // ============================================

    // ===== 18. ASESMEN SETTING =====
    asesmen_setting: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.asesmen_setting.editingCompId = compId;
        const data = comp.component_data || {};

        $('asesmenTitleInput').value = data.title || '';
        $('asesmenDescInput').value = data.description || '';
        $('asesmenDurationInput').value = data.duration || 30;
        $('asesmenAutoGradeInput').value = data.auto_grade ? 'true' : 'false';

        openOverlay('modalAsesmenSetting');
      },
      close() {
        closeOverlay('modalAsesmenSetting');
        _state.asesmen_setting.editingCompId = null;
      },
      async save() {
        const compId = _state.asesmen_setting.editingCompId;
        if (!compId) return;

        const newData = {
          title: $('asesmenTitleInput').value.trim(),
          description: $('asesmenDescInput').value.trim(),
          duration: parseInt($('asesmenDurationInput').value) || 30,
          auto_grade: $('asesmenAutoGradeInput').value === 'true'
        };

        const ok = await persistAndRerender(compId, newData, '✅ Pengaturan asesmen diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 19. SOAL PG =====
    soal_pg: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.soal_pg.editingCompId = compId;
        const data = comp.component_data || {};

        _state.soal_pg.question = data.question || '';
        _state.soal_pg.options = [...(data.options || ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'])];
        _state.soal_pg.correct = data.correct || 0;
        _state.soal_pg.points = data.points || 10;
        _state.soal_pg.feedback = data.feedback || '';

        $('soalPGQuestionInput').value = _state.soal_pg.question;
        $('soalPGPointsInput').value = _state.soal_pg.points;
        $('soalPGFeedbackInput').value = _state.soal_pg.feedback;

        renderSoalPGOptions();
        openOverlay('modalSoalPG');
      },
      close() {
        closeOverlay('modalSoalPG');
        _state.soal_pg.editingCompId = null;
      },
      addOption() {
        _state.soal_pg.options.push('Opsi ' + String.fromCharCode(65 + _state.soal_pg.options.length));
        renderSoalPGOptions();
      },
      removeOption(i) {
        if (_state.soal_pg.options.length <= 2) return;
        _state.soal_pg.options.splice(i, 1);
        if (_state.soal_pg.correct >= _state.soal_pg.options.length) _state.soal_pg.correct = 0;
        renderSoalPGOptions();
      },
      updateOption(i, v) {
        _state.soal_pg.options[i] = v;
        renderSoalPGOptions();
      },
      async save() {
        const compId = _state.soal_pg.editingCompId;
        if (!compId) return;

        const question = $('soalPGQuestionInput').value.trim();
        if (!question) { showToast('Pertanyaan wajib', 'error'); return; }

        const correct = parseInt($('soalPGCorrectInput').value) || 0;

        const newData = {
          question,
          options: _state.soal_pg.options.filter(o => o.trim()),
          correct,
          points: parseInt($('soalPGPointsInput').value) || 10,
          feedback: $('soalPGFeedbackInput').value.trim()
        };

        const ok = await persistAndRerender(compId, newData, '✅ Soal PG diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 20. SOAL PG KOMPLEKS =====
    soal_pg_kompleks: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.soal_pg_kompleks.editingCompId = compId;
        const data = comp.component_data || {};

        _state.soal_pg_kompleks.question = data.question || '';
        _state.soal_pg_kompleks.options = [...(data.options || ['Opsi A', 'Opsi B', 'Opsi C'])];
        _state.soal_pg_kompleks.correct = [...(data.correct || [0])];
        _state.soal_pg_kompleks.points = data.points || 15;
        _state.soal_pg_kompleks.feedback = data.feedback || '';

        $('soalPGKQuestionInput').value = _state.soal_pg_kompleks.question;
        $('soalPGKPointsInput').value = _state.soal_pg_kompleks.points;
        $('soalPGKFeedbackInput').value = _state.soal_pg_kompleks.feedback;

        renderSoalPGKOptions();
        openOverlay('modalSoalPGK');
      },
      close() {
        closeOverlay('modalSoalPGK');
        _state.soal_pg_kompleks.editingCompId = null;
      },
      addOption() {
        _state.soal_pg_kompleks.options.push('Opsi ' + String.fromCharCode(65 + _state.soal_pg_kompleks.options.length));
        renderSoalPGKOptions();
      },
      removeOption(i) {
        if (_state.soal_pg_kompleks.options.length <= 2) return;
        _state.soal_pg_kompleks.options.splice(i, 1);
        _state.soal_pg_kompleks.correct = _state.soal_pg_kompleks.correct
          .filter(c => c !== i).map(c => c > i ? c - 1 : c);
        renderSoalPGKOptions();
      },
      updateOption(i, v) {
        _state.soal_pg_kompleks.options[i] = v;
        renderSoalPGKOptions();
      },
      toggleCorrect(i, checked) {
        if (checked) {
          if (!_state.soal_pg_kompleks.correct.includes(i)) _state.soal_pg_kompleks.correct.push(i);
        } else {
          _state.soal_pg_kompleks.correct = _state.soal_pg_kompleks.correct.filter(c => c !== i);
        }
        renderSoalPGKOptions();
      },
      async save() {
        const compId = _state.soal_pg_kompleks.editingCompId;
        if (!compId) return;

        const question = $('soalPGKQuestionInput').value.trim();
        if (!question) { showToast('Pertanyaan wajib', 'error'); return; }
        if (_state.soal_pg_kompleks.correct.length === 0) { showToast('Pilih minimal 1 jawaban benar', 'error'); return; }

        const newData = {
          question,
          options: _state.soal_pg_kompleks.options.filter(o => o.trim()),
          correct: [..._state.soal_pg_kompleks.correct],
          points: parseInt($('soalPGKPointsInput').value) || 15,
          feedback: $('soalPGKFeedbackInput').value.trim()
        };

        const ok = await persistAndRerender(compId, newData, '✅ Soal PG Kompleks diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 21. SOAL ESAI =====
    soal_esai: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.soal_esai.editingCompId = compId;
        const data = comp.component_data || {};

        $('soalEsaiQuestionInput').value = data.question || '';
        $('soalEsaiGuideInput').value = data.guide || '';
        $('soalEsaiPointsInput').value = data.points || 20;
        $('soalEsaiMinWordsInput').value = data.min_words || 10;

        openOverlay('modalSoalEsai');
      },
      close() {
        closeOverlay('modalSoalEsai');
        _state.soal_esai.editingCompId = null;
      },
      async save() {
        const compId = _state.soal_esai.editingCompId;
        if (!compId) return;

        const question = $('soalEsaiQuestionInput').value.trim();
        if (!question) { showToast('Pertanyaan wajib', 'error'); return; }

        const newData = {
          question,
          guide: $('soalEsaiGuideInput').value.trim(),
          points: parseInt($('soalEsaiPointsInput').value) || 20,
          min_words: parseInt($('soalEsaiMinWordsInput').value) || 10
        };

        const ok = await persistAndRerender(compId, newData, '✅ Soal Esai diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 22. SOAL MENJODOHKAN =====
    soal_menjodohkan: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.soal_menjodohkan.editingCompId = compId;
        const data = comp.component_data || {};

        _state.soal_menjodohkan.question = data.question || '';
        _state.soal_menjodohkan.left = [...(data.left || ['', ''])];
        _state.soal_menjodohkan.right = [...(data.right || ['', ''])];
        _state.soal_menjodohkan.points = data.points || 15;

        $('soalJodohQuestionInput').value = _state.soal_menjodohkan.question;
        $('soalJodohPointsInput').value = _state.soal_menjodohkan.points;

        renderSoalJodoh();
        openOverlay('modalSoalJodoh');
      },
      close() {
        closeOverlay('modalSoalJodoh');
        _state.soal_menjodohkan.editingCompId = null;
      },
      addLeft() {
        _state.soal_menjodohkan.left.push('');
        renderSoalJodoh();
      },
      addRight() {
        _state.soal_menjodohkan.right.push('');
        renderSoalJodoh();
      },
      removeLeft(i) {
        if (_state.soal_menjodohkan.left.length <= 1) return;
        _state.soal_menjodohkan.left.splice(i, 1);
        renderSoalJodoh();
      },
      removeRight(i) {
        if (_state.soal_menjodohkan.right.length <= 1) return;
        _state.soal_menjodohkan.right.splice(i, 1);
        renderSoalJodoh();
      },
      updateLeft(i, v) { _state.soal_menjodohkan.left[i] = v; },
      updateRight(i, v) { _state.soal_menjodohkan.right[i] = v; },
      async save() {
        const compId = _state.soal_menjodohkan.editingCompId;
        if (!compId) return;

        const question = $('soalJodohQuestionInput').value.trim();
        if (!question) { showToast('Instruksi wajib', 'error'); return; }
        if (_state.soal_menjodohkan.left.length !== _state.soal_menjodohkan.right.length) {
          showToast('Jumlah kiri dan kanan harus sama', 'error');
          return;
        }

        const newData = {
          question,
          left: _state.soal_menjodohkan.left.filter(l => l.trim()),
          right: _state.soal_menjodohkan.right.filter(r => r.trim()),
          points: parseInt($('soalJodohPointsInput').value) || 15
        };

        const ok = await persistAndRerender(compId, newData, '✅ Soal Menjodohkan diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 23. SOAL BENAR/SALAH =====
    soal_benar_salah: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.soal_benar_salah.editingCompId = compId;
        const data = comp.component_data || {};

        $('soalBSQuestionInput').value = data.question || '';
        $('soalBSCorrectInput').value = data.correct === false ? 'false' : 'true';
        $('soalBSPointsInput').value = data.points || 5;
        $('soalBSFeedbackInput').value = data.feedback || '';

        openOverlay('modalSoalBS');
      },
      close() {
        closeOverlay('modalSoalBS');
        _state.soal_benar_salah.editingCompId = null;
      },
      async save() {
        const compId = _state.soal_benar_salah.editingCompId;
        if (!compId) return;

        const question = $('soalBSQuestionInput').value.trim();
        if (!question) { showToast('Pernyataan wajib', 'error'); return; }

        const newData = {
          question,
          correct: $('soalBSCorrectInput').value === 'true',
          points: parseInt($('soalBSPointsInput').value) || 5,
          feedback: $('soalBSFeedbackInput').value.trim()
        };

        const ok = await persistAndRerender(compId, newData, '✅ Soal Benar/Salah diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // REFLEKSI MODALS
    // ============================================

    // ===== 24. PERTANYAAN REFLEKSI =====
    pertanyaan_refleksi: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.pertanyaan_refleksi.editingCompId = compId;
        const data = comp.component_data || {};

        $('pertanyaanRefleksiQuestionInput').value = data.question || '';
        $('pertanyaanRefleksiPlaceholderInput').value = data.placeholder || '';
        $('pertanyaanRefleksiTypeInput').value = data.answer_type || 'textarea';

        openOverlay('modalPertanyaanRefleksi');
      },
      close() {
        closeOverlay('modalPertanyaanRefleksi');
        _state.pertanyaan_refleksi.editingCompId = null;
      },
      async save() {
        const compId = _state.pertanyaan_refleksi.editingCompId;
        if (!compId) return;

        const question = $('pertanyaanRefleksiQuestionInput').value.trim();
        if (!question) { showToast('Pertanyaan wajib', 'error'); return; }

        const newData = {
          question,
          placeholder: $('pertanyaanRefleksiPlaceholderInput').value.trim(),
          answer_type: $('pertanyaanRefleksiTypeInput').value
        };

        const ok = await persistAndRerender(compId, newData, '✅ Pertanyaan refleksi diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 25. MOOD TRACKER =====
    mood_tracker: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.mood_tracker.editingCompId = compId;
        const data = comp.component_data || {};

        $('moodTrackerLabelInput').value = data.label || '';
        $('moodTrackerOptionsInput').value = (data.options || []).join(', ');

        openOverlay('modalMoodTracker');
      },
      close() {
        closeOverlay('modalMoodTracker');
        _state.mood_tracker.editingCompId = null;
      },
      async save() {
        const compId = _state.mood_tracker.editingCompId;
        if (!compId) return;

        const label = $('moodTrackerLabelInput').value.trim();
        if (!label) { showToast('Label wajib', 'error'); return; }

        const optsRaw = $('moodTrackerOptionsInput').value.trim();
        const options = optsRaw ? optsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

        const ok = await persistAndRerender(compId, { label, options }, '✅ Mood tracker diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 26. TARGET BELAJAR =====
    target_belajar: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.target_belajar.editingCompId = compId;
        const data = comp.component_data || {};

        $('targetBelajarLabelInput').value = data.label || '';
        $('targetBelajarPlaceholderInput').value = data.placeholder || '';

        openOverlay('modalTargetBelajar');
      },
      close() {
        closeOverlay('modalTargetBelajar');
        _state.target_belajar.editingCompId = null;
      },
      async save() {
        const compId = _state.target_belajar.editingCompId;
        if (!compId) return;

        const label = $('targetBelajarLabelInput').value.trim();
        if (!label) { showToast('Label wajib', 'error'); return; }

        const newData = {
          label,
          placeholder: $('targetBelajarPlaceholderInput').value.trim()
        };

        const ok = await persistAndRerender(compId, newData, '✅ Target belajar diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 27. TOMBOL SUBMIT REFLEKSI =====
    tombol_submit_refleksi: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.tombol_submit_refleksi.editingCompId = compId;
        const data = comp.component_data || {};

        $('tombolSubmitRefleksiLabelInput').value = data.label || 'Kirim Refleksi';
        $('tombolSubmitRefleksiMsgInput').value = data.success_message || 'Refleksi berhasil dikirim!';

        openOverlay('modalTombolSubmitRefleksi');
      },
      close() {
        closeOverlay('modalTombolSubmitRefleksi');
        _state.tombol_submit_refleksi.editingCompId = null;
      },
      async save() {
        const compId = _state.tombol_submit_refleksi.editingCompId;
        if (!compId) return;

        const newData = {
          label: $('tombolSubmitRefleksiLabelInput').value.trim() || 'Kirim Refleksi',
          success_message: $('tombolSubmitRefleksiMsgInput').value.trim() || 'Refleksi berhasil dikirim!'
        };

        const ok = await persistAndRerender(compId, newData, '✅ Tombol refleksi diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // DISKUSI MODALS
    // ============================================

    // ===== 28. TOPIK DISKUSI =====
    topik_diskusi: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.topik_diskusi.editingCompId = compId;
        const data = comp.component_data || {};

        $('topikDiskusiTitleInput').value = data.title || '';
        $('topikDiskusiDescInput').value = data.description || '';

        openOverlay('modalTopikDiskusi');
      },
      close() {
        closeOverlay('modalTopikDiskusi');
        _state.topik_diskusi.editingCompId = null;
      },
      async save() {
        const compId = _state.topik_diskusi.editingCompId;
        if (!compId) return;

        const title = $('topikDiskusiTitleInput').value.trim();
        if (!title) { showToast('Judul wajib', 'error'); return; }

        const newData = {
          title,
          description: $('topikDiskusiDescInput').value.trim()
        };

        const ok = await persistAndRerender(compId, newData, '✅ Topik diskusi diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 29. ATURAN DISKUSI =====
    aturan_diskusi: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.aturan_diskusi.editingCompId = compId;
        const data = comp.component_data || {};

        $('aturanDiskusiTitleInput').value = data.title || 'Aturan Diskusi';
        $('aturanDiskusiTextInput').value = data.text || '';

        openOverlay('modalAturanDiskusi');
      },
      close() {
        closeOverlay('modalAturanDiskusi');
        _state.aturan_diskusi.editingCompId = null;
      },
      async save() {
        const compId = _state.aturan_diskusi.editingCompId;
        if (!compId) return;

        const text = $('aturanDiskusiTextInput').value.trim();
        if (!text) { showToast('Isi aturan wajib', 'error'); return; }

        const newData = {
          title: $('aturanDiskusiTitleInput').value.trim() || 'Aturan Diskusi',
          text
        };

        const ok = await persistAndRerender(compId, newData, '✅ Aturan diskusi diperbarui');
        if (ok) this.close();
      }
    },

    // ===== 30. KOLOM KOMENTAR =====
    kolom_komentar: {
      open(compId) {
        const comp = getComp(compId);
        if (!comp) return;
        _state.kolom_komentar.editingCompId = compId;
        const data = comp.component_data || {};

        $('kolomKomentarLabelInput').value = data.label || 'Diskusi Kelas';
        $('kolomKomentarPlaceholderInput').value = data.placeholder || 'Tulis komentar...';

        openOverlay('modalKolomKomentar');
      },
      close() {
        closeOverlay('modalKolomKomentar');
        _state.kolom_komentar.editingCompId = null;
      },
      async save() {
        const compId = _state.kolom_komentar.editingCompId;
        if (!compId) return;

        const newData = {
          label: $('kolomKomentarLabelInput').value.trim() || 'Diskusi Kelas',
          placeholder: $('kolomKomentarPlaceholderInput').value.trim()
        };

        const ok = await persistAndRerender(compId, newData, '✅ Kolom komentar diperbarui');
        if (ok) this.close();
      }
    },

    // ============================================
    // COLOR PICKER (untuk Quill)
    // ============================================
    colorPicker: {
      open(quill, type) {
        _state.colorPicker.quill = quill;
        _state.colorPicker.type = type;
        $('colorPickerTitle').textContent = type === 'color' ? 'Warna Teks' : 'Warna Highlight';
        $('colorPresetGrid').innerHTML = PRESET_COLORS
          .map(c => `<div class="color-swatch" style="background:${c};" onclick="EditorModals.colorPicker.apply('${c}')"></div>`)
          .join('');
        openOverlay('modalColorPicker');
      },
      close() {
        closeOverlay('modalColorPicker');
        _state.colorPicker.quill = null;
        _state.colorPicker.type = null;
      },
      apply(color) {
        const { quill, type } = _state.colorPicker;
        if (!quill) return;
        quill.format(type === 'color' ? 'color' : 'background', color, 'user');
        this.close();
      },
      applyCustom() {
        this.apply($('customColorInput').value);
      },
      remove() {
        const { quill, type } = _state.colorPicker;
        if (!quill) return;
        quill.format(type === 'color' ? 'color' : 'background', false, 'user');
        this.close();
      }
    },

    // ============================================
    // UTILITY: OPEN BY TYPE
    // ============================================
    openByType(type, compId) {
      const modal = this[type];
      if (!modal || typeof modal.open !== 'function') {
        console.warn('[editor-modals] Tidak ada modal untuk tipe:', type);
        return;
      }
      try {
        // Untuk options, butuh argumen kedua (tipe)
        if (type === 'checkbox' || type === 'radio' || type === 'dropdown') {
          this.options.open(compId, type);
        } else {
          modal.open(compId);
        }
      } catch (err) {
        console.error('[editor-modals] openByType error:', type, err);
      }
    },

    // ============================================
    // UTILITY: CLOSE ALL
    // ============================================
    closeAll() {
      const modalIds = [
        'modalAddActivity', 'modalEditActivity', 'modalDeleteActivity',
        'modalColorPicker', 'modalHeadingEditor', 'modalImageEditor',
        'modalVideoEditor', 'modalAudioEditor', 'modalTableEditor',
        'modalNoteEditor', 'modalAccordionEditor', 'modalFileEditor',
        'modalEmbedEditor', 'modalIdentitas', 'modalPetunjuk',
        'modalInputTeks', 'modalTextarea', 'modalOptions',
        'modalTabelIsian', 'modalPenilaianDiri', 'modalTombolSubmit',
        'modalAsesmenSetting', 'modalSoalPG', 'modalSoalPGK',
        'modalSoalEsai', 'modalSoalJodoh', 'modalSoalBS',
        'modalPertanyaanRefleksi', 'modalMoodTracker',
        'modalTargetBelajar', 'modalTombolSubmitRefleksi',
        'modalTopikDiskusi', 'modalAturanDiskusi', 'modalKolomKomentar',
        'modalKelolaKelas', 'modalPublish'
      ];
      modalIds.forEach(id => closeOverlay(id));
    }
  };

  // ============================================
  // RENDER HELPERS (dipakai modal — live preview)
  // ============================================

  function updateHeadingPreview() {
    const text = $('headingTextInput').value || '(Judul kosong)';
    const level = $('headingLevelSelect').value;
    const align = $('headingAlignSelect').value;
    const color = $('headingColorInput').value;
    const sizes = { h1: '1.6rem', h2: '1.3rem', h3: '1.05rem' };
    $('headingLivePreview').innerHTML =
      `<div style="width:100%;font-size:${sizes[level]};font-weight:800;color:${color};text-align:${align};">${esc(text)}</div>`;
  }

  function resetHeadingColor() {
    $('headingColorInput').value = '#0f172a';
    updateHeadingPreview();
  }

  function updateImagePreview() {
    const rawUrl = $('imageUrlInput').value.trim();
    const img = $('imagePreviewImg');
    const empty = $('imagePreviewEmpty');
    if (rawUrl) {
      img.src = convertDriveUrl(rawUrl, 'image');
      img.style.display = 'block';
      empty.style.display = 'none';
      img.onerror = () => {
        img.style.display = 'none';
        empty.style.display = 'block';
        empty.textContent = '⚠️ Gagal memuat. Cek URL atau sharing file.';
      };
    } else {
      img.style.display = 'none';
      empty.style.display = 'block';
      empty.textContent = 'Preview...';
    }
  }

  function updateVideoPreview() {
    const url = $('videoUrlInput').value.trim();
    const c = $('videoPreviewContainer');
    if (!url) {
      c.innerHTML = '<p style="color:var(--text-muted); text-align:center; font-size:0.8rem; margin:0;">Preview...</p>';
      return;
    }
    const embed = toEmbedVideoUrl(url);
    if (embed) {
      c.innerHTML = `<div style="position:relative; padding-bottom:56.25%; height:0; border-radius:8px; overflow:hidden; background:#000;"><iframe src="${esc(embed)}" style="position:absolute; inset:0; width:100%; height:100%; border:0;" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
    } else {
      c.innerHTML = '<p style="color:var(--danger); text-align:center; font-size:0.8rem; margin:0;">⚠️ URL tidak dikenali</p>';
    }
  }

  function updateAudioPreview() {
    const url = $('audioUrlInput').value.trim();
    const p = $('audioPreviewPlayer');
    const e = $('audioPreviewEmpty');
    if (url) {
      p.querySelector('source').src = url;
      p.load();
      p.style.display = 'block';
      e.style.display = 'none';
    } else {
      p.style.display = 'none';
      e.style.display = 'block';
    }
  }

  function updateNotePreview() {
    const v = (document.querySelector('input[name="noteVariant"]:checked') || {}).value || 'info';
    const title = $('noteTitleInput').value;
    const text = $('noteTextInput').value;
    const vMap = {
      info:    { bg: '#dbeafe', color: '#1e40af', border: '#3b82f6', icon: 'fa-circle-info' },
      success: { bg: '#d1fae5', color: '#047857', border: '#10b981', icon: 'fa-circle-check' },
      warning: { bg: '#fef3c7', color: '#92400e', border: '#f59e0b', icon: 'fa-triangle-exclamation' },
      danger:  { bg: '#fee2e2', color: '#b91c1c', border: '#ef4444', icon: 'fa-circle-xmark' }
    };
    const vm = vMap[v] || vMap.info;
    const c = $('notePreviewContainer');
    c.style.background = vm.bg;
    c.style.borderLeftColor = vm.border;
    c.style.color = vm.color;
    if (!title && !text) {
      c.innerHTML = '<div style="font-size:0.85rem; font-style:italic; opacity:0.7;">Preview...</div>';
    } else {
      c.innerHTML = `${title ? `<div style="font-weight:800; margin-bottom:0.3rem;"><i class="fas ${vm.icon}"></i> ${esc(title)}</div>` : ''}<div style="font-size:0.88rem; white-space:pre-wrap;">${esc(text)}</div>`;
    }
  }

  function renderTableEditor() {
    const c = $('tableEditorContainer');
    const t = _state.table;
    if (t.columns.length === 0) {
      c.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--text-muted);">Belum ada kolom</p>';
      return;
    }
    let html = '<table class="table-editor-table"><thead><tr>';
    t.columns.forEach((col, ci) => {
      html += `<th style="width:${t.widths[ci]}%" data-col="${ci}">
        <input type="text" value="${esc(col)}" onchange="EditorModals.table.updateColumn(${ci}, this.value)" placeholder="Kolom ${ci + 1}">
        ${t.columns.length > 1 ? `<button type="button" class="btn-col-del" onclick="EditorModals.table.deleteColumn(${ci})" title="Hapus"><i class="fas fa-xmark"></i></button>` : ''}
        <div class="col-resize-handle" data-col="${ci}"></div>
      </th>`;
    });
    html += '</tr></thead><tbody>';
    t.rows.forEach((row, ri) => {
      html += '<tr>';
      t.columns.forEach((_, ci) => {
        html += `<td><input type="text" value="${esc(row[ci] || '')}" onchange="EditorModals.table.updateCell(${ri}, ${ci}, this.value)" placeholder="Isi..."></td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    c.innerHTML = html;

    // Pasang resize handle
    c.querySelectorAll('.col-resize-handle').forEach(handle => {
      let startX = 0, startWidth = 0, colIndex = 0, tableWidth = 0;
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        colIndex = parseInt(handle.dataset.col);
        const th = handle.parentElement;
        const table = th.closest('table');
        tableWidth = table.offsetWidth;
        startX = e.pageX;
        startWidth = th.offsetWidth;
        handle.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        const onMove = (ev) => {
          const delta = ev.pageX - startX;
          const newW = Math.max(60, startWidth + delta);
          const pct = (newW / tableWidth) * 100;
          _state.table.widths[colIndex] = pct;
          th.style.width = pct + '%';
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          handle.classList.remove('resizing');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  function renderAccordionEditor() {
    const c = $('accordionEditorContainer');
    const items = _state.accordion.items;
    c.innerHTML = items.map((it, i) => `
      <div class="accordion-item-editor">
        <div class="accordion-item-header">
          <span class="accordion-item-num">Item #${i + 1}</span>
          <button class="activity-mini-btn danger" onclick="EditorModals.accordion.deleteItem(${i})"><i class="fas fa-trash"></i></button>
        </div>
        <label class="form-label">Judul</label>
        <input type="text" class="form-input" value="${esc(it.title)}" onchange="EditorModals.accordion.updateTitle(${i}, this.value)" style="margin-bottom:0.5rem;">
        <label class="form-label">Konten</label>
        <textarea class="form-input" onchange="EditorModals.accordion.updateContent(${i}, this.value)" style="margin-bottom:0.5rem; min-height:60px;">${esc(it.content)}</textarea>
      </div>
    `).join('');
  }

  function renderOptionsEditor() {
    const c = $('optionsEditorList');
    c.innerHTML = _state.options.options.map((opt, i) => `
      <div class="option-row">
        <input type="text" class="form-input" value="${esc(opt)}" onchange="EditorModals.options.updateOption(${i}, this.value)" placeholder="Opsi ${i + 1}" style="margin-bottom:0;">
        <button type="button" class="option-remove" onclick="EditorModals.options.removeOption(${i})" ${_state.options.options.length <= 1 ? 'disabled style="opacity:0.3;"' : ''}>
          <i class="fas fa-xmark"></i>
        </button>
      </div>
    `).join('');
  }

  function renderTabelIsianEditor() {
    const c = $('tabelIsianEditorContainer');
    const t = _state.tabel_isian;
    if (t.columns.length === 0) {
      c.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--text-muted);">Belum ada kolom</p>';
      return;
    }
    let html = '<table class="table-editor-table"><thead><tr>';
    t.columns.forEach((col, ci) => {
      html += `<th><input type="text" value="${esc(col)}" onchange="EditorModals.tabel_isian.updateColumn(${ci}, this.value)" placeholder="Kolom ${ci + 1}">
        ${t.columns.length > 1 ? `<button type="button" class="btn-col-del" onclick="EditorModals.tabel_isian.deleteColumn(${ci})" title="Hapus"><i class="fas fa-xmark"></i></button>` : ''}
      </th>`;
    });
    html += '</tr></thead><tbody>';
    t.rows.forEach((row, ri) => {
      html += '<tr>';
      t.columns.forEach((_, ci) => {
        html += `<td><input type="text" value="${esc(row[ci] || '')}" onchange="EditorModals.tabel_isian.updateCell(${ri}, ${ci}, this.value)" placeholder="(kosong)"></td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    c.innerHTML = html;
  }

  function renderSoalPGOptions() {
    const c = $('soalPGOptionsList');
    const s = _state.soal_pg;
    c.innerHTML = s.options.map((opt, i) => `
      <div class="option-row">
        <span style="width:24px; height:24px; border-radius:50%; background:${i === s.correct ? 'var(--green)' : 'var(--bg-soft)'}; color:${i === s.correct ? 'white' : 'var(--text-secondary)'}; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:700; flex-shrink:0;">${String.fromCharCode(65 + i)}</span>
        <input type="text" class="form-input" value="${esc(opt)}" onchange="EditorModals.soal_pg.updateOption(${i}, this.value)" placeholder="Opsi ${String.fromCharCode(65 + i)}" style="margin-bottom:0;">
        <button type="button" class="option-remove" onclick="EditorModals.soal_pg.removeOption(${i})" ${s.options.length <= 2 ? 'disabled style="opacity:0.3;"' : ''}><i class="fas fa-xmark"></i></button>
      </div>
    `).join('');
    const sel = $('soalPGCorrectInput');
    sel.innerHTML = s.options.map((opt, i) =>
      `<option value="${i}" ${i === s.correct ? 'selected' : ''}>${String.fromCharCode(65 + i)} — ${esc(opt)}</option>`
    ).join('');
  }

  function renderSoalPGKOptions() {
    const c = $('soalPGKOptionsList');
    const s = _state.soal_pg_kompleks;
    c.innerHTML = s.options.map((opt, i) => `
      <div class="option-row">
        <span style="width:24px; height:24px; border-radius:50%; background:${s.correct.includes(i) ? 'var(--green)' : 'var(--bg-soft)'}; color:${s.correct.includes(i) ? 'white' : 'var(--text-secondary)'}; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:700; flex-shrink:0;">${String.fromCharCode(65 + i)}</span>
        <input type="text" class="form-input" value="${esc(opt)}" onchange="EditorModals.soal_pg_kompleks.updateOption(${i}, this.value)" placeholder="Opsi ${String.fromCharCode(65 + i)}" style="margin-bottom:0;">
        <button type="button" class="option-remove" onclick="EditorModals.soal_pg_kompleks.removeOption(${i})" ${s.options.length <= 2 ? 'disabled style="opacity:0.3;"' : ''}><i class="fas fa-xmark"></i></button>
      </div>
    `).join('');
    const correctList = $('soalPGKCorrectList');
    correctList.innerHTML = s.options.map((opt, i) => `
      <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.82rem; padding:0.3rem 0.5rem; cursor:pointer;">
        <input type="checkbox" ${s.correct.includes(i) ? 'checked' : ''} onchange="EditorModals.soal_pg_kompleks.toggleCorrect(${i}, this.checked)" style="accent-color:var(--green);">
        <span><strong>${String.fromCharCode(65 + i)}.</strong> ${esc(opt)}</span>
      </label>
    `).join('');
  }

  function renderSoalJodoh() {
    const s = _state.soal_menjodohkan;
    const leftC = $('soalJodohLeftList');
    const rightC = $('soalJodohRightList');
    leftC.innerHTML = s.left.map((l, i) => `
      <div class="option-row">
        <input type="text" class="form-input" value="${esc(l)}" onchange="EditorModals.soal_menjodohkan.updateLeft(${i}, this.value)" placeholder="Kiri ${i + 1}" style="margin-bottom:0;">
        <button type="button" class="option-remove" onclick="EditorModals.soal_menjodohkan.removeLeft(${i})" ${s.left.length <= 1 ? 'disabled style="opacity:0.3;"' : ''}><i class="fas fa-xmark"></i></button>
      </div>
    `).join('');
    rightC.innerHTML = s.right.map((r, i) => `
      <div class="option-row">
        <input type="text" class="form-input" value="${esc(r)}" onchange="EditorModals.soal_menjodohkan.updateRight(${i}, this.value)" placeholder="Kanan ${i + 1}" style="margin-bottom:0;">
        <button type="button" class="option-remove" onclick="EditorModals.soal_menjodohkan.removeRight(${i})" ${s.right.length <= 1 ? 'disabled style="opacity:0.3;"' : ''}><i class="fas fa-xmark"></i></button>
      </div>
    `).join('');
  }

  // ============================================
  // GLOBAL OPEN WRAPPERS (backward-compatible)
  // Fungsi global openXxxModal() tetap ada untuk onclick di renderer.
  // ============================================

  const globalWrapper = {
    openHeadingModal:      (id) => EditorModals.heading.open(id),
    closeHeadingModal:     () => EditorModals.heading.close(),
    saveHeading:           () => EditorModals.heading.save(),
    resetHeadingColor,

    openImageModal:        (id) => EditorModals.image.open(id),
    closeImageModal:       () => EditorModals.image.close(),
    saveImageComponent:    () => EditorModals.image.save(),

    openVideoModal:        (id) => EditorModals.video.open(id),
    closeVideoModal:       () => EditorModals.video.close(),
    saveVideoComponent:    () => EditorModals.video.save(),

    openAudioModal:        (id) => EditorModals.audio.open(id),
    closeAudioModal:       () => EditorModals.audio.close(),
    saveAudioComponent:    () => EditorModals.audio.save(),

    openTableModal:        (id) => EditorModals.table.open(id),
    closeTableModal:       () => EditorModals.table.close(),
    addTableColumn:        () => EditorModals.table.addColumn(),
    addTableRow:           () => EditorModals.table.addRow(),
    updateTableColumn:     (ci, v) => EditorModals.table.updateColumn(ci, v),
    updateTableCell:       (ri, ci, v) => EditorModals.table.updateCell(ri, ci, v),
    deleteTableColumn:     (ci) => EditorModals.table.deleteColumn(ci),
    saveTableComponent:    () => EditorModals.table.save(),

    openNoteModal:         (id) => EditorModals.note.open(id),
    closeNoteModal:        () => EditorModals.note.close(),
    updateNotePreview,
    saveNoteComponent:     () => EditorModals.note.save(),

    openAccordionModal:    (id) => EditorModals.accordion.open(id),
    closeAccordionModal:   () => EditorModals.accordion.close(),
    addAccordionItem:      () => EditorModals.accordion.addItem(),
    deleteAccordionItem:   (i) => EditorModals.accordion.deleteItem(i),
    updateAccordionTitle:  (i, v) => EditorModals.accordion.updateTitle(i, v),
    updateAccordionContent:(i, v) => EditorModals.accordion.updateContent(i, v),
    saveAccordionComponent:() => EditorModals.accordion.save(),

    openFileModal:         (id) => EditorModals.file.open(id),
    closeFileModal:        () => EditorModals.file.close(),
    saveFileComponent:     () => EditorModals.file.save(),

    openEmbedModal:        (id) => EditorModals.embed.open(id),
    closeEmbedModal:       () => EditorModals.embed.close(),
    saveEmbedComponent:    () => EditorModals.embed.save(),

    // LKPD
    openIdentitasModal:    (id) => EditorModals.identitas_siswa.open(id),
    closeIdentitasModal:   () => EditorModals.identitas_siswa.close(),
    saveIdentitasComponent:() => EditorModals.identitas_siswa.save(),

    openPetunjukModal:     (id) => EditorModals.petunjuk.open(id),
    closePetunjukModal:    () => EditorModals.petunjuk.close(),
    savePetunjukComponent: () => EditorModals.petunjuk.save(),

    openInputTeksModal:    (id) => EditorModals.input_teks.open(id),
    closeInputTeksModal:   () => EditorModals.input_teks.close(),
    saveInputTeksComponent:() => EditorModals.input_teks.save(),

    openTextareaModal:     (id) => EditorModals.textarea.open(id),
    closeTextareaModal:    () => EditorModals.textarea.close(),
    saveTextareaComponent: () => EditorModals.textarea.save(),

    openOptionsModal:      (id, t) => EditorModals.options.open(id, t),
    closeOptionsModal:     () => EditorModals.options.close(),
    addOptionRow:          () => EditorModals.options.addOption(),
    removeOptionRow:       (i) => EditorModals.options.removeOption(i),
    updateOptionRow:       (i, v) => EditorModals.options.updateOption(i, v),
    saveOptionsComponent:  () => EditorModals.options.save(),

    openTabelIsianModal:   (id) => EditorModals.tabel_isian.open(id),
    closeTabelIsianModal:  () => EditorModals.tabel_isian.close(),
    addTI_Column:          () => EditorModals.tabel_isian.addColumn(),
    addTI_Row:             () => EditorModals.tabel_isian.addRow(),
    updateTI_Column:       (ci, v) => EditorModals.tabel_isian.updateColumn(ci, v),
    updateTI_Cell:         (ri, ci, v) => EditorModals.tabel_isian.updateCell(ri, ci, v),
    deleteTI_Column:       (ci) => EditorModals.tabel_isian.deleteColumn(ci),
    saveTabelIsianComponent:() => EditorModals.tabel_isian.save(),

    openPenilaianDiriModal:   (id) => EditorModals.penilaian_diri.open(id),
    closePenilaianDiriModal:  () => EditorModals.penilaian_diri.close(),
    savePenilaianDiriComponent:() => EditorModals.penilaian_diri.save(),

    openTombolSubmitModal:    (id) => EditorModals.tombol_submit.open(id),
    closeTombolSubmitModal:   () => EditorModals.tombol_submit.close(),
    saveTombolSubmitComponent:() => EditorModals.tombol_submit.save(),

    // Asesmen
    openAsesmenSettingModal:     (id) => EditorModals.asesmen_setting.open(id),
    closeAsesmenSettingModal:    () => EditorModals.asesmen_setting.close(),
    saveAsesmenSettingComponent: () => EditorModals.asesmen_setting.save(),

    openSoalPGModal:      (id) => EditorModals.soal_pg.open(id),
    closeSoalPGModal:     () => EditorModals.soal_pg.close(),
    addSoalPGOption:      () => EditorModals.soal_pg.addOption(),
    removeSoalPGOption:   (i) => EditorModals.soal_pg.removeOption(i),
    updateSoalPGOption:   (i, v) => EditorModals.soal_pg.updateOption(i, v),
    saveSoalPGComponent:  () => EditorModals.soal_pg.save(),

    openSoalPGKModal:     (id) => EditorModals.soal_pg_kompleks.open(id),
    closeSoalPGKModal:    () => EditorModals.soal_pg_kompleks.close(),
    addSoalPGKOption:     () => EditorModals.soal_pg_kompleks.addOption(),
    removeSoalPGKOption:  (i) => EditorModals.soal_pg_kompleks.removeOption(i),
    updateSoalPGKOption:  (i, v) => EditorModals.soal_pg_kompleks.updateOption(i, v),
    toggleSoalPGKCorrect: (i, c) => EditorModals.soal_pg_kompleks.toggleCorrect(i, c),
    saveSoalPGKComponent: () => EditorModals.soal_pg_kompleks.save(),

    openSoalEsaiModal:    (id) => EditorModals.soal_esai.open(id),
    closeSoalEsaiModal:   () => EditorModals.soal_esai.close(),
    saveSoalEsaiComponent:() => EditorModals.soal_esai.save(),

    openSoalJodohModal:   (id) => EditorModals.soal_menjodohkan.open(id),
    closeSoalJodohModal:  () => EditorModals.soal_menjodohkan.close(),
    addSoalJodohLeft:     () => EditorModals.soal_menjodohkan.addLeft(),
    addSoalJodohRight:    () => EditorModals.soal_menjodohkan.addRight(),
    removeSoalJodohLeft:  (i) => EditorModals.soal_menjodohkan.removeLeft(i),
    removeSoalJodohRight: (i) => EditorModals.soal_menjodohkan.removeRight(i),
    updateSoalJodohLeft:  (i, v) => EditorModals.soal_menjodohkan.updateLeft(i, v),
    updateSoalJodohRight: (i, v) => EditorModals.soal_menjodohkan.updateRight(i, v),
    saveSoalJodohComponent:() => EditorModals.soal_menjodohkan.save(),

    openSoalBSModal:      (id) => EditorModals.soal_benar_salah.open(id),
    closeSoalBSModal:     () => EditorModals.soal_benar_salah.close(),
    saveSoalBSComponent:  () => EditorModals.soal_benar_salah.save(),

    // Refleksi
    openPertanyaanRefleksiModal:   (id) => EditorModals.pertanyaan_refleksi.open(id),
    closePertanyaanRefleksiModal:  () => EditorModals.pertanyaan_refleksi.close(),
    savePertanyaanRefleksiComponent:() => EditorModals.pertanyaan_refleksi.save(),

    openMoodTrackerModal:          (id) => EditorModals.mood_tracker.open(id),
    closeMoodTrackerModal:         () => EditorModals.mood_tracker.close(),
    saveMoodTrackerComponent:      () => EditorModals.mood_tracker.save(),

    openTargetBelajarModal:        (id) => EditorModals.target_belajar.open(id),
    closeTargetBelajarModal:       () => EditorModals.target_belajar.close(),
    saveTargetBelajarComponent:    () => EditorModals.target_belajar.save(),

    openTombolSubmitRefleksiModal: (id) => EditorModals.tombol_submit_refleksi.open(id),
    closeTombolSubmitRefleksiModal:() => EditorModals.tombol_submit_refleksi.close(),
    saveTombolSubmitRefleksiComponent:() => EditorModals.tombol_submit_refleksi.save(),

    // Diskusi
    openTopikDiskusiModal:   (id) => EditorModals.topik_diskusi.open(id),
    closeTopikDiskusiModal:  () => EditorModals.topik_diskusi.close(),
    saveTopikDiskusiComponent:() => EditorModals.topik_diskusi.save(),

    openAturanDiskusiModal:  (id) => EditorModals.aturan_diskusi.open(id),
    closeAturanDiskusiModal: () => EditorModals.aturan_diskusi.close(),
    saveAturanDiskusiComponent:() => EditorModals.aturan_diskusi.save(),

    openKolomKomentarModal:  (id) => EditorModals.kolom_komentar.open(id),
    closeKolomKomentarModal: () => EditorModals.kolom_komentar.close(),
    saveKolomKomentarComponent:() => EditorModals.kolom_komentar.save(),

    // Color picker
    openColorPicker:       (quill, type) => EditorModals.colorPicker.open(quill, type),
    closeColorPicker:      () => EditorModals.colorPicker.close(),
    applyColor:            (c) => EditorModals.colorPicker.apply(c),
    applyCustomColor:      () => EditorModals.colorPicker.applyCustom(),
    removeColorFormat:     () => EditorModals.colorPicker.remove(),

    // Update previews dari event handler input
    updateImagePreview,
    updateVideoPreview,
    updateAudioPreview,
  };

  // ============================================
  // AUTO-BIND EVENT INPUT (live preview)
  // ============================================
  document.addEventListener('input', e => {
    if (['headingTextInput', 'headingLevelSelect', 'headingAlignSelect', 'headingColorInput'].includes(e.target.id)) updateHeadingPreview();
    if (e.target.id === 'imageUrlInput') updateImagePreview();
    if (e.target.id === 'videoUrlInput') updateVideoPreview();
    if (e.target.id === 'audioUrlInput') updateAudioPreview();
  });
  document.addEventListener('change', e => {
    if (['headingLevelSelect', 'headingAlignSelect', 'headingColorInput'].includes(e.target.id)) updateHeadingPreview();
  });

  // ============================================
  // EXPORT
  // ============================================
  global.EditorModals = EditorModals;
  global.openModalByType = (type, compId) => EditorModals.openByType(type, compId);
  global.closeAllEditorModals = () => EditorModals.closeAll();

  Object.keys(globalWrapper).forEach(name => {
    global[name] = globalWrapper[name];
  });

  console.log('[editor-modals] Loaded. Total modal:', Object.keys(EditorModals).filter(k => typeof EditorModals[k] === 'object' && EditorModals[k].open).length);

})(window);