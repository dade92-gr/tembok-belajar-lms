// ============================================
// REMEDIAL-SETTINGS-MODAL.JS
// Modal "Pengaturan Remedial" per unit untuk guru
// Dipakai di mapel-workspace.html
// ============================================

(function(global) {
  'use strict';

  let _state = {
    unitId: null,
    unit: null,
    enabled: false,
    openAt: '',
    closeAt: '',
    condition: 'score_below_passing',
    passingGrade: 70,
    capAtPassing: true,
    scoreAggregation: 'highest',
    manualStudentIds: [] // untuk mode manual
  };

  function $(id) { return document.getElementById(id); }

  function esc(t) {
    if (t == null) return '';
    const d = document.createElement('div');
    d.textContent = String(t);
    return d.innerHTML;
  }

  function toast(msg, type = 'success') {
    if (typeof showToast === 'function') showToast(msg, type);
    else console.log('[toast]', type, msg);
  }

  // Format tanggal untuk <input type="datetime-local">
  function toLocalDatetimeValue(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      // Offset WIB = UTC+7
      const offset = 7 * 60; // menit
      const local = new Date(d.getTime() + offset * 60 * 1000);
      return local.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    } catch { return ''; }
  }

  // Konversi dari input WIB ke UTC ISO
  function fromLocalDatetimeValue(localStr) {
    if (!localStr) return null;
    try {
      // localStr = "2026-11-15T08:00" (WIB)
      const local = new Date(localStr + ':00+07:00');
      if (isNaN(local.getTime())) return null;
      return local.toISOString();
    } catch { return null; }
  }

  // ============================================
  // MODAL
  // ============================================
  function ensureModalExists() {
    if ($('modalRemedialSettings')) return;

    const html = `
      <div class="modal-overlay" id="modalRemedialSettings" style="z-index:2500;">
        <div class="modal-card" style="max-width: 640px;">
          <h2><i class="fas fa-redo-alt"></i> Pengaturan Remedial</h2>
          <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">
            Unit: <strong id="rsUnitTitle">-</strong>
          </p>

          <label class="as-check-item" style="margin-bottom:1rem; padding:0.8rem; border:1.5px solid var(--border); border-radius:8px;">
            <input type="checkbox" id="rsEnabled" onchange="RemedialSettings.onToggleEnabled()" style="accent-color:var(--green);">
            <div>
              <div style="font-weight:700; font-size:0.9rem;">Aktifkan Remedial untuk Unit Ini</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">Siswa bisa mengulang aktivitas dalam window tertentu</div>
            </div>
          </label>

          <div id="rsBody" style="display:none;">

            <!-- WINDOW -->
            <div class="as-section" style="margin-bottom:1rem;">
              <div class="as-section-title" style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem; padding-bottom:0.3rem; border-bottom:1px solid var(--border);">
                <i class="fas fa-calendar"></i> Window Remedial
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem;">
                <div>
                  <label class="form-label">Dibuka</label>
                  <input type="datetime-local" id="rsOpenAt" class="form-input">
                </div>
                <div>
                  <label class="form-label">Ditutup</label>
                  <input type="datetime-local" id="rsCloseAt" class="form-input">
                </div>
              </div>
              <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">
                💡 Kosongkan untuk tidak ada batas waktu
              </p>
            </div>

            <!-- KONDISI -->
            <div class="as-section" style="margin-bottom:1rem;">
              <div class="as-section-title" style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem; padding-bottom:0.3rem; border-bottom:1px solid var(--border);">
                <i class="fas fa-users"></i> Syarat Siswa Bisa Ikut Remedial
              </div>
              <div class="as-radio-group">
                ${radioItem('rsCond', 'score_below_passing', 'Nilai sumatif di bawah passing grade', 'Siswa yang nilai sumatifnya < passing grade')}
                ${radioItem('rsCond', 'incomplete', 'Ada aktivitas belum selesai', 'Siswa yang belum menyelesaikan semua aktivitas')}
                ${radioItem('rsCond', 'request', 'Siswa ajukan ke guru', 'Guru approve manual per siswa')}
                ${radioItem('rsCond', 'manual', 'Manual — guru pilih siswa tertentu', 'Guru whitelist siswa tertentu')}
                ${radioItem('rsCond', 'any', 'Semua siswa (bebas)', 'Siapa saja bisa ikut remedial')}
              </div>
            </div>

            <!-- PASSING GRADE -->
            <div class="as-section" style="margin-bottom:1rem;">
              <div class="as-section-title" style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem; padding-bottom:0.3rem; border-bottom:1px solid var(--border);">
                <i class="fas fa-award"></i> Passing Grade
              </div>
              <div style="display:flex; gap:0.6rem; align-items:center;">
                <input type="number" id="rsPassingGrade" class="form-input" style="max-width:100px;" min="0" max="100" value="70">
                <span style="font-size:0.82rem; color:var(--text-muted);">/ 100</span>
              </div>
              <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; margin-top:0.6rem;">
                <input type="checkbox" id="rsCapAtPassing" style="accent-color:var(--green);">
                Batasi nilai remedial maksimal di passing grade
              </label>
              <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">
                💡 Kalau dicentang: siswa hanya bisa naik sampai passing grade, tidak melebihi
              </p>
            </div>

            <!-- AGGREGATION -->
            <div class="as-section" style="margin-bottom:1rem;">
              <div class="as-section-title" style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem; padding-bottom:0.3rem; border-bottom:1px solid var(--border);">
                <i class="fas fa-calculator"></i> Nilai Setelah Remedial
              </div>
              <div class="as-radio-group">
                ${radioItem('rsAgg', 'highest', 'Ambil nilai tertinggi', 'Nilai awal vs remedial — yang tertinggi dipakai')}
                ${radioItem('rsAgg', 'latest', 'Ambil nilai terakhir', 'Remedial menimpa nilai awal')}
                ${radioItem('rsAgg', 'average', 'Ambil rata-rata', 'Rata-rata dari semua attempt')}
              </div>
            </div>

          </div>

          <div id="rsError" class="alert alert-error hidden"></div>

          <div class="modal-actions">
            <button class="btn-secondary" onclick="RemedialSettings.close()">Batal</button>
            <button class="btn-primary" id="rsSaveBtn" onclick="RemedialSettings.save()">
              <i class="fas fa-save"></i> Simpan
            </button>
          </div>
        </div>
      </div>

      <style>
        .as-radio-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .as-radio-item {
          display: flex; align-items: start; gap: 0.6rem;
          padding: 0.6rem 0.8rem; background: var(--bg-soft);
          border: 1.5px solid var(--border); border-radius: 8px;
          cursor: pointer; transition: all 0.15s ease;
        }
        .as-radio-item:hover { background: var(--green-lighter); border-color: var(--green-light); }
        .as-radio-item.checked { background: var(--green-lighter); border-color: var(--green); }
        .as-radio-item input { margin-top: 3px; accent-color: var(--green); flex-shrink: 0; }
        .as-radio-item .as-radio-text { flex: 1; }
        .as-radio-item .as-radio-label { font-weight: 700; font-size: 0.85rem; color: var(--text); }
        .as-radio-item .as-radio-hint { font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function radioItem(name, value, label, hint) {
    return `<label class="as-radio-item">
      <input type="radio" name="${name}" value="${value}" onchange="document.querySelectorAll('input[name=${name}]').forEach(i => i.parentElement.classList.toggle('checked', i.checked))">
      <div class="as-radio-text">
        <div class="as-radio-label">${label}</div>
        <div class="as-radio-hint">${hint}</div>
      </div>
    </label>`;
  }

  // ============================================
  // MAIN OBJECT
  // ============================================
  const RemedialSettings = {
    async open(unitId) {
      ensureModalExists();
      _state.unitId = unitId;

      try {
        const unit = await getUnitById(unitId, true);
        if (!unit) throw new Error('Unit tidak ditemukan');
        _state.unit = unit;

        $('#rsUnitTitle').textContent = unit.title || '-';
        $('#rsEnabled').checked = !!unit.remedial_enabled;
        $('#rsBody').style.display = unit.remedial_enabled ? 'block' : 'none';
        $('#rsOpenAt').value = toLocalDatetimeValue(unit.remedial_open_at);
        $('#rsCloseAt').value = toLocalDatetimeValue(unit.remedial_close_at);

        // Radio condition
        const cond = unit.remedial_condition || 'score_below_passing';
        document.querySelectorAll('input[name="rsCond"]').forEach(r => {
          r.checked = (r.value === cond);
          r.parentElement.classList.toggle('checked', r.checked);
        });

        // Passing grade + cap
        const meta = unit.remedial_metadata || {};
        $('#rsPassingGrade').value = meta.passing_grade || 70;
        $('#rsCapAtPassing').checked = meta.cap_at_passing !== false;

        // Aggregation
        const agg = meta.score_aggregation || 'highest';
        document.querySelectorAll('input[name="rsAgg"]').forEach(r => {
          r.checked = (r.value === agg);
          r.parentElement.classList.toggle('checked', r.checked);
        });

        $('#rsError').classList.add('hidden');
        $('#rsSaveBtn').disabled = false;
        $('#rsSaveBtn').innerHTML = '<i class="fas fa-save"></i> Simpan';

        $('#modalRemedialSettings').classList.add('active');
      } catch (err) {
        console.error('open remedial error:', err);
        toast('Gagal buka pengaturan: ' + err.message, 'error');
      }
    },

    close() {
      $('#modalRemedialSettings').classList.remove('active');
      _state.unitId = null;
      _state.unit = null;
    },

    onToggleEnabled() {
      const enabled = $('#rsEnabled').checked;
      $('#rsBody').style.display = enabled ? 'block' : 'none';
    },

    async save() {
      if (!_state.unitId) return;
      const btn = $('#rsSaveBtn');
      const errBox = $('#rsError');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
      errBox.classList.add('hidden');

      try {
        const enabled = $('#rsEnabled').checked;
        const openAt = fromLocalDatetimeValue($('#rsOpenAt').value);
        const closeAt = fromLocalDatetimeValue($('#rsCloseAt').value);
        const condEl = document.querySelector('input[name="rsCond"]:checked');
        const condition = condEl ? condEl.value : 'score_below_passing';
        const passingGrade = parseInt($('#rsPassingGrade').value) || 70;
        const capAtPassing = $('#rsCapAtPassing').checked;
        const aggEl = document.querySelector('input[name="rsAgg"]:checked');
        const aggregation = aggEl ? aggEl.value : 'highest';

        // Validasi
        if (enabled && openAt && closeAt && new Date(openAt) >= new Date(closeAt)) {
          throw new Error('Waktu buka harus sebelum waktu tutup');
        }

        const client = initSupabase();
        const { error } = await client.from('units')
          .update({
            remedial_enabled: enabled,
            remedial_open_at: openAt,
            remedial_close_at: closeAt,
            remedial_condition: condition,
            remedial_metadata: {
              passing_grade: passingGrade,
              cap_at_passing: capAtPassing,
              score_aggregation: aggregation
            }
          })
          .eq('id', _state.unitId);

        if (error) throw error;

        // Clear cache
        try {
          cache.remove('unit_' + _state.unitId);
          cache.clearByPrefix('unit_access_');
        } catch (e) {}

        toast('✅ Pengaturan remedial tersimpan', 'success');
        this.close();

        // Reload workspace (kalau ada fungsi-nya)
        if (typeof loadWorkspace === 'function') {
          loadWorkspace();
        }
      } catch (err) {
        console.error('save remedial error:', err);
        errBox.textContent = 'Gagal menyimpan: ' + err.message;
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Simpan';
      }
    }
  };

  global.RemedialSettings = RemedialSettings;
  console.log('[remedial-settings-modal] Loaded');

})(window);