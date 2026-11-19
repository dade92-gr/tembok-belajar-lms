// ============================================
// REMEDIAL-SETTINGS-MODAL.JS
// Modal "Pengaturan Remedial" per unit untuk guru
// Dipakai di mapel-workspace.html
// ============================================

(function (global) {
  'use strict';

  // ============================================
  // STATE
  // ============================================
  const _state = {
    unitId: null,
    unit: null,
    isSaving: false
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

  // ============================================
  // TIMEZONE HELPERS
  // Menggunakan timezone browser (bukan hardcode WIB).
  // Input datetime-local dianggap waktu lokal user.
  // ============================================

  // ISO UTC -> string untuk <input type="datetime-local"> (waktu lokal)
  function toLocalDatetimeValue(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      // Kompensasi offset timezone browser
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000);
      return local.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    } catch {
      return '';
    }
  }

  // datetime-local (waktu lokal) -> ISO UTC
  function fromLocalDatetimeValue(localStr) {
    if (!localStr) return null;
    try {
      const d = new Date(localStr); // browser parse sebagai waktu lokal
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  }

  // ============================================
  // RADIO ITEM TEMPLATE
  // Tidak pakai onchange inline — handler dipasang sekali di ensureModalExists.
  // ============================================
  function radioItem(name, value, label, hint) {
    return `<label class="as-radio-item">
      <input type="radio" name="${esc(name)}" value="${esc(value)}">
      <div class="as-radio-text">
        <div class="as-radio-label">${esc(label)}</div>
        <div class="as-radio-hint">${esc(hint)}</div>
      </div>
    </label>`;
  }

  // ============================================
  // MODAL
  // ============================================
  function ensureModalExists() {
    if (document.getElementById('modalRemedialSettings')) return;

    // 1. Inject CSS
    if (!document.getElementById('rs-styles')) {
      const style = document.createElement('style');
      style.id = 'rs-styles';
      style.textContent = `
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
        .as-radio-item.disabled { opacity: 0.55; cursor: not-allowed; pointer-events: none; }
      `;
      document.head.appendChild(style);
    }

    // 2. Build markup
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modalRemedialSettings';
    overlay.style.zIndex = '2500';

    // Opsi "request" dan "manual" belum punya UI pendukung -> ditandai disabled
    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 640px;">
        <h2><i class="fas fa-redo-alt"></i> Pengaturan Remedial</h2>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">
          Unit: <strong id="rsUnitTitle">-</strong>
        </p>

        <label style="margin-bottom:1rem; padding:0.8rem; border:1.5px solid var(--border); border-radius:8px; display:flex; align-items:start; gap:0.6rem; cursor:pointer;">
          <input type="checkbox" id="rsEnabled" style="accent-color:var(--green); margin-top:4px;">
          <div>
            <div style="font-weight:700; font-size:0.9rem;">Aktifkan Remedial untuk Unit Ini</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Siswa bisa mengulang aktivitas dalam window tertentu</div>
          </div>
        </label>

        <div id="rsBody" style="display:none;">

          <div style="margin-bottom:1rem;">
            <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem; padding-bottom:0.3rem; border-bottom:1px solid var(--border);">
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
            <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">💡 Kosongkan untuk tidak ada batas waktu</p>
          </div>

          <div style="margin-bottom:1rem;">
            <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem; padding-bottom:0.3rem; border-bottom:1px solid var(--border);">
              <i class="fas fa-users"></i> Syarat Siswa Bisa Ikut Remedial
            </div>
            <div class="as-radio-group" id="rsCondGroup">
              ${radioItem('rsCond', 'score_below_passing', 'Nilai sumatif di bawah passing grade', 'Siswa yang nilai sumatifnya < passing grade')}
              ${radioItem('rsCond', 'incomplete', 'Ada aktivitas belum selesai', 'Siswa yang belum menyelesaikan semua aktivitas')}
              <label class="as-radio-item disabled" title="Belum tersedia">
                <input type="radio" name="rsCond" value="request" disabled>
                <div class="as-radio-text">
                  <div class="as-radio-label">Siswa ajukan ke guru <em style="font-weight:400;">(segera hadir)</em></div>
                  <div class="as-radio-hint">Guru approve manual per siswa</div>
                </div>
              </label>
              <label class="as-radio-item disabled" title="Belum tersedia">
                <input type="radio" name="rsCond" value="manual" disabled>
                <div class="as-radio-text">
                  <div class="as-radio-label">Manual — guru pilih siswa tertentu <em style="font-weight:400;">(segera hadir)</em></div>
                  <div class="as-radio-hint">Guru whitelist siswa tertentu</div>
                </div>
              </label>
              ${radioItem('rsCond', 'any', 'Semua siswa (bebas)', 'Siapa saja bisa ikut remedial')}
            </div>
          </div>

          <div style="margin-bottom:1rem;">
            <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem; padding-bottom:0.3rem; border-bottom:1px solid var(--border);">
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
          </div>

          <div style="margin-bottom:1rem;">
            <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem; padding-bottom:0.3rem; border-bottom:1px solid var(--border);">
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
          <button class="btn-secondary" id="rsCancelBtn" type="button">Batal</button>
          <button class="btn-primary" id="rsSaveBtn" type="button">
            <i class="fas fa-save"></i> Simpan
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // 3. Bind toggle "Aktifkan" (sekali saja)
    const enabledCheckbox = $('rsEnabled');
    if (enabledCheckbox) {
      enabledCheckbox.addEventListener('change', () => {
        const body = $('rsBody');
        if (body) body.style.display = enabledCheckbox.checked ? 'block' : 'none';
      });
    }

    // 4. Bind radio styling (sekali saja, tidak pakai inline onchange)
    overlay.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const name = radio.name;
        overlay.querySelectorAll(`input[name="${name}"]`).forEach(r => {
          r.parentElement.classList.toggle('checked', r.checked);
        });
      });
    });

    // 5. Bind tombol
    const cancelBtn = $('rsCancelBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => RemedialSettings.close());

    const saveBtn = $('rsSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => RemedialSettings.save());

    console.log('[remedial-settings-modal] Modal injected');
  }

  // ============================================
  // MAIN OBJECT
  // ============================================
  const RemedialSettings = {
    async open(unitId) {
      if (!unitId) {
        toast('Unit ID tidak valid', 'error');
        return;
      }

      ensureModalExists();
      _state.unitId = unitId;

      try {
        if (typeof getUnitById !== 'function') {
          throw new Error('getUnitById tidak tersedia');
        }

        const unit = await getUnitById(unitId, true);
        if (!unit) throw new Error('Unit tidak ditemukan');
        _state.unit = unit;

        $('rsUnitTitle').textContent = unit.title || '-';
        $('rsEnabled').checked = !!unit.remedial_enabled;
        $('rsBody').style.display = unit.remedial_enabled ? 'block' : 'none';
        $('rsOpenAt').value = toLocalDatetimeValue(unit.remedial_open_at);
        $('rsCloseAt').value = toLocalDatetimeValue(unit.remedial_close_at);

        // Radio condition — fallback jika value tersimpan adalah mode yang belum didukung
        const supported = ['score_below_passing', 'incomplete', 'any'];
        let cond = unit.remedial_condition || 'score_below_passing';
        if (!supported.includes(cond)) cond = 'score_below_passing';

        document.querySelectorAll('input[name="rsCond"]').forEach(r => {
          r.checked = (r.value === cond);
          r.parentElement.classList.toggle('checked', r.checked);
        });

        // Passing grade + cap
        const meta = unit.remedial_metadata || {};
        const pg = Number.isFinite(meta.passing_grade) ? meta.passing_grade : 70;
        $('rsPassingGrade').value = Math.min(100, Math.max(0, pg));
        $('rsCapAtPassing').checked = meta.cap_at_passing !== false;

        // Aggregation
        const agg = meta.score_aggregation || 'highest';
        document.querySelectorAll('input[name="rsAgg"]').forEach(r => {
          r.checked = (r.value === agg);
          r.parentElement.classList.toggle('checked', r.checked);
        });

        $('rsError').classList.add('hidden');
        $('rsError').textContent = '';
        $('rsSaveBtn').disabled = false;
        $('rsSaveBtn').innerHTML = '<i class="fas fa-save"></i> Simpan';

        $('modalRemedialSettings').classList.add('active');
      } catch (err) {
        console.error('open remedial error:', err);
        toast('Gagal buka pengaturan: ' + err.message, 'error');
      }
    },

    close() {
      const modal = $('modalRemedialSettings');
      if (modal) modal.classList.remove('active');
      _state.unitId = null;
      _state.unit = null;
      _state.isSaving = false;
    },

    async save() {
      if (!_state.unitId) return;
      if (_state.isSaving) return; // cegah double-submit

      const btn = $('rsSaveBtn');
      const errBox = $('rsError');
      _state.isSaving = true;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
      errBox.classList.add('hidden');
      errBox.textContent = '';

      try {
        if (typeof initSupabase !== 'function') {
          throw new Error('initSupabase tidak tersedia');
        }

        const enabled = $('rsEnabled').checked;
        const openAt = fromLocalDatetimeValue($('rsOpenAt').value);
        const closeAt = fromLocalDatetimeValue($('rsCloseAt').value);

        const condEl = document.querySelector('input[name="rsCond"]:checked');
        const condition = condEl ? condEl.value : 'score_below_passing';

        // Validasi passing grade — perbaiki bug parseInt('0') || 70
        const rawPg = parseInt($('rsPassingGrade').value, 10);
        const passingGrade = Number.isFinite(rawPg)
          ? Math.min(100, Math.max(0, rawPg))
          : 70;

        const capAtPassing = $('rsCapAtPassing').checked;

        const aggEl = document.querySelector('input[name="rsAgg"]:checked');
        const aggregation = aggEl ? aggEl.value : 'highest';

        // Validasi window
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

        // Clear cache (guard)
        try {
          if (typeof cache !== 'undefined' && cache) {
            cache.remove('unit_' + _state.unitId);
            cache.clearByPrefix('unit_access_');
          }
        } catch (e) {
          console.warn('[remedial-settings-modal] cache clear failed:', e);
        }

        toast('✅ Pengaturan remedial tersimpan', 'success');
        this.close();

        if (typeof loadWorkspace === 'function') {
          loadWorkspace();
        }
      } catch (err) {
        console.error('save remedial error:', err);
        errBox.textContent = 'Gagal menyimpan: ' + err.message;
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Simpan';
        _state.isSaving = false;
        return;
      }

      // Reset flag hanya jika sukses (close() juga reset)
      _state.isSaving = false;
    }
  };

  global.RemedialSettings = RemedialSettings;
  console.log('[remedial-settings-modal] Loaded');

})(window);