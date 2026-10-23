// ==========================================================================
// SIANTRI - Admin Dashboard & Master Data Management Module
// ==========================================================================

const AdminModule = {
  currentTab: 'overview',
  services: [],
  counters: [],
  users: [],
  settings: {},
  reportData: null,

  async init() {
    this.bindSubNav();
    await this.loadAll();
    this.bindEvents();

    if (window.socketManager) {
      window.socketManager.on('ticket_called', () => this.refreshIfActive());
      window.socketManager.on('ticket_created', () => this.refreshIfActive());
      window.socketManager.on('ticket_completed', () => this.refreshIfActive());
      window.socketManager.on('ticket_skipped', () => this.refreshIfActive());
      window.socketManager.on('ticket_cancelled', () => this.refreshIfActive());
    }
  },

  refreshIfActive() {
    if (this.currentTab === 'overview') {
      this.loadOverview();
    } else if (this.currentTab === 'reports') {
      this.loadReports();
    }
  },

  async loadAll() {
    try {
      const [resS, resC, resU, resSet] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/counters'),
        fetch('/api/users'),
        fetch('/api/settings')
      ]);

      this.services = await resS.json();
      this.counters = await resC.json();
      this.users = await resU.json();
      this.settings = await resSet.json();

      this.renderCurrentTab();
    } catch (e) {
      console.error("Admin loadAll error:", e);
    }
  },

  bindSubNav() {
    const tabs = document.querySelectorAll('.admin-subnav-btn');
    tabs.forEach(btn => {
      btn.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.dataset.tab;
        this.renderCurrentTab();
      };
    });
  },

  renderCurrentTab() {
    document.querySelectorAll('.admin-subtab-pane').forEach(p => p.style.display = 'none');
    const pane = document.getElementById(`admin-pane-${this.currentTab}`);
    if (pane) pane.style.display = 'block';

    switch (this.currentTab) {
      case 'overview':
        this.loadOverview();
        break;
      case 'services':
        this.renderServicesTable();
        break;
      case 'counters':
        this.renderCountersTable();
        break;
      case 'users':
        this.renderUsersTable();
        break;
      case 'reports':
        this.loadReports();
        break;
      case 'settings':
        this.populateSettingsForm();
        break;
    }
  },

  // --------------------------------------------------------------------------
  // TAB 1: OVERVIEW & LIVE COUNTERS
  // --------------------------------------------------------------------------
  async loadOverview() {
    try {
      const [resMon, resC] = await Promise.all([
        fetch('/api/monitor'),
        fetch('/api/counters')
      ]);
      const monState = await resMon.json();
      const counters = await resC.json();

      const totalEl = document.getElementById('admin-kpi-total');
      const waitingEl = document.getElementById('admin-kpi-waiting');
      const completedEl = document.getElementById('admin-kpi-completed');
      const activeCallEl = document.getElementById('admin-kpi-activecall');

      if (totalEl) totalEl.textContent = monState.stats.total;
      if (waitingEl) waitingEl.textContent = monState.stats.waiting;
      if (completedEl) completedEl.textContent = monState.stats.completed;
      if (activeCallEl) activeCallEl.textContent = monState.currentCall ? monState.currentCall.ticketCode : '-';

      const grid = document.getElementById('admin-overview-counters-grid');
      if (grid) {
        grid.innerHTML = counters.map(c => `
          <div class="card" style="padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
              <h3 style="font-size: 1.1rem; color: #fff;">${c.name}</h3>
              <span class="badge ${c.currentTicket ? 'badge-calling' : 'badge-completed'}">
                ${c.currentTicket ? 'Melayani' : 'Siap'}
              </span>
            </div>
            <div style="background: rgba(0,0,0,0.3); border-radius: var(--radius-md); padding: 0.75rem; text-align: center; margin: 0.75rem 0;">
              <span style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Nomor Aktif</span>
              <div class="font-mono" style="font-size: 1.8rem; font-weight: 800; color: ${c.currentTicket ? '#34d399' : '#9ca3af'};">
                ${c.currentTicket ? c.currentTicket.ticketCode : '-'}
              </div>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; justify-content: space-between;">
              <span>Petugas:</span>
              <strong style="color: #cbd5e1;">${c.staffName}</strong>
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.error("Overview error:", e);
    }
  },

  // --------------------------------------------------------------------------
  // TAB 2: MASTER DATA LAYANAN (SERVICES)
  // --------------------------------------------------------------------------
  renderServicesTable() {
    const tbody = document.getElementById('admin-services-tbody');
    if (!tbody) return;

    if (this.services.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">Belum ada layanan</td></tr>`;
      return;
    }

    tbody.innerHTML = this.services.map(s => `
      <tr>
        <td>
          <span class="font-mono" style="background: ${s.color || '#2563eb'}; color: #fff; width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-weight: 800;">
            ${s.code}
          </span>
        </td>
        <td>
          <strong style="color: #fff; font-size: 0.95rem;">${s.name}</strong>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${s.description || '-'}</p>
        </td>
        <td class="font-mono" style="color: var(--cyan);">${s.avgDuration} Menit</td>
        <td>
          <span class="badge ${s.active !== false ? 'badge-completed' : 'badge-cancelled'}">
            ${s.active !== false ? 'Aktif' : 'Nonaktif'}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-outline" style="padding: 0.35rem 0.65rem; font-size: 0.78rem;" onclick="AdminModule.openEditServiceModal('${s.id}')">
              ✏️ Edit
            </button>
            <button class="btn btn-outline" style="padding: 0.35rem 0.65rem; font-size: 0.78rem; color: #fb7185; border-color: rgba(244,63,94,0.3);" onclick="AdminModule.deleteService('${s.id}')">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  openAddServiceModal() {
    document.getElementById('service-modal-title').textContent = 'Tambah Layanan Baru';
    document.getElementById('service-form-id').value = '';
    document.getElementById('service-form-code').value = '';
    document.getElementById('service-form-name').value = '';
    document.getElementById('service-form-desc').value = '';
    document.getElementById('service-form-duration').value = '10';
    document.getElementById('service-form-color').value = '#2563eb';
    document.getElementById('service-modal').classList.add('active');
  },

  openEditServiceModal(id) {
    const s = this.services.find(x => x.id === id);
    if (!s) return;

    document.getElementById('service-modal-title').textContent = 'Edit Layanan';
    document.getElementById('service-form-id').value = s.id;
    document.getElementById('service-form-code').value = s.code;
    document.getElementById('service-form-name').value = s.name;
    document.getElementById('service-form-desc').value = s.description || '';
    document.getElementById('service-form-duration').value = s.avgDuration || 10;
    document.getElementById('service-form-color').value = s.color || '#2563eb';
    document.getElementById('service-modal').classList.add('active');
  },

  closeServiceModal() {
    document.getElementById('service-modal').classList.remove('active');
  },

  async saveService() {
    const id = document.getElementById('service-form-id').value;
    const code = document.getElementById('service-form-code').value.trim();
    const name = document.getElementById('service-form-name').value.trim();
    const description = document.getElementById('service-form-desc').value.trim();
    const avgDuration = Number(document.getElementById('service-form-duration').value) || 10;
    const color = document.getElementById('service-form-color').value;

    if (!code || !name) {
      alert("Kode dan Nama Layanan wajib diisi!");
      return;
    }

    try {
      if (id) {
        // Update
        const res = await fetch(`/api/services/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, name, description, avgDuration, color })
        });
        if (!res.ok) throw new Error('Gagal update layanan');
      } else {
        // Create
        const res = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, name, description, avgDuration, color })
        });
        if (!res.ok) throw new Error('Gagal menambah layanan');
      }

      this.closeServiceModal();
      await this.loadAll();
      if (window.app) window.app.showToast('Layanan berhasil disimpan!', 'success');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  async deleteService(id) {
    const s = this.services.find(x => x.id === id);
    if (!s) return;
    if (!confirm(`Hapus layanan "${s.name}"?`)) return;

    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus');
      await this.loadAll();
      if (window.app) window.app.showToast('Layanan berhasil dihapus', 'info');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  // --------------------------------------------------------------------------
  // TAB 3: MASTER DATA LOKET (COUNTERS)
  // --------------------------------------------------------------------------
  renderCountersTable() {
    const tbody = document.getElementById('admin-counters-tbody');
    if (!tbody) return;

    if (this.counters.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">Belum ada loket</td></tr>`;
      return;
    }

    tbody.innerHTML = this.counters.map(c => {
      const srvBadges = c.serviceIds.map(sid => {
        const s = this.services.find(x => x.id === sid);
        return s ? `<span class="badge" style="background: ${s.color}22; color: ${s.color}; border: 1px solid ${s.color}44; font-size: 0.7rem; margin-right: 4px;">${s.code} - ${s.name}</span>` : '';
      }).join('');

      return `
        <tr>
          <td><strong style="color: #fff; font-size: 1rem;">${c.name}</strong></td>
          <td>${srvBadges || '<span style="color: var(--text-dim);">Semua Layanan</span>'}</td>
          <td><span style="color: #cbd5e1; font-size: 0.85rem;">${c.staffName || 'Belum Ditugaskan'}</span></td>
          <td>
            <span class="badge ${c.status === 'active' ? 'badge-completed' : 'badge-cancelled'}">
              ${c.status === 'active' ? 'Buka' : 'Tutup'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-outline" style="padding: 0.35rem 0.65rem; font-size: 0.78rem;" onclick="AdminModule.openEditCounterModal('${c.id}')">
                ✏️ Edit
              </button>
              <button class="btn btn-outline" style="padding: 0.35rem 0.65rem; font-size: 0.78rem; color: #fb7185; border-color: rgba(244,63,94,0.3);" onclick="AdminModule.deleteCounter('${c.id}')">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddCounterModal() {
    document.getElementById('counter-modal-title').textContent = 'Tambah Loket Baru';
    document.getElementById('counter-form-id').value = '';
    document.getElementById('counter-form-name').value = `Loket ${this.counters.length + 1}`;
    
    this.populateCounterServiceCheckboxes([]);
    this.populateCounterStaffSelect(null);
    document.getElementById('counter-modal').classList.add('active');
  },

  openEditCounterModal(id) {
    const c = this.counters.find(x => x.id === id);
    if (!c) return;

    document.getElementById('counter-modal-title').textContent = 'Edit Loket';
    document.getElementById('counter-form-id').value = c.id;
    document.getElementById('counter-form-name').value = c.name;

    this.populateCounterServiceCheckboxes(c.serviceIds || []);
    this.populateCounterStaffSelect(c.assignedStaffId);
    document.getElementById('counter-modal').classList.add('active');
  },

  populateCounterServiceCheckboxes(selectedIds) {
    const container = document.getElementById('counter-form-services');
    if (!container) return;

    container.innerHTML = this.services.map(s => `
      <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #fff; cursor: pointer; background: rgba(0,0,0,0.2); padding: 0.4rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <input type="checkbox" name="counter-service-item" value="${s.id}" ${selectedIds.includes(s.id) ? 'checked' : ''} />
        <span class="font-mono" style="color: ${s.color}; font-weight: 700;">[${s.code}]</span>
        ${s.name}
      </label>
    `).join('');
  },

  populateCounterStaffSelect(selectedStaffId) {
    const sel = document.getElementById('counter-form-staff');
    if (!sel) return;

    const staffUsers = this.users.filter(u => u.role === 'staff' || u.role === 'admin');
    sel.innerHTML = `
      <option value="">-- Pilih Petugas yang Bertugas --</option>
      ${staffUsers.map(u => `
        <option value="${u.id}" ${u.id === selectedStaffId ? 'selected' : ''}>${u.name} (@${u.username})</option>
      `).join('')}
    `;
  },

  closeCounterModal() {
    document.getElementById('counter-modal').classList.remove('active');
  },

  async saveCounter() {
    const id = document.getElementById('counter-form-id').value;
    const name = document.getElementById('counter-form-name').value.trim();
    const staffId = document.getElementById('counter-form-staff').value || null;

    const checked = Array.from(document.querySelectorAll('input[name="counter-service-item"]:checked')).map(el => el.value);

    if (!name) {
      alert("Nama Loket wajib diisi!");
      return;
    }

    try {
      if (id) {
        const res = await fetch(`/api/counters/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            serviceIds: checked,
            assignedStaffId: staffId
          })
        });
        if (!res.ok) throw new Error('Gagal update loket');
      } else {
        const res = await fetch('/api/counters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            serviceIds: checked,
            assignedStaffId: staffId
          })
        });
        if (!res.ok) throw new Error('Gagal tambah loket');
      }

      this.closeCounterModal();
      await this.loadAll();
      if (window.app) window.app.showToast('Loket berhasil disimpan!', 'success');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  async deleteCounter(id) {
    const c = this.counters.find(x => x.id === id);
    if (!c) return;
    if (!confirm(`Hapus ${c.name}?`)) return;

    try {
      const res = await fetch(`/api/counters/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus');
      await this.loadAll();
      if (window.app) window.app.showToast('Loket berhasil dihapus', 'info');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  // --------------------------------------------------------------------------
  // TAB 4: MANAJEMEN USER / PETUGAS
  // --------------------------------------------------------------------------
  renderUsersTable() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    tbody.innerHTML = this.users.map(u => {
      const counter = this.counters.find(c => c.id === u.assignedCounterId);
      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="user-avatar" style="width: 32px; height: 32px;">${u.name.charAt(0)}</span>
              <div>
                <strong style="color: #fff; font-size: 0.95rem;">${u.name}</strong>
                <span style="font-size: 0.75rem; color: var(--text-dim); display: block;">@${u.username}</span>
              </div>
            </div>
          </td>
          <td>
            <span class="user-role-badge ${u.role === 'admin' ? 'role-admin' : 'role-staff'}">
              ${u.role}
            </span>
          </td>
          <td><span style="font-size: 0.85rem; color: #cbd5e1;">${counter ? counter.name : '-'}</span></td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-outline" style="padding: 0.35rem 0.65rem; font-size: 0.78rem;" onclick="AdminModule.openEditUserModal('${u.id}')">
                ✏️ Edit
              </button>
              ${u.username !== 'admin' ? `
                <button class="btn btn-outline" style="padding: 0.35rem 0.65rem; font-size: 0.78rem; color: #fb7185; border-color: rgba(244,63,94,0.3);" onclick="AdminModule.deleteUser('${u.id}')">
                  🗑️
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddUserModal() {
    document.getElementById('user-modal-title').textContent = 'Tambah Petugas Baru';
    document.getElementById('user-form-id').value = '';
    document.getElementById('user-form-name').value = '';
    document.getElementById('user-form-username').value = '';
    document.getElementById('user-form-password').value = 'petugas123';
    document.getElementById('user-form-role').value = 'staff';
    
    this.populateUserCounterSelect(null);
    document.getElementById('user-modal').classList.add('active');
  },

  openEditUserModal(id) {
    const u = this.users.find(x => x.id === id);
    if (!u) return;

    document.getElementById('user-modal-title').textContent = 'Edit Akun Pengguna';
    document.getElementById('user-form-id').value = u.id;
    document.getElementById('user-form-name').value = u.name;
    document.getElementById('user-form-username').value = u.username;
    document.getElementById('user-form-password').value = ''; // leave blank to keep
    document.getElementById('user-form-role').value = u.role;

    this.populateUserCounterSelect(u.assignedCounterId);
    document.getElementById('user-modal').classList.add('active');
  },

  populateUserCounterSelect(selectedCounterId) {
    const sel = document.getElementById('user-form-counter');
    if (!sel) return;

    sel.innerHTML = `
      <option value="">-- Tidak Ditugaskan --</option>
      ${this.counters.map(c => `
        <option value="${c.id}" ${c.id === selectedCounterId ? 'selected' : ''}>${c.name}</option>
      `).join('')}
    `;
  },

  closeUserModal() {
    document.getElementById('user-modal').classList.remove('active');
  },

  async saveUser() {
    const id = document.getElementById('user-form-id').value;
    const name = document.getElementById('user-form-name').value.trim();
    const username = document.getElementById('user-form-username').value.trim();
    const password = document.getElementById('user-form-password').value;
    const role = document.getElementById('user-form-role').value;
    const assignedCounterId = document.getElementById('user-form-counter').value || null;

    if (!name || !username) {
      alert("Nama dan Username wajib diisi!");
      return;
    }

    const payload = { name, username, role, assignedCounterId };
    if (password) payload.password = password;

    try {
      if (id) {
        const res = await fetch(`/api/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Gagal update user');
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Gagal tambah user');
      }

      this.closeUserModal();
      await this.loadAll();
      if (window.app) window.app.showToast('Akun berhasil disimpan!', 'success');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  async deleteUser(id) {
    if (!confirm("Hapus pengguna ini?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus user');
      await this.loadAll();
      if (window.app) window.app.showToast('Pengguna dihapus', 'info');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  // --------------------------------------------------------------------------
  // TAB 5: LAPORAN & STATISTIK (ANALYTICS, HOURLY CHART, CSV EXPORT)
  // --------------------------------------------------------------------------
  async loadReports() {
    const startDate = document.getElementById('report-filter-start')?.value || '';
    const endDate = document.getElementById('report-filter-end')?.value || '';

    let url = '/api/reports';
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      this.reportData = data;

      // Summary KPIs
      document.getElementById('rep-total').textContent = data.summary.totalTickets;
      document.getElementById('rep-completed').textContent = data.summary.completedCount;
      document.getElementById('rep-skipped').textContent = data.summary.skippedCount;
      document.getElementById('rep-avgwait').textContent = `${data.summary.avgWaitMinutes} mnt`;
      document.getElementById('rep-avgservice').textContent = `${data.summary.avgServiceMinutes} mnt`;

      // Render Hourly Chart
      this.renderHourlyChart(data.hourlyTraffic);

      // Render Counter Performance Bars
      this.renderCounterPerformance(data.counterPerformance);

      // Render Service Breakdown
      this.renderServiceBreakdown(data.serviceDistribution);

      // Render Transaction Table
      this.renderReportTicketsTable(data.tickets);
    } catch (e) {
      console.error("Load reports error:", e);
    }
  },

  renderHourlyChart(hourlyTraffic) {
    const container = document.getElementById('hourly-chart-container');
    if (!container) return;

    const hours = Object.keys(hourlyTraffic);
    const counts = Object.values(hourlyTraffic);
    const maxVal = Math.max(...counts, 8); // at least 8 for nice scale

    container.innerHTML = `
      <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 180px; gap: 0.65rem; padding-top: 1.5rem; border-bottom: 1px solid var(--border-color);">
        ${hours.map((hr, idx) => {
          const val = counts[idx];
          const heightPct = Math.round((val / maxVal) * 100);
          return `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; position: relative;" title="${hr}: ${val} tiket">
              <span class="font-mono" style="font-size: 0.72rem; color: #fff; margin-bottom: 4px; font-weight: 700;">${val > 0 ? val : ''}</span>
              <div style="width: 100%; height: ${Math.max(heightPct, 4)}%; background: linear-gradient(180deg, var(--cyan) 0%, var(--primary) 100%); border-radius: 6px 6px 0 0; transition: height 0.5s ease; box-shadow: 0 0 10px rgba(6, 182, 212, 0.3);"></div>
              <span class="font-mono" style="font-size: 0.7rem; color: var(--text-dim); margin-top: 8px;">${hr.split(':')[0]}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div style="text-align: center; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.75rem;">
        Distribusi Volume Antrean per Jam Pelayanan (Pukul 08:00 - 16:00 WIB)
      </div>
    `;
  },

  renderCounterPerformance(perfList) {
    const container = document.getElementById('counter-perf-container');
    if (!container) return;

    if (perfList.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Tidak ada data kinerja loket</p>`;
      return;
    }

    const maxServed = Math.max(...perfList.map(p => p.totalServed), 1);

    container.innerHTML = perfList.map(p => {
      const pct = Math.round((p.totalServed / maxServed) * 100);
      return `
        <div style="margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.25rem;">
            <strong style="color: #fff;">${p.counterName}</strong>
            <span style="color: var(--text-muted);">${p.totalServed} dilayani | Rata-rata: <strong style="color: var(--cyan);">${p.avgServiceTime} mnt</strong></span>
          </div>
          <div style="height: 10px; background: rgba(0,0,0,0.3); border-radius: 9999px; overflow: hidden; border: 1px solid var(--border-color);">
            <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, #10b981, #06b6d4); border-radius: 9999px;"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderServiceBreakdown(distribution) {
    const container = document.getElementById('service-breakdown-container');
    if (!container) return;

    container.innerHTML = distribution.map(d => `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.85rem; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span class="font-mono" style="background: ${d.color}; color: #fff; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">
            ${d.serviceCode}
          </span>
          <span style="font-size: 0.85rem; color: #fff;">${d.serviceName}</span>
        </div>
        <div style="text-align: right;">
          <strong class="font-mono" style="color: #fff; font-size: 0.95rem;">${d.count} Tiket</strong>
          <span style="font-size: 0.72rem; color: var(--text-dim); display: block;">(${d.completed} selesai)</span>
        </div>
      </div>
    `).join('');
  },

  renderReportTicketsTable(tickets) {
    const tbody = document.getElementById('report-tickets-tbody');
    if (!tbody) return;

    if (tickets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">Tidak ada transaksi pada filter tanggal ini</td></tr>`;
      return;
    }

    tbody.innerHTML = tickets.map(t => `
      <tr>
        <td><strong class="font-mono" style="color: #fff;">${t.ticketCode}</strong></td>
        <td style="font-size: 0.82rem; color: #cbd5e1;">${t.serviceName}</td>
        <td style="font-size: 0.82rem;">${t.customerName || '-'}</td>
        <td style="font-size: 0.78rem; color: var(--text-dim);">${t.date}</td>
        <td><span class="badge ${t.status === 'completed' ? 'badge-completed' : t.status === 'skipped' ? 'badge-skipped' : t.status === 'calling' ? 'badge-calling' : 'badge-waiting'}">${t.status}</span></td>
        <td style="font-size: 0.82rem; color: #cbd5e1;">${t.counterName || '-'}</td>
        <td style="font-size: 0.78rem; color: var(--text-dim);">${t.staffName || '-'}</td>
      </tr>
    `).join('');
  },

  exportCSV() {
    const startDate = document.getElementById('report-filter-start')?.value || '';
    const endDate = document.getElementById('report-filter-end')?.value || '';
    let url = '/api/reports/export-csv';
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    window.location.href = url;
  },

  // --------------------------------------------------------------------------
  // TAB 6: PENGATURAN SISTEM & MANAJEMEN HARIAN
  // --------------------------------------------------------------------------
  populateSettingsForm() {
    const set = this.settings;
    if (!set) return;

    const nameEl = document.getElementById('setting-inst-name');
    const addrEl = document.getElementById('setting-inst-addr');
    const textEl = document.getElementById('setting-running-text');
    const resetTimeEl = document.getElementById('setting-reset-time');
    const voiceSpeedEl = document.getElementById('setting-voice-speed');
    const voicePitchEl = document.getElementById('setting-voice-pitch');
    const speedValEl = document.getElementById('setting-speed-val');
    const pitchValEl = document.getElementById('setting-pitch-val');

    if (nameEl) nameEl.value = set.institutionName || '';
    if (addrEl) addrEl.value = set.institutionAddress || '';
    if (textEl) textEl.value = set.runningText || '';
    if (resetTimeEl) resetTimeEl.value = set.dailyResetTime || '00:00';
    if (voiceSpeedEl) {
      voiceSpeedEl.value = set.voiceSpeed || 1.0;
      if (speedValEl) speedValEl.textContent = `${set.voiceSpeed || 1.0}x`;
      voiceSpeedEl.oninput = (e) => {
        if (speedValEl) speedValEl.textContent = `${e.target.value}x`;
      };
    }
    if (voicePitchEl) {
      voicePitchEl.value = set.voicePitch || 1.0;
      if (pitchValEl) pitchValEl.textContent = `${set.voicePitch || 1.0}`;
      voicePitchEl.oninput = (e) => {
        if (pitchValEl) pitchValEl.textContent = `${e.target.value}`;
      };
    }

    this.loadSupabaseConfig();
  },

  async loadSupabaseConfig() {
    const badge = document.getElementById('supabase-status-badge');
    const urlInput = document.getElementById('setting-supabase-url');
    try {
      const res = await fetch('/api/supabase/status');
      const data = await res.json();
      if (data.isConfigured) {
        if (badge) {
          badge.textContent = '✅ Terhubung ke Supabase';
          badge.className = 'badge badge-calling';
        }
        if (urlInput && !urlInput.value) urlInput.value = data.url || '';
      } else {
        if (badge) {
          badge.textContent = '📁 Mode Cache Lokal (Menunggu Kunci)';
          badge.className = 'badge badge-waiting';
        }
      }
    } catch (e) {
      if (badge) {
        badge.textContent = 'Offline';
        badge.className = 'badge badge-cancelled';
      }
    }
  },

  async testSupabase() {
    if (window.app) window.app.showToast('Menguji koneksi ke Supabase...', 'info');
    try {
      const res = await fetch('/api/supabase/test', { method: 'POST' });
      const data = await res.json();
      if (data.connected) {
        if (window.app) window.app.showToast('✅ Berhasil terhubung ke Supabase PostgreSQL!', 'success');
        this.loadSupabaseConfig();
      } else {
        alert(`Koneksi Supabase Belum Berhasil:\n\n${data.message || data.error || 'Periksa URL & Key di file .env'}`);
      }
    } catch (e) {
      alert(`Error uji koneksi: ${e.message}`);
    }
  },

  async saveSupabaseConfig() {
    const supabaseUrl = document.getElementById('setting-supabase-url')?.value.trim();
    const supabaseKey = document.getElementById('setting-supabase-key')?.value.trim();

    if (!supabaseUrl || !supabaseKey) {
      alert("Project URL dan API Key Supabase wajib diisi!");
      return;
    }

    try {
      const res = await fetch('/api/supabase/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl, supabaseKey })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan konfigurasi');

      if (window.app) window.app.showToast(data.message, 'success');
      await this.loadSupabaseConfig();
      await this.loadAll();
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  async saveSettings() {
    const institutionName = document.getElementById('setting-inst-name').value.trim();
    const institutionAddress = document.getElementById('setting-inst-addr').value.trim();
    const runningText = document.getElementById('setting-running-text').value.trim();
    const dailyResetTime = document.getElementById('setting-reset-time').value;
    const voiceSpeed = parseFloat(document.getElementById('setting-voice-speed').value);
    const voicePitch = parseFloat(document.getElementById('setting-voice-pitch').value);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionName,
          institutionAddress,
          runningText,
          dailyResetTime,
          voiceSpeed,
          voicePitch
        })
      });

      const updated = await res.json();
      this.settings = updated;

      if (window.audioEngine) {
        window.audioEngine.voiceRate = voiceSpeed;
        window.audioEngine.voicePitch = voicePitch;
      }

      if (window.app) window.app.showToast('Pengaturan sistem berhasil disimpan!', 'success');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  testVoice() {
    if (window.audioEngine) {
      const speed = parseFloat(document.getElementById('setting-voice-speed').value);
      const pitch = parseFloat(document.getElementById('setting-voice-pitch').value);
      window.audioEngine.voiceRate = speed;
      window.audioEngine.voicePitch = pitch;
      window.audioEngine.announceCall('A-001', 'Loket 1');
    }
  },

  async triggerManualDailyReset() {
    const ok = confirm("PERINGATAN: Apakah Anda yakin ingin melakukan RESET ANTREAN HARIAN sekarang?\n\nSemua nomor antrean loket hari ini akan dimulai kembali dari nomor 001. Data riwayat transaksi masa lalu tetap tersimpan utuh di database.");
    if (!ok) return;

    try {
      const res = await fetch('/api/admin/reset-daily', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal reset');

      await this.loadAll();
      if (window.app) window.app.showToast(data.message, 'success');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  async triggerFactoryReset() {
    const ok = confirm("PERHATIAN: Apakah Anda yakin ingin mengembalikan seluruh data sistem ke contoh demo bawaan (Factory Seed)?");
    if (!ok) return;

    try {
      const res = await fetch('/api/admin/reset-factory', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal reset factory');

      await this.loadAll();
      if (window.app) window.app.showToast(data.message, 'info');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  bindEvents() {
    // Filter reports button
    const btnFilter = document.getElementById('btn-filter-reports');
    if (btnFilter) {
      btnFilter.onclick = () => this.loadReports();
    }

    // Export CSV button
    const btnCsv = document.getElementById('btn-export-csv');
    if (btnCsv) {
      btnCsv.onclick = () => this.exportCSV();
    }

    // Save Settings button
    const btnSaveSet = document.getElementById('btn-save-settings');
    if (btnSaveSet) {
      btnSaveSet.onclick = () => this.saveSettings();
    }

    // Test Voice button
    const btnTestVoice = document.getElementById('btn-test-voice');
    if (btnTestVoice) {
      btnTestVoice.onclick = () => this.testVoice();
    }

    // Daily Reset button
    const btnDailyReset = document.getElementById('btn-manual-daily-reset');
    if (btnDailyReset) {
      btnDailyReset.onclick = () => this.triggerManualDailyReset();
    }

    // Factory Reset button
    const btnFactoryReset = document.getElementById('btn-factory-reset');
    if (btnFactoryReset) {
      btnFactoryReset.onclick = () => this.triggerFactoryReset();
    }

    // Supabase Test & Save buttons
    const btnTestSupa = document.getElementById('btn-test-supabase');
    if (btnTestSupa) {
      btnTestSupa.onclick = () => this.testSupabase();
    }

    const btnSaveSupa = document.getElementById('btn-save-supabase');
    if (btnSaveSupa) {
      btnSaveSupa.onclick = () => this.saveSupabaseConfig();
    }
  }
};

window.AdminModule = AdminModule;
