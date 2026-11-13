// ============================================
// ACTIVITY-SETTINGS-MODAL.JS
// Modal "Pengaturan Aktivitas" untuk guru
// Dipakai di unit-editor.html via tombol ⚙️ per aktivitas
// ============================================

(function(global) {
  'use strict';

  // ============================================
  // STATE
  // ============================================
  let _state = {
    activityId: null,
    activity: null,
    prerequisites: [], // array of { id, title }
    rubricCriteria: [], // array of { name, max, score, note }
  };

  // ============================================
  // UTIL
  // ============================================
  function $id(id) { return document.getElementById(id); }

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
  // RENDER MODAL (create sekali, reuse)
  // ============================================
  function ensureModalExists() {
    if ($id('modalActivitySettings')) return;

    const html = `
      <div class="modal-overlay" id="modalActivitySettings" style="z-index:2500;">
        <div class="modal-card" style="max-width: 720px;">
          <h2><i class="fas fa-sliders"></i> Pengaturan Aktivitas</h2>
          <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:1rem;">
            <span id="asActivityTitle">-</span> · <span id="asActivityType">-</span>
          </p>

          <div class="as-tabs" style="display:flex; gap:0.3rem; border-bottom:2px solid var(--border); margin-bottom:1rem; overflow-x:auto;">
            <button class="as-tab active" data-tab="completion" onclick="ActivitySettings.switchTab('completion')">
              <i class="fas fa-check-circle"></i> Completion
            </button>
            <button class="as-tab" data-tab="gating" onclick="ActivitySettings.switchTab('gating')">
              <i class="fas fa-lock"></i> Prasyarat
            </button>
            <button class="as-tab" data-tab="assessment" onclick="ActivitySettings.switchTab('assessment')">
              <i class="fas fa-star"></i> Penilaian
            </button>
            <button class="as-tab" data-tab="scoring" onclick="ActivitySettings.switchTab('scoring')">
              <i class="fas fa-calculator"></i> Scoring
            </button>
            <button class="as-tab" data-tab="limit" onclick="ActivitySettings.switchTab('limit')">
              <i class="fas fa-clock"></i> Batas & Attempt
            </button>
          </div>

          <div id="asTabContent" style="min-height: 300px;"></div>

          <div id="asError" class="alert alert-error hidden"></div>

          <div class="modal-actions">
            <button class="btn-secondary" onclick="ActivitySettings.close()">Batal</button>
            <button class="btn-primary" id="asSaveBtn" onclick="ActivitySettings.save()">
              <i class="fas fa-save"></i> Simpan
            </button>
          </div>
        </div>
      </div>

      <style>
        .as-tab {
          background: transparent; border: none;
          padding: 0.6rem 0.9rem; cursor: pointer;
          font-size: 0.78rem; font-weight: 700;
          color: var(--text-muted); font-family: inherit;
          border-bottom: 3px solid transparent; margin-bottom: -2px;
          transition: all 0.15s ease; white-space: nowrap;
          display: inline-flex; align-items: center; gap: 5px;
        }
        .as-tab:hover { color: var(--text); background: var(--bg-soft); }
        .as-tab.active { color: var(--green-dark); border-bottom-color: var(--green); }

        .as-section { margin-bottom: 1rem; }
        .as-section-title {
          font-size: 0.75rem; font-weight: 800; color: var(--text);
          text-transform: uppercase; letter-spacing: 0.3px;
          margin-bottom: 0.6rem; padding-bottom: 0.4rem;
          border-bottom: 1px solid var(--border);
        }
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
        .as-inline { display: flex; gap: 0.6rem; align-items: center; margin-top: 0.5rem; }
        .as-input, .as-select {
          width: 100%; padding: 0.55rem 0.8rem;
          border: 1px solid var(--border); border-radius: 8px;
          font-size: 0.85rem; font-family: inherit;
          background: var(--surface); color: var(--text); outline: none;
        }
        .as-input:focus, .as-select:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }
        .as-input-sm { max-width: 100px; }
        .as-check-list { display: flex; flex-direction: column; gap: 0.3rem; max-height: 200px; overflow-y: auto; padding: 0.4rem; background: var(--bg-soft); border-radius: 8px; }
        .as-check-item {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.4rem 0.6rem; cursor: pointer; font-size: 0.82rem;
          border-radius: 6px; transition: background 0.15s ease;
        }
        .as-check-item:hover { background: var(--surface); }
        .as-check-item input { accent-color: var(--green); }
        .as-rubric-row {
          display: grid; grid-template-columns: 2fr 1fr 1fr auto;
          gap: 0.4rem; margin-bottom: 0.4rem; align-items: center;
        }
        .as-rubric-row .as-del {
          background: white; border: 1px solid var(--border);
          width: 30px; height: 30px; border-radius: 6px;
          cursor: pointer; color: var(--danger);
        }
        .as-rubric-row .as-del:hover { background: #fee2e2; border-color: var(--danger); }
        .as-btn-add {
          padding: 0.4rem 0.8rem; font-size: 0.75rem;
          background: var(--green-lighter); border: 1px dashed var(--green);
          color: var(--green-dark); border-radius: 6px; cursor: pointer;
          font-family: inherit; font-weight: 600;
        }
        .as-btn-add:hover { background: var(--green-light); }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  // ============================================
  // MAIN OBJECT
  // ============================================
  const ActivitySettings = {
    currentTab: 'completion',

    async open(activityId) {
      ensureModalExists();
      _state.activityId = activityId;
      _state.prerequisites = [];
      _state.rubricCriteria = [];

      try {
        const activity = await getActivityMeta(activityId, true);
        if (!activity) throw new Error('Aktivitas tidak ditemukan');
        _state.activity = activity;

        $id('asActivityTitle').textContent = activity.title || '-';
        $id('asActivityType').textContent = activity.type || '-';
        $id('asError').classList.add('hidden');
        $id('asSaveBtn').disabled = false;
        $id('asSaveBtn').innerHTML = '<i class="fas fa-save"></i> Simpan';

        // Preload prerequisites kalau require_ids
        if (activity.gating_mode === 'require_ids') {
          try {
            const prereqs = await getActivityPrerequisites(activityId);
            _state.prerequisites = prereqs.map(p => String(p.prerequisite_activity_id));
          } catch (e) { console.warn('load prereqs:', e); }
        }

        // Preload rubric criteria
        if (activity.scoring_mode === 'rubric' && activity.metadata?.rubric?.criteria) {
          _state.rubricCriteria = activity.metadata.rubric.criteria.map(c => ({ ...c }));
        }

        this.switchTab('completion');
        $id('modalActivitySettings').classList.add('active');
      } catch (err) {
        console.error('open settings error:', err);
        toast('Gagal buka pengaturan: ' + err.message, 'error');
      }
    },

    close() {
      $id('modalActivitySettings').classList.remove('active');
      _state.activityId = null;
      _state.activity = null;
    },

    switchTab(tab) {
      this.currentTab = tab;
      document.querySelectorAll('.as-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
      });
      renderTab(tab);
    },

    async save() {
      if (!_state.activityId) return;
      const btn = $id('asSaveBtn');
      const errBox = $id('asError');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
      errBox.classList.add('hidden');

      try {
        const payload = collectFormData();
        await updateActivityMeta(_state.activityId, payload);

        // Simpan prerequisites kalau gating = require_ids
        if (payload.gating_mode === 'require_ids') {
          await setActivityPrerequisites(_state.activityId, _state.prerequisites);
        } else {
          // Clear prerequisites
          await setActivityPrerequisites(_state.activityId, []);
        }

        toast('✅ Pengaturan tersimpan', 'success');
        this.close();
      } catch (err) {
        console.error('save error:', err);
        errBox.textContent = 'Gagal menyimpan: ' + err.message;
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Simpan';
      }
    },

    // Rubrik helpers
    addRubricCriterion() {
      _state.rubricCriteria.push({ name: '', max: 10, score: 0, note: '' });
      renderTab('scoring');
    },
    removeRubricCriterion(idx) {
      _state.rubricCriteria.splice(idx, 1);
      renderTab('scoring');
    },
    updateRubricCriterion(idx, field, value) {
      if (!_state.rubricCriteria[idx]) return;
      _state.rubricCriteria[idx][field] = field === 'max' ? parseFloat(value) || 0 : value;
    },

    // Prereq helpers
    togglePrerequisite(id, checked) {
      const sid = String(id);
      if (checked) {
        if (!_state.prerequisites.includes(sid)) _state.prerequisites.push(sid);
      } else {
        _state.prerequisites = _state.prerequisites.filter(x => x !== sid);
      }
    }
  };

  // ============================================
  // RENDER PER TAB
  // ============================================
  function renderTab(tab) {
    if (!_state.activity) return;
    const a = _state.activity;
    const meta = a.metadata || {};
    const cont = $id('asTabContent');

    if (tab === 'completion') {
      cont.innerHTML = `
        <div class="as-section">
          <div class="as-section-title">Cara menyelesaikan aktivitas</div>
          <div class="as-radio-group">
            ${radio('completion_mode', 'manual', a.completion_mode, '✋ Manual', 'Siswa klik tombol "Selesai"')}
            ${radio('completion_mode', 'open', a.completion_mode, '📂 Otomatis saat dibuka', 'Selesai ketika siswa buka halaman')}
            ${radio('completion_mode', 'scroll', a.completion_mode, '📜 Scroll sampai bawah', 'Selesai saat siswa scroll sampai N% halaman')}
            ${radio('completion_mode', 'time_spent', a.completion_mode, '⏱️ Waktu aktif', 'Selesai setelah N detik aktif (tidak idle)')}
            ${radio('completion_mode', 'video_watch', a.completion_mode, '🎬 Video ditonton', 'Selesai saat video ditonton ≥ N%')}
            ${radio('completion_mode', 'submission', a.completion_mode, '📝 Submit jawaban', 'Selesai saat siswa submit jawaban')}
            ${radio('completion_mode', 'composite', a.completion_mode, '🔀 Composite', 'Kombinasi: waktu + scroll + video')}
          </div>
        </div>

        <div class="as-section">
          <div class="as-section-title">Parameter</div>
          <div id="asCompletionParams"></div>
        </div>
      `;
      renderCompletionParams(a.completion_mode, meta);
      bindRadioChange('completion_mode', (val) => {
        renderCompletionParams(val, meta);
      });
    }

    if (tab === 'gating') {
      cont.innerHTML = `
        <div class="as-section">
          <div class="as-section-title">Prasyarat akses</div>
          <div class="as-radio-group">
            ${radio('gating_mode', 'none', a.gating_mode, '🔓 Bebas akses', 'Siswa bisa buka kapan saja')}
            ${radio('gating_mode', 'sequential', a.gating_mode, '🔗 Sequential', 'Harus selesaikan aktivitas sebelumnya')}
            ${radio('gating_mode', 'require_ids', a.gating_mode, '🎯 Aktivitas tertentu', 'Pilih aktivitas yang harus selesai dulu')}
          </div>
        </div>

        <div class="as-section" id="asPrereqSection" style="display:none;">
          <div class="as-section-title">Aktivitas prasyarat</div>
          <div id="asPrereqList">Memuat...</div>
        </div>
      `;

      if (a.gating_mode === 'require_ids') {
        $id('asPrereqSection').style.display = 'block';
        renderPrereqList();
      }
      bindRadioChange('gating_mode', (val) => {
        if (val === 'require_ids') {
          $id('asPrereqSection').style.display = 'block';
          renderPrereqList();
        } else {
          $id('asPrereqSection').style.display = 'none';
        }
      });
    }

    if (tab === 'assessment') {
      cont.innerHTML = `
        <div class="as-section">
          <div class="as-section-title">Kategori penilaian</div>
          <div class="as-radio-group">
            ${radio('assessment_mode', 'none', a.assessment_mode, '➖ Tidak dinilai', 'Hanya tracking completion')}
            ${radio('assessment_mode', 'formative', a.assessment_mode, '📊 Formatif', 'Nilai untuk feedback, tidak masuk rapor')}
            ${radio('assessment_mode', 'summative', a.assessment_mode, '⭐ Sumatif', 'Nilai masuk rapor + TP')}
            ${radio('assessment_mode', 'diagnostic', a.assessment_mode, '🩺 Diagnostik', 'Penilaian awal (tidak masuk rapor)')}
            ${radio('assessment_mode', 'practice', a.assessment_mode, '🎯 Latihan', 'Siswa bisa ulang, tidak masuk rapor')}
          </div>
        </div>
      `;
      bindRadioChange('assessment_mode', () => {});
    }

    if (tab === 'scoring') {
      cont.innerHTML = `
        <div class="as-section">
          <div class="as-section-title">Cara menghitung skor</div>
          <div class="as-radio-group">
            ${radio('scoring_mode', 'manual', a.scoring_mode, '✍️ Manual', 'Guru isi skor 0-100')}
            ${radio('scoring_mode', 'auto', a.scoring_mode, '🤖 Auto', 'Auto-grade dari PG/BS yang punya kunci')}
            ${radio('scoring_mode', 'auto_plus_manual', a.scoring_mode, '🤖✍️ Auto + Manual', 'Auto PG/BS, manual untuk esai')}
            ${radio('scoring_mode', 'weighted_sum', a.scoring_mode, '⚖️ Weighted sum', 'Σ poin komponen / Σ total poin × 100')}
            ${radio('scoring_mode', 'rubric', a.scoring_mode, '📋 Rubrik', 'Guru isi skor per kriteria')}
          </div>
        </div>

        <div class="as-section" id="asRubricSection" style="display:none;">
          <div class="as-section-title">Kriteria rubrik</div>
          <div id="asRubricList"></div>
          <button type="button" class="as-btn-add" onclick="ActivitySettings.addRubricCriterion()" style="margin-top:0.5rem;">
            <i class="fas fa-plus"></i> Tambah Kriteria
          </button>
        </div>
      `;
      if (a.scoring_mode === 'rubric') {
        $id('asRubricSection').style.display = 'block';
        renderRubricList();
      }
      bindRadioChange('scoring_mode', (val) => {
        if (val === 'rubric') {
          $id('asRubricSection').style.display = 'block';
          renderRubricList();
        } else {
          $id('asRubricSection').style.display = 'none';
        }
      });
    }

    if (tab === 'limit') {
      const maxAttempts = meta.max_attempts || 1;
      const aggregation = meta.score_aggregation || 'highest';
      cont.innerHTML = `
        <div class="as-section">
          <div class="as-section-title">Batas waktu</div>
          <label class="as-check-item">
            <input type="checkbox" id="asTimeLimitEnabled" ${a.time_limit_minutes ? 'checked' : ''} 
              onchange="document.getElementById('asTimeLimitMinutes').disabled = !this.checked">
            Aktifkan batas waktu
          </label>
          <div class="as-inline">
            <input type="number" id="asTimeLimitMinutes" class="as-input as-input-sm" 
              value="${a.time_limit_minutes || 30}" min="1" max="600"
              ${a.time_limit_minutes ? '' : 'disabled'}>
            <span style="font-size:0.82rem; color:var(--text-muted);">menit</span>
          </div>
        </div>

        <div class="as-section">
          <div class="as-section-title">Percobaan (untuk asesmen)</div>
          <div class="as-inline">
            <label style="font-size:0.85rem; min-width:100px;">Max attempts:</label>
            <input type="number" id="asMaxAttempts" class="as-input as-input-sm" 
              value="${maxAttempts}" min="0" max="20">
            <span style="font-size:0.72rem; color:var(--text-muted);">0 = unlimited</span>
          </div>
          <div class="as-inline">
            <label style="font-size:0.85rem; min-width:100px;">Nilai diambil:</label>
            <select id="asScoreAggregation" class="as-select">
              <option value="latest" ${aggregation === 'latest' ? 'selected' : ''}>Terakhir</option>
              <option value="highest" ${aggregation === 'highest' ? 'selected' : ''}>Tertinggi</option>
              <option value="average" ${aggregation === 'average' ? 'selected' : ''}>Rata-rata</option>
              <option value="first" ${aggregation === 'first' ? 'selected' : ''}>Pertama</option>
            </select>
          </div>
        </div>
      `;
    }
  }

  // ============================================
  // HELPERS RENDER
  // ============================================
  function radio(name, value, currentValue, label, hint) {
    const checked = String(currentValue || '') === value;
    return `<label class="as-radio-item ${checked ? 'checked' : ''}">
      <input type="radio" name="as_${name}" value="${value}" ${checked ? 'checked' : ''}
        onchange="document.querySelectorAll('input[name=as_${name}]').forEach(i => i.parentElement.classList.toggle('checked', i.checked))">
      <div class="as-radio-text">
        <div class="as-radio-label">${label}</div>
        <div class="as-radio-hint">${hint}</div>
      </div>
    </label>`;
  }

  function bindRadioChange(name, cb) {
    document.querySelectorAll(`input[name="as_${name}"]`).forEach(r => {
      r.addEventListener('change', () => {
        if (r.checked) cb(r.value);
      });
    });
  }

  function renderCompletionParams(mode, meta) {
    const c = $id('asCompletionParams');
    if (!c) return;

    if (mode === 'scroll') {
      c.innerHTML = `
        <div class="as-inline">
          <label style="font-size:0.85rem; min-width:140px;">Scroll minimal:</label>
          <input type="number" id="asMinScrollPercent" class="as-input as-input-sm" 
            value="${meta.min_scroll_percent || 80}" min="10" max="100">
          <span style="font-size:0.82rem; color:var(--text-muted);">%</span>
        </div>
      `;
    } else if (mode === 'time_spent') {
      c.innerHTML = `
        <div class="as-inline">
          <label style="font-size:0.85rem; min-width:140px;">Waktu aktif minimal:</label>
          <input type="number" id="asMinActiveSeconds" class="as-input as-input-sm" 
            value="${meta.min_active_seconds || 120}" min="10" max="3600">
          <span style="font-size:0.82rem; color:var(--text-muted);">detik</span>
        </div>
      `;
    } else if (mode === 'video_watch') {
      c.innerHTML = `
        <div class="as-inline">
          <label style="font-size:0.85rem; min-width:140px;">Video ditonton minimal:</label>
          <input type="number" id="asVideoThreshold" class="as-input as-input-sm" 
            value="${meta.video_threshold_percent || 95}" min="10" max="100">
          <span style="font-size:0.82rem; color:var(--text-muted);">%</span>
        </div>
        <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">
          ℹ️ YouTube: harus ditonton sampai habis (anti-skip). 
          Google Drive: pakai timer manual (durasi video di-set guru).
        </div>
        <div class="as-inline">
          <label style="font-size:0.85rem; min-width:140px;">Durasi video (Drive):</label>
          <input type="number" id="asVideoDurationSeconds" class="as-input as-input-sm" 
            value="${meta.video_duration_seconds || 0}" min="0" max="7200">
          <span style="font-size:0.82rem; color:var(--text-muted);">detik (0 = auto dari video)</span>
        </div>
      `;
    } else if (mode === 'composite') {
      c.innerHTML = `
        <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.5rem;">
          Semua kondisi harus terpenuhi:
        </div>
        <div class="as-inline">
          <label style="font-size:0.85rem; min-width:140px;">Waktu aktif:</label>
          <input type="number" id="asMinActiveSeconds" class="as-input as-input-sm" 
            value="${meta.min_active_seconds || 120}" min="0" max="3600">
          <span style="font-size:0.82rem; color:var(--text-muted);">detik</span>
        </div>
        <div class="as-inline">
          <label style="font-size:0.85rem; min-width:140px;">Scroll minimal:</label>
          <input type="number" id="asMinScrollPercent" class="as-input as-input-sm" 
            value="${meta.min_scroll_percent || 80}" min="0" max="100">
          <span style="font-size:0.82rem; color:var(--text-muted);">%</span>
        </div>
        <div class="as-inline">
          <label style="font-size:0.85rem; min-width:140px;">Video ditonton:</label>
          <input type="number" id="asVideoThreshold" class="as-input as-input-sm" 
            value="${meta.video_threshold_percent || 95}" min="0" max="100">
          <span style="font-size:0.82rem; color:var(--text-muted);">%</span>
        </div>
      `;
    } else {
      c.innerHTML = '<p style="font-size:0.82rem; color:var(--text-muted); font-style:italic;">Tidak ada parameter tambahan.</p>';
    }
  }

  async function renderPrereqList() {
    const container = $id('asPrereqList');
    if (!container || !_state.activity) return;

    try {
      const client = initSupabase();
      const { data: activities, error } = await client.from('unit_activities')
        .select('id, title, type, order_index')
        .eq('unit_id', _state.activity.unit_id)
        .neq('id', _state.activityId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      if (!activities || activities.length === 0) {
        container.innerHTML = '<p style="font-size:0.82rem; color:var(--text-muted);">Belum ada aktivitas lain di unit ini.</p>';
        return;
      }

      container.innerHTML = `<div class="as-check-list">
        ${activities.map(act => {
          const checked = _state.prerequisites.includes(String(act.id));
          return `<label class="as-check-item">
            <input type="checkbox" ${checked ? 'checked' : ''}
              onchange="ActivitySettings.togglePrerequisite('${act.id}', this.checked)">
            <span>${esc(act.title)} <span style="font-size:0.7rem; color:var(--text-muted);">(${act.type})</span></span>
          </label>`;
        }).join('')}
      </div>`;
    } catch (err) {
      container.innerHTML = `<p style="color:var(--danger); font-size:0.82rem;">Gagal load: ${esc(err.message)}</p>`;
    }
  }

  function renderRubricList() {
    const container = $id('asRubricList');
    if (!container) return;

    if (_state.rubricCriteria.length === 0) {
      container.innerHTML = '<p style="font-size:0.82rem; color:var(--text-muted); font-style:italic;">Belum ada kriteria. Klik "Tambah Kriteria".</p>';
      return;
    }

    container.innerHTML = `
      <div style="font-size:0.72rem; color:var(--text-muted); display:grid; grid-template-columns:2fr 1fr 1fr auto; gap:0.4rem; margin-bottom:0.3rem; padding:0 0.2rem;">
        <span>Nama Kriteria</span>
        <span>Max</span>
        <span>Skor</span>
        <span></span>
      </div>
      ${_state.rubricCriteria.map((c, i) => `
        <div class="as-rubric-row">
          <input type="text" class="as-input" value="${esc(c.name)}" placeholder="Nama kriteria"
            onchange="ActivitySettings.updateRubricCriterion(${i}, 'name', this.value)">
          <input type="number" class="as-input" value="${c.max || 10}" min="1" max="1000" step="0.5"
            onchange="ActivitySettings.updateRubricCriterion(${i}, 'max', this.value)">
          <input type="number" class="as-input" value="${c.score || 0}" min="0" max="${c.max || 100}" step="0.5"
            onchange="ActivitySettings.updateRubricCriterion(${i}, 'score', this.value)">
          <button class="as-del" onclick="ActivitySettings.removeRubricCriterion(${i})"><i class="fas fa-xmark"></i></button>
        </div>
      `).join('')}
    `;
  }

  // ============================================
  // COLLECT FORM DATA
  // ============================================
  function collectFormData() {
    const payload = {
      metadata: { ...(_state.activity.metadata || {}) }
    };

    // Completion mode
    const completionRadio = document.querySelector('input[name="as_completion_mode"]:checked');
    if (completionRadio) payload.completion_mode = completionRadio.value;

    // Gating
    const gatingRadio = document.querySelector('input[name="as_gating_mode"]:checked');
    if (gatingRadio) payload.gating_mode = gatingRadio.value;

    // Assessment
    const assessmentRadio = document.querySelector('input[name="as_assessment_mode"]:checked');
    if (assessmentRadio) payload.assessment_mode = assessmentRadio.value;

    // Scoring
    const scoringRadio = document.querySelector('input[name="as_scoring_mode"]:checked');
    if (scoringRadio) payload.scoring_mode = scoringRadio.value;

    // Completion params
    if ($id('asMinScrollPercent')) payload.metadata.min_scroll_percent = parseInt($id('asMinScrollPercent').value) || 80;
    if ($id('asMinActiveSeconds')) payload.metadata.min_active_seconds = parseInt($id('asMinActiveSeconds').value) || 120;
    if ($id('asVideoThreshold')) payload.metadata.video_threshold_percent = parseInt($id('asVideoThreshold').value) || 95;
    if ($id('asVideoDurationSeconds')) payload.metadata.video_duration_seconds = parseInt($id('asVideoDurationSeconds').value) || 0;

    // Rubric
    if (payload.scoring_mode === 'rubric' && _state.rubricCriteria.length > 0) {
      payload.metadata.rubric = {
        criteria: _state.rubricCriteria.map(c => ({
          name: c.name, max: c.max, score: c.score || 0, note: c.note || ''
        }))
      };
    }

    // Time limit
    if ($id('asTimeLimitEnabled') && $id('asTimeLimitEnabled').checked) {
      payload.time_limit_minutes = parseInt($id('asTimeLimitMinutes').value) || 30;
    } else {
      payload.time_limit_minutes = null;
    }

    // Multi-attempt
    if ($id('asMaxAttempts')) payload.metadata.max_attempts = parseInt($id('asMaxAttempts').value) || 1;
    if ($id('asScoreAggregation')) payload.metadata.score_aggregation = $id('asScoreAggregation').value;

    return payload;
  }

  // ============================================
  // EXPORT
  // ============================================
  global.ActivitySettings = ActivitySettings;

  console.log('[activity-settings-modal] Loaded');

})(window);