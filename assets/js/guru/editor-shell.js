// ============================================
// EDITOR-SHELL.JS — Tembok Belajar
// Shell untuk unit-editor.html.
// Berisi: state utama, activity CRUD, canvas wrapper, Quill init,
//         kelola kelas, publish, dan EDITOR_CTX untuk editor-modals.
//
// Dependensi (load SEBELUM file ini):
//   - cache.js, config.js, supabase.js
//   - editor-tools.js, editor-renderers.js, editor-modals.js
// ============================================

(function (global) {
  'use strict';

  // ============================================
  // STATE UTAMA
  // ============================================
  let currentUser = null;
  let currentUnit = null;
  let unitClasses = [];
  let availableClasses = [];
  let activities = [];
  let activeActivityId = null;
  let components = [];
  let editingActivityId = null;
  let deletingActivityId = null;
  let selectedKelolaKelas = new Set();
  let selectedPublishKelas = new Set();

  // Quill instances per component ID
  const quillInstances = {};

  // ============================================
  // HELPER: get active ID / components
  // ============================================
  function getActiveActivityId() { return activeActivityId; }
  function getComponents() { return components; }

  // ============================================
  // INIT
  // ============================================
  (async () => {
    initSupabase();
    currentUser = await requireAuth('guru');
    if (!currentUser) return;

    const unitId = new URLSearchParams(window.location.search).get('unitId');
    if (!unitId) { alert('unitId tidak ditemukan.'); goBack(); return; }

    try {
      currentUnit = await getUnitById(unitId);
      if (!currentUnit) throw new Error('Unit tidak ditemukan.');

      const teacherId = currentUnit.annual_plans?.teacher_id;
      if (String(teacherId) !== String(currentUser.id)) {
        throw new Error('Anda tidak berhak mengedit unit ini.');
      }

      document.getElementById('editorTitle').textContent = currentUnit.title;
      document.getElementById('editorSubtitle').textContent =
        (currentUnit.annual_plans?.classes?.name || '-') + ' · ' +
        (currentUnit.annual_plans?.subjects?.name || '-');
      updateStatusBadge(currentUnit.status);

      // Init EDITOR_CTX untuk editor-modals
      setupEditorContext();

      // Render sidebar tool dari registry
      renderToolSidebar('#componentTools', (type) => addComponent(type));

      // Load data
      await loadUnitClassesData();
      await loadActivities();

      document.getElementById('loadingScreen').classList.add('hidden');
      document.getElementById('editorScreen').classList.remove('hidden');
    } catch (err) {
      console.error('Init error:', err);
      document.getElementById('loadingScreen').innerHTML =
        `<div style="text-align:center; color:var(--danger); padding:2rem;">
          <i class="fas fa-triangle-exclamation" style="font-size:2rem; margin-bottom:1rem;"></i>
          <p>${escapeHtml(err.message)}</p>
          <button class="btn-primary" onclick="goBack()" style="margin-top:1rem;"><i class="fas fa-arrow-left"></i> Kembali</button>
        </div>`;
    }
  })();

  // ============================================
  // EDITOR_CTX — dependency injection untuk editor-modals.js
  // ============================================
  function setupEditorContext() {
    global.EDITOR_CTX = {
      get currentUser()   { return currentUser; },
      get currentUnit()   { return currentUnit; },
      get activities()    { return activities; },
      getActiveActivityId,
      getComponents,
      reloadComponents: async () => {
        if (activeActivityId) await loadComponents(activeActivityId);
      },
      showToast: (msg, type) => showToast(msg, type),
      updateComponentInState: (compId, newData) => {
        const c = components.find(x => String(x.id) === String(compId));
        if (c) c.component_data = newData;
      }
    };
  }

  // ============================================
  // LOAD KELAS DATA
  // ============================================
  async function loadUnitClassesData() {
    try {
      unitClasses = await getUnitClasses(currentUnit.id);
      const assignments = await getMyTeachingAssignments(currentUser.id);
      const myClassMap = {};
      assignments
        .filter(a => String(a.subject_id) === String(currentUnit.annual_plans?.subject_id))
        .forEach(a => { if (a.classes) myClassMap[String(a.class_id)] = a.classes; });
      const myClassIds = new Set(Object.keys(myClassMap));

      let allSchoolClasses = [];
      try {
        allSchoolClasses = await getClasses(currentUser.school_id);
      } catch (e) {
        console.warn('Gagal ambil semua kelas, fallback:', e);
        allSchoolClasses = Object.values(myClassMap);
      }
      availableClasses = allSchoolClasses.map(c => ({
        ...c,
        _isMyClass: myClassIds.has(String(c.id))
      }));

      updateKelasLabel();
    } catch (err) { console.error('Load kelas data error:', err); }
  }

  function updateKelasLabel() {
    document.getElementById('kelasCountLabel').textContent = 'Kelas (' + unitClasses.length + ')';
  }

  // ============================================
  // ACTIVITIES CRUD
  // ============================================
  async function loadActivities() {
    const list = document.getElementById('activityList');
    list.innerHTML = '<div style="padding:1rem; text-align:center;"><span class="spinner-sm"></span></div>';
    try {
      activities = await getUnitActivities(currentUnit.id);
      renderActivities();
      if (activeActivityId) {
        const exists = activities.find(a => String(a.id) === String(activeActivityId));
        if (exists) await loadComponents(activeActivityId);
        else { activeActivityId = null; renderEmptyCanvas(); }
      }
    } catch (err) {
      list.innerHTML = `<div style="padding:1rem; color:var(--danger); font-size:0.8rem;">Gagal: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderActivities() {
    document.getElementById('activityCount').textContent = activities.length;
    const list = document.getElementById('activityList');
    if (activities.length === 0) {
      list.innerHTML = `<div class="empty-activity"><span class="emoji">📭</span><p>Belum ada aktivitas.<br>Klik <strong>Tambah Aktivitas</strong>.</p></div>`;
      return;
    }
    list.innerHTML = activities.map((a, idx) => {
      const isActive = String(a.id) === String(activeActivityId);
      const canUp = idx > 0;
      const canDown = idx < activities.length - 1;
      const typeLabel = ACTIVITY_TYPE_LABEL[a.type] || a.type;
      return `
        <div class="activity-item ${isActive ? 'active' : ''}" onclick="selectActivity('${a.id}')">
          <div class="activity-item-top">
            <span class="activity-order">#${idx + 1}</span>
            <span class="activity-title">${escapeHtml(a.title)}</span>
          </div>
          <span class="activity-type-badge ${a.type}">${typeLabel}</span>
          <div class="activity-item-actions">
          <button class="activity-mini-btn" title="Pengaturan" onclick="event.stopPropagation(); ActivitySettings.open('${a.id}')"><i class="fas fa-sliders"></i></button>
            <button class="activity-mini-btn" title="Naik" ${canUp ? '' : 'disabled'} onclick="event.stopPropagation(); moveActivity('${a.id}', -1)"><i class="fas fa-arrow-up"></i></button>
            <button class="activity-mini-btn" title="Turun" ${canDown ? '' : 'disabled'} onclick="event.stopPropagation(); moveActivity('${a.id}', 1)"><i class="fas fa-arrow-down"></i></button>
            <button class="activity-mini-btn" title="Edit" onclick="event.stopPropagation(); openEditActivityModal('${a.id}')"><i class="fas fa-pen"></i></button>
            <button class="activity-mini-btn danger" title="Hapus" onclick="event.stopPropagation(); openDeleteActivityModal('${a.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
    }).join('');
  }

  async function selectActivity(activityId) {
    if (String(activityId) === String(activeActivityId)) return;
    activeActivityId = activityId;
    renderActivities();
    await loadComponents(activityId);
    setToolSidebarEnabled(true);
  }

  async function moveActivity(activityId, direction) {
    const idx = activities.findIndex(a => String(a.id) === String(activityId));
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= activities.length) return;
    const tmp = activities[idx]; activities[idx] = activities[swapIdx]; activities[swapIdx] = tmp;
    try {
      await reorderUnitActivities(activities.map((a, i) => ({ id: a.id, order_index: i + 1 })));
      activities.forEach((a, i) => { a.order_index = i + 1; });
      renderActivities();
    } catch (err) { showToast('Gagal ubah urutan', 'error'); await loadActivities(); }
  }

  // ============================================
  // ACTIVITY MODALS (Add / Edit / Delete)
  // ============================================
  function openAddActivityModal() {
    document.getElementById('inputActType').value = 'materi';
    document.getElementById('inputActTitle').value = '';
    document.getElementById('addActivityError').classList.add('hidden');
    document.getElementById('btnSaveActivity').disabled = false;
    document.getElementById('btnSaveActivity').innerHTML = '<i class="fas fa-save"></i> Simpan';
    document.getElementById('modalAddActivity').classList.add('active');
    setTimeout(() => document.getElementById('inputActTitle').focus(), 100);
  }
  function closeAddActivityModal() { document.getElementById('modalAddActivity').classList.remove('active'); }

  async function saveActivity() {
    const type = document.getElementById('inputActType').value;
    const title = document.getElementById('inputActTitle').value.trim();
    const errBox = document.getElementById('addActivityError');
    const btn = document.getElementById('btnSaveActivity');
    errBox.classList.add('hidden');
    if (!title) { errBox.textContent = 'Judul wajib diisi.'; errBox.classList.remove('hidden'); return; }
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    try {
      await createUnitActivity({ unitId: currentUnit.id, title, type });
      closeAddActivityModal();
      showToast('✅ Aktivitas ditambahkan', 'success');
      await loadActivities();
    } catch (err) {
      errBox.textContent = 'Gagal: ' + err.message;
      errBox.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Simpan';
    }
  }

  function openEditActivityModal(activityId) {
    const a = activities.find(x => String(x.id) === String(activityId));
    if (!a) return;
    editingActivityId = activityId;
    document.getElementById('editActTitle').value = a.title;
    document.getElementById('editActType').value = a.type;
    document.getElementById('editActivityError').classList.add('hidden');
    document.getElementById('btnUpdateActivity').disabled = false;
    document.getElementById('btnUpdateActivity').innerHTML = '<i class="fas fa-save"></i> Simpan';
    document.getElementById('modalEditActivity').classList.add('active');
  }
  function closeEditActivityModal() { document.getElementById('modalEditActivity').classList.remove('active'); editingActivityId = null; }

  async function updateActivityInfo() {
    if (!editingActivityId) return;
    const title = document.getElementById('editActTitle').value.trim();
    const type = document.getElementById('editActType').value;
    const errBox = document.getElementById('editActivityError');
    const btn = document.getElementById('btnUpdateActivity');
    errBox.classList.add('hidden');
    if (!title) { errBox.textContent = 'Judul wajib.'; errBox.classList.remove('hidden'); return; }
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    try {
      await updateUnitActivity(editingActivityId, { title, type });
      closeEditActivityModal();
      showToast('✅ Aktivitas diperbarui', 'success');
      await loadActivities();
    } catch (err) {
      errBox.textContent = 'Gagal: ' + err.message;
      errBox.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Simpan';
    }
  }

  function openDeleteActivityModal(activityId) {
    const a = activities.find(x => String(x.id) === String(activityId));
    if (!a) return;
    deletingActivityId = activityId;
    document.getElementById('deleteActivityMessage').innerHTML =
      `Hapus aktivitas <strong>${escapeHtml(a.title)}</strong>?`;
    document.getElementById('modalDeleteActivity').classList.add('active');
  }
  function closeDeleteActivityModal() { document.getElementById('modalDeleteActivity').classList.remove('active'); deletingActivityId = null; }

  async function confirmDeleteActivity() {
    if (!deletingActivityId) return;
    const btn = document.getElementById('btnConfirmDeleteActivity');
    btn.disabled = true;
    btn.textContent = 'Menghapus...';
    try {
      await deleteUnitActivity(deletingActivityId);
      if (String(deletingActivityId) === String(activeActivityId)) {
        activeActivityId = null; components = [];
        renderEmptyCanvas(); setToolSidebarEnabled(false);
      }
      closeDeleteActivityModal();
      showToast('🗑️ Aktivitas dihapus', 'success');
      await loadActivities();
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Ya, Hapus';
    }
  }

  // ============================================
  // COMPONENTS LOADER & CANVAS
  // ============================================
  async function loadComponents(activityId) {
    const center = document.getElementById('panelCenter');
    center.innerHTML = '<div style="text-align:center; padding:2rem;"><span class="spinner-sm"></span></div>';
    try {
      components = await getActivityComponents(activityId);
      renderCanvas();
    } catch (err) {
      center.innerHTML = `<div style="padding:2rem; color:var(--danger);">Gagal: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderCanvas() {
    const activity = activities.find(a => String(a.id) === String(activeActivityId));
    const center = document.getElementById('panelCenter');
    if (!activity) { renderEmptyCanvas(); return; }
    Object.keys(quillInstances).forEach(k => delete quillInstances[k]);

    const header = `
      <div class="canvas-header">
        <div class="canvas-header-title">
          <h2>${escapeHtml(activity.title)}</h2>
          <div class="canvas-header-meta">
            <span class="activity-type-badge ${activity.type}" style="font-size:0.65rem;">${ACTIVITY_TYPE_LABEL[activity.type] || activity.type}</span>
            &nbsp;·&nbsp; ${components.length} komponen
          </div>
        </div>
        <div class="canvas-header-actions">
          <button class="btn-icon" onclick="openEditActivityModal('${activity.id}')" title="Edit info"><i class="fas fa-pen"></i></button>
        </div>
      </div>`;

    if (components.length === 0) {
      center.innerHTML = header + `<div class="empty-canvas"><span class="emoji">📄</span><h3>Belum Ada Komponen</h3><p>Klik tombol di panel kanan untuk menambahkan komponen.</p></div>`;
      return;
    }
    center.innerHTML = header + `<div class="components-container">${components.map((c, idx) => renderComponentWrapper(c, idx)).join('')}</div>`;

    // Init Quill untuk komponen text
    components.forEach(c => { if (c.component_type === 'text') initQuillEditor(c); });
  }

  function renderComponentWrapper(comp, idx) {
    const canUp = idx > 0;
    const canDown = idx < components.length - 1;
    const typeLabel = getComponentTypeLabel(comp.component_type);
    const contentHtml = renderComponent(comp, { mode: 'edit' });
    return `
      <div class="component-wrapper" data-comp-id="${comp.id}">
        <div class="component-type-label">${typeLabel}</div>
        <div class="component-toolbar">
          <button class="activity-mini-btn" title="Naik" ${canUp ? '' : 'disabled'} onclick="moveComponent('${comp.id}', -1)"><i class="fas fa-arrow-up"></i></button>
          <button class="activity-mini-btn" title="Turun" ${canDown ? '' : 'disabled'} onclick="moveComponent('${comp.id}', 1)"><i class="fas fa-arrow-down"></i></button>
          <button class="activity-mini-btn danger" title="Hapus" onclick="removeComponent('${comp.id}')"><i class="fas fa-trash"></i></button>
        </div>
        <div class="component-content">${contentHtml}</div>
      </div>`;
  }

  function renderEmptyCanvas() {
    document.getElementById('panelCenter').innerHTML = `<div class="empty-canvas"><span class="emoji">👈</span><h3>Pilih Aktivitas</h3><p>Klik aktivitas di panel kiri untuk mulai mengedit.</p></div>`;
  }

  // ============================================
  // QUILL INIT
  // ============================================
  function initQuillEditor(comp) {
    const container = document.getElementById('quill-' + comp.id);
    if (!container) return;
    const toolbarOptions = [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link'],
      ['clean']
    ];
    const quill = new Quill(container, {
      theme: 'snow',
      modules: { toolbar: toolbarOptions },
      placeholder: 'Tulis konten...'
    });
    const html = (comp.component_data || {}).html || '';
    if (html) quill.clipboard.dangerouslyPasteHTML(html);

    // Ganti handler color/background ke color picker modal
    const toolbar = quill.getModule('toolbar');
    toolbar.addHandler('color', () => openColorPicker(quill, 'color'));
    toolbar.addHandler('background', () => openColorPicker(quill, 'background'));

    let saveTimer = null;
    quill.on('text-change', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try {
          const newHtml = quill.root.innerHTML;
          await updateActivityComponent(comp.id, { component_data: { html: newHtml } });
          const c = components.find(x => String(x.id) === String(comp.id));
          if (c) c.component_data = { html: newHtml };
        } catch (err) { showToast('Gagal simpan teks', 'error'); }
      }, 800);
    });
    quillInstances[comp.id] = quill;
  }

  // ============================================
  // ADD / MOVE / REMOVE COMPONENT
  // ============================================
  async function addComponent(type) {
    if (!activeActivityId) { showToast('Pilih aktivitas dulu', 'error'); return; }
    if (!isKnownComponentType(type)) { showToast('Tipe tidak dikenal: ' + type, 'error'); return; }

    const componentData = getComponentDefaults(type);
    try {
      const created = await createActivityComponent({
        activityId: activeActivityId,
        componentType: type,
        componentData
      });
      showToast('✅ Komponen ditambahkan', 'success');
      await loadComponents(activeActivityId);

      // Buka modal editor yang sesuai (delegasi ke editor-modals.js)
      setTimeout(() => {
        if (typeof openModalByType === 'function') {
          openModalByType(type, created.id);
        }
      }, 300);
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
    }
  }

  async function moveComponent(compId, direction) {
    const idx = components.findIndex(c => String(c.id) === String(compId));
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= components.length) return;
    const tmp = components[idx]; components[idx] = components[swapIdx]; components[swapIdx] = tmp;
    try {
      await reorderActivityComponents(components.map((c, i) => ({ id: c.id, order_index: i + 1 })));
      components.forEach((c, i) => { c.order_index = i + 1; });
      renderCanvas();
    } catch (err) { showToast('Gagal ubah urutan', 'error'); }
  }

  async function removeComponent(compId) {
    if (!confirm('Hapus komponen ini?')) return;
    try {
      await deleteActivityComponent(compId);
      showToast('🗑️ Komponen dihapus', 'success');
      await loadComponents(activeActivityId);
    } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
  }

  // ============================================
  // KELOLA KELAS
  // ============================================
  function openKelolaKelasModal() {
    selectedKelolaKelas = new Set(unitClasses.map(uc => String(uc.class_id)));
    renderKelolaKelasList();
    document.getElementById('kelolaKelasError').classList.add('hidden');
    document.getElementById('modalKelolaKelas').classList.add('active');
  }
  function closeKelolaKelasModal() { document.getElementById('modalKelolaKelas').classList.remove('active'); }

  function renderKelolaKelasList() {
    const c = document.getElementById('kelolaKelasList');
    if (availableClasses.length === 0) {
      c.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">Tidak ada kelas di sekolah ini.</p>';
      return;
    }
    const sorted = [...availableClasses].sort((a, b) => {
      if (a._isMyClass && !b._isMyClass) return -1;
      if (!a._isMyClass && b._isMyClass) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    c.innerHTML = sorted.map(cls => {
      const cid = String(cls.id);
      const isChecked = selectedKelolaKelas.has(cid);
      const uc = unitClasses.find(u => String(u.class_id) === cid);
      const statusLabel = uc
        ? (uc.is_published ? '<span class="kelas-check-status published">✓ Published</span>' : '<span class="kelas-check-status draft">○ Draft</span>')
        : '';
      const myBadge = cls._isMyClass
        ? '<span class="kelas-check-status published" style="background:#dbeafe;color:#1e40af;margin-left:4px;">Diampu</span>'
        : '<span class="kelas-check-status draft" style="background:#fef3c7;color:#92400e;margin-left:4px;">Tidak diampu</span>';
      return `<label class="kelas-check-item ${isChecked ? 'checked' : ''}">
        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleKelolaKelas('${cid}', this.checked)">
        <div class="kelas-check-info">
          <div class="kelas-check-name">${escapeHtml(cls.name)}${cls.grade ? ' — ' + escapeHtml(cls.grade) : ''}${myBadge}</div>
          ${statusLabel}
        </div>
      </label>`;
    }).join('');
  }

  function toggleKelolaKelas(cid, checked) {
    if (checked) selectedKelolaKelas.add(String(cid));
    else selectedKelolaKelas.delete(String(cid));
    renderKelolaKelasList();
  }

  async function saveKelolaKelas() {
    const errBox = document.getElementById('kelolaKelasError');
    errBox.classList.add('hidden');
    if (selectedKelolaKelas.size === 0) {
      errBox.textContent = 'Pilih minimal 1 kelas.';
      errBox.classList.remove('hidden');
      return;
    }
    try {
      const classIds = Array.from(selectedKelolaKelas).map(c => parseInt(c));
      await setUnitClasses(currentUnit.id, classIds);
      closeKelolaKelasModal();
      showToast('✅ Kelas diperbarui', 'success');
      await loadUnitClassesData();
    } catch (err) {
      errBox.textContent = 'Gagal: ' + err.message;
      errBox.classList.remove('hidden');
    }
  }

  // ============================================
  // PUBLISH
  // ============================================
  async function openPublishModal() {
    await loadUnitClassesData();
    selectedPublishKelas = new Set(
      availableClasses.filter(c => c._isMyClass).map(c => String(c.id))
    );
    renderPublishList();
    document.getElementById('publishError').classList.add('hidden');
    document.getElementById('modalPublish').classList.add('active');
  }
  function closePublishModal() { document.getElementById('modalPublish').classList.remove('active'); }

  function renderPublishList() {
    const c = document.getElementById('publishKelasList');
    if (availableClasses.length === 0) {
      c.innerHTML = '<div class="alert alert-error">Tidak ada kelas di sekolah ini.</div>';
      return;
    }
    const sorted = [...availableClasses].sort((a, b) => {
      if (a._isMyClass && !b._isMyClass) return -1;
      if (!a._isMyClass && b._isMyClass) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    c.innerHTML = sorted.map(cls => {
      const cid = String(cls.id);
      const isChecked = selectedPublishKelas.has(cid);
      const uc = unitClasses.find(u => String(u.class_id) === cid);
      let statusInfo;
      if (!uc) statusInfo = '<span class="kelas-check-status draft">Belum terkait (akan ditambahkan)</span>';
      else if (uc.is_published) statusInfo = `<span class="kelas-check-status published">✓ Terakhir publish: ${formatDate(uc.published_at)}</span>`;
      else statusInfo = '<span class="kelas-check-status draft">Terkait, belum publish</span>';
      const myBadge = cls._isMyClass
        ? '<span class="kelas-check-status published" style="background:#dbeafe;color:#1e40af;margin-left:4px;">Diampu</span>'
        : '<span class="kelas-check-status draft" style="background:#fef3c7;color:#92400e;margin-left:4px;">Tidak diampu</span>';
      return `<label class="kelas-check-item ${isChecked ? 'checked' : ''}">
        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="togglePublishKelas('${cid}', this.checked)">
        <div class="kelas-check-info">
          <div class="kelas-check-name">${escapeHtml(cls.name)}${cls.grade ? ' — ' + escapeHtml(cls.grade) : ''}${myBadge}</div>
          ${statusInfo}
        </div>
      </label>`;
    }).join('');
  }

  function togglePublishKelas(cid, checked) {
    if (checked) selectedPublishKelas.add(String(cid));
    else selectedPublishKelas.delete(String(cid));
    renderPublishList();
  }

  async function confirmPublish() {
    const errBox = document.getElementById('publishError');
    errBox.classList.add('hidden');
    if (selectedPublishKelas.size === 0) {
      errBox.textContent = 'Pilih minimal 1 kelas.';
      errBox.classList.remove('hidden');
      return;
    }
    try {
      const snapshot = await buildUnitSnapshot();
      const classIds = Array.from(selectedPublishKelas).map(c => parseInt(c));
      const existingIds = new Set(unitClasses.map(uc => String(uc.class_id)));
      const newCount = classIds.filter(id => !existingIds.has(String(id))).length;
      await publishUnitToClasses(currentUnit.id, classIds, snapshot);
      closePublishModal();
      let msg = '✅ Berhasil di-publish ke ' + classIds.length + ' kelas';
      if (newCount > 0) msg += ` (${newCount} kelas baru)`;
      showToast(msg, 'success');
      currentUnit = await getUnitById(currentUnit.id);
      updateStatusBadge(currentUnit.status);
      await loadUnitClassesData();
    } catch (err) {
      errBox.textContent = 'Gagal: ' + err.message;
      errBox.classList.remove('hidden');
    }
  }

  async function buildUnitSnapshot() {
    const acts = await getUnitActivities(currentUnit.id);
    const snapshot = {
      unit: {
        title: currentUnit.title,
        description: currentUnit.description,
        kktp_type: currentUnit.kktp_type,
        kktp_config: currentUnit.kktp_config
      },
      activities: []
    };
    for (const act of acts) {
      const comps = await getActivityComponents(act.id);
      snapshot.activities.push({
        id: act.id, title: act.title, type: act.type, order_index: act.order_index,
        components: comps.map(c => ({
          id: c.id, component_type: c.component_type,
          component_data: c.component_data, order_index: c.order_index
        }))
      });
    }
    return snapshot;
  }

  // ============================================
  // NAVIGATION
  // ============================================
  function openPreview() {
    if (window.self !== window.top) {
      window.parent.postMessage({ type: 'GURU_GOTO', target: 'preview', params: { unitId: currentUnit.id }, from: 'editor' }, '*');
    } else {
      window.location.href = 'unit-preview.html?embed=1&unitId=' + currentUnit.id;
    }
  }

  function goBack() {
    if (window.self !== window.top) {
      window.parent.postMessage({ type: 'GURU_BACK', view: 'workspace' }, '*');
    } else {
      window.location.href = 'mapel-workspace.html?embed=1&subjectId=' + (currentUnit?.annual_plans?.subject_id || '');
    }
  }

  // ============================================
  // HELPERS
  // ============================================
  function updateStatusBadge(status) {
    const badge = document.getElementById('statusBadge');
    badge.className = 'status-badge ' + (status || 'draft');
    badge.textContent = { draft: 'Draft', published: 'Published', archived: 'Archived' }[status] || status;
  }

  function formatDate(iso) {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return '-'; }
  }

  function escapeHtml(t) {
    if (t === null || t === undefined) return '';
    const d = document.createElement('div');
    d.textContent = String(t);
    return d.innerHTML;
  }

  function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (type === 'error' ? 'error' : 'success');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
  }

  // ============================================
  // GLOBAL WRAPPER (untuk onclick di HTML)
  // ============================================
  const exports = {
    // Activity
    openAddActivityModal, closeAddActivityModal, saveActivity,
    openEditActivityModal, closeEditActivityModal, updateActivityInfo,
    openDeleteActivityModal, closeDeleteActivityModal, confirmDeleteActivity,
    selectActivity, moveActivity,
    // Component
    addComponent, moveComponent, removeComponent,
    // Kelola kelas & publish
    openKelolaKelasModal, closeKelolaKelasModal, toggleKelolaKelas, saveKelolaKelas,
    openPublishModal, closePublishModal, togglePublishKelas, confirmPublish,
    // Navigation
    openPreview, goBack
  };
  Object.keys(exports).forEach(name => { global[name] = exports[name]; });

  // ============================================
  // GLOBAL ESCAPE HANDLER — tutup semua modal
  // ============================================
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAddActivityModal();
      closeEditActivityModal();
      closeDeleteActivityModal();
      closeKelolaKelasModal();
      closePublishModal();
      if (typeof closeAllEditorModals === 'function') closeAllEditorModals();
    }
  });

  console.log('[editor-shell] Loaded.');

})(window);