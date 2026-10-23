// ==========================================================================
// SIANTRI - Staff Calling Interface Module (Panel Petugas Loket)
// ==========================================================================

const PetugasModule = {
  currentCounterId: null,
  counters: [],
  services: [],
  activeTicket: null,
  timerInterval: null,
  timerSeconds: 0,

  async init() {
    await this.loadData();
    this.bindEvents();

    // Listen to real-time socket events
    if (window.socketManager) {
      window.socketManager.on('ticket_called', (data) => {
        if (data.counter && data.counter.id === this.currentCounterId) {
          this.activeTicket = data.ticket;
          this.renderActiveTicket();
          this.startServingTimer();
        }
        this.loadWaitingQueue();
      });

      window.socketManager.on('ticket_completed', () => {
        this.loadWaitingQueue();
        this.loadTodayCounterHistory();
      });

      window.socketManager.on('ticket_skipped', () => {
        this.loadWaitingQueue();
        this.loadTodayCounterHistory();
      });

      window.socketManager.on('ticket_created', () => {
        this.loadWaitingQueue();
      });

      window.socketManager.on('ticket_cancelled', () => {
        this.loadWaitingQueue();
      });
    }
  },

  async loadData() {
    try {
      const [resC, resS] = await Promise.all([
        fetch('/api/counters'),
        fetch('/api/services')
      ]);
      this.counters = await resC.json();
      this.services = await resS.json();

      this.populateCounterSelector();
      this.syncUserAssignedCounter();
    } catch (e) {
      console.error("Failed to load staff counter data:", e);
    }
  },

  populateCounterSelector() {
    const sel = document.getElementById('petugas-counter-select');
    if (!sel) return;

    sel.innerHTML = this.counters.map(c => `
      <option value="${c.id}">${c.name} (${c.serviceIds.map(sid => {
        const s = this.services.find(x => x.id === sid);
        return s ? s.code : '';
      }).filter(Boolean).join(', ')})</option>
    `).join('');

    sel.onchange = (e) => {
      this.switchCounter(e.target.value);
    };
  },

  syncUserAssignedCounter() {
    const user = window.app ? window.app.currentUser : null;
    let targetCounterId = null;

    if (user && user.assignedCounterId) {
      targetCounterId = user.assignedCounterId;
    } else if (this.counters.length > 0) {
      targetCounterId = this.counters[0].id;
    }

    if (targetCounterId) {
      const sel = document.getElementById('petugas-counter-select');
      if (sel) sel.value = targetCounterId;
      this.switchCounter(targetCounterId);
    }
  },

  switchCounter(counterId) {
    this.currentCounterId = counterId;
    const cnt = this.counters.find(c => c.id === counterId);
    if (!cnt) return;

    const nameEl = document.getElementById('petugas-current-counter-name');
    const badgeEl = document.getElementById('petugas-assigned-services-badge');
    
    if (nameEl) nameEl.textContent = cnt.name;
    if (badgeEl) {
      const srvNames = cnt.serviceIds.map(sid => {
        const s = this.services.find(x => x.id === sid);
        return s ? s.name : '';
      }).filter(Boolean);
      badgeEl.textContent = srvNames.join(', ') || 'Semua Layanan';
    }

    // Check if counter has active ticket
    this.activeTicket = cnt.currentTicket || null;
    this.renderActiveTicket();

    if (this.activeTicket && this.activeTicket.callTime) {
      const elapsedSec = Math.floor((new Date() - new Date(this.activeTicket.callTime)) / 1000);
      this.timerSeconds = elapsedSec > 0 ? elapsedSec : 0;
      this.startServingTimer();
    } else {
      this.stopServingTimer();
    }

    this.loadWaitingQueue();
    this.loadTodayCounterHistory();
  },

  startServingTimer() {
    this.stopServingTimer();
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      this.updateTimerDisplay();
    }, 1000);
  },

  stopServingTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerSeconds = 0;
    this.updateTimerDisplay();
  },

  updateTimerDisplay() {
    const el = document.getElementById('petugas-serving-timer');
    if (!el) return;
    const m = String(Math.floor(this.timerSeconds / 60)).padStart(2, '0');
    const s = String(this.timerSeconds % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
  },

  renderActiveTicket() {
    const emptyState = document.getElementById('petugas-empty-state');
    const activeState = document.getElementById('petugas-active-state');
    const codeEl = document.getElementById('petugas-active-code');
    const srvEl = document.getElementById('petugas-active-service');
    const custEl = document.getElementById('petugas-active-customer');
    const phoneEl = document.getElementById('petugas-active-phone');

    // Controls
    const btnRecall = document.getElementById('btn-call-recall');
    const btnSkip = document.getElementById('btn-call-skip');
    const btnComplete = document.getElementById('btn-call-complete');

    if (this.activeTicket) {
      if (emptyState) emptyState.style.display = 'none';
      if (activeState) activeState.style.display = 'block';

      if (codeEl) codeEl.textContent = this.activeTicket.ticketCode;
      if (srvEl) srvEl.textContent = this.activeTicket.serviceName;
      if (custEl) custEl.textContent = this.activeTicket.customerName || 'Pelanggan Umum';
      if (phoneEl) phoneEl.textContent = this.activeTicket.customerPhone ? `📞 ${this.activeTicket.customerPhone}` : 'No Telp: -';

      if (btnRecall) btnRecall.disabled = false;
      if (btnSkip) btnSkip.disabled = false;
      if (btnComplete) btnComplete.disabled = false;
    } else {
      if (emptyState) emptyState.style.display = 'block';
      if (activeState) activeState.style.display = 'none';

      if (btnRecall) btnRecall.disabled = true;
      if (btnSkip) btnSkip.disabled = true;
      if (btnComplete) btnComplete.disabled = true;
      this.stopServingTimer();
    }
  },

  async loadWaitingQueue() {
    const cnt = this.counters.find(c => c.id === this.currentCounterId);
    if (!cnt) return;

    try {
      const res = await fetch('/api/tickets?status=waiting');
      const allWaiting = await res.json();

      // Filter by counter's services
      const eligible = allWaiting.filter(t => cnt.serviceIds.includes(t.serviceId));

      const countBadge = document.getElementById('petugas-waiting-count');
      if (countBadge) countBadge.textContent = `${eligible.length} Menunggu`;

      const listEl = document.getElementById('petugas-waiting-list');
      if (!listEl) return;

      if (eligible.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--text-dim);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
            <p style="font-size: 0.85rem;">Tidak ada antrean menunggu untuk loket ini</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = eligible.map((t, idx) => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span class="font-mono" style="background: rgba(79, 70, 229, 0.2); color: #818cf8; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem;">
              #${idx + 1}
            </span>
            <div>
              <strong class="font-mono" style="color: #fff; font-size: 1.1rem; display: block;">${t.ticketCode}</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${t.customerName || t.serviceName}</span>
            </div>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-dim);">
            ${new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      `).join('');
    } catch (e) {
      console.error("Error loading waiting queue:", e);
    }
  },

  async loadTodayCounterHistory() {
    if (!this.currentCounterId) return;
    const today = new Date().toISOString().split('T')[0];

    try {
      const res = await fetch(`/api/tickets?counterId=${this.currentCounterId}&date=${today}`);
      const tickets = await res.json();

      const served = tickets.filter(t => t.status === 'completed');
      const skipped = tickets.filter(t => t.status === 'skipped');

      const countEl = document.getElementById('petugas-today-served-count');
      if (countEl) countEl.textContent = `${served.length} Dilayani`;

      const historyList = document.getElementById('petugas-counter-history-table');
      if (!historyList) return;

      if (tickets.length === 0) {
        historyList.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">Belum ada riwayat panggilan hari ini</td></tr>`;
        return;
      }

      historyList.innerHTML = tickets.slice(0, 8).map(t => `
        <tr>
          <td><strong class="font-mono" style="color: #fff;">${t.ticketCode}</strong></td>
          <td><span style="font-size: 0.8rem; color: var(--text-muted);">${t.serviceName}</span></td>
          <td><span class="badge ${t.status === 'completed' ? 'badge-completed' : t.status === 'skipped' ? 'badge-skipped' : 'badge-calling'}">${t.status}</span></td>
          <td style="font-size: 0.78rem; color: var(--text-dim);">${t.callTime ? new Date(t.callTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.error("Error loading history:", e);
    }
  },

  bindEvents() {
    // 1. Panggil Berikutnya
    const btnNext = document.getElementById('btn-call-next');
    if (btnNext) {
      btnNext.onclick = () => this.callNext();
    }

    // 2. Panggil Ulang
    const btnRecall = document.getElementById('btn-call-recall');
    if (btnRecall) {
      btnRecall.onclick = () => this.recallCurrent();
    }

    // 3. Lewati (Skip)
    const btnSkip = document.getElementById('btn-call-skip');
    if (btnSkip) {
      btnSkip.onclick = () => this.skipCurrent();
    }

    // 4. Selesai
    const btnComplete = document.getElementById('btn-call-complete');
    if (btnComplete) {
      btnComplete.onclick = () => this.completeCurrent();
    }
  },

  async callNext() {
    if (!this.currentCounterId) {
      alert("Pilih loket terlebih dahulu!");
      return;
    }

    const staffId = window.app?.currentUser?.id || null;

    try {
      const res = await fetch('/api/calling/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterId: this.currentCounterId,
          staffId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (window.app) window.app.showToast(data.message || 'Tidak ada antrean yang menunggu', 'warning');
        return;
      }

      this.activeTicket = data.ticket;
      this.renderActiveTicket();
      this.timerSeconds = 0;
      this.startServingTimer();

      if (window.app) window.app.showToast(`Memanggil ${data.ticket.ticketCode}...`, 'success');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  async recallCurrent() {
    if (!this.currentCounterId || !this.activeTicket) return;

    try {
      const res = await fetch('/api/calling/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId: this.currentCounterId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal panggil ulang');

      if (window.app) window.app.showToast(`Memanggil ulang ${this.activeTicket.ticketCode}...`, 'info');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  async skipCurrent() {
    if (!this.currentCounterId || !this.activeTicket) return;

    const ok = confirm(`Lewati nomor antrean ${this.activeTicket.ticketCode}?`);
    if (!ok) return;

    try {
      const res = await fetch('/api/calling/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterId: this.currentCounterId,
          reason: 'Pelanggan tidak hadir saat dipanggil'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal lewati');

      this.activeTicket = null;
      this.renderActiveTicket();
      this.stopServingTimer();

      if (window.app) window.app.showToast('Nomor antrean berhasil dilewati', 'warning');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  async completeCurrent() {
    if (!this.currentCounterId || !this.activeTicket) return;

    try {
      const res = await fetch('/api/calling/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterId: this.currentCounterId,
          notes: 'Pelayanan selesai'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyelesaikan');

      this.activeTicket = null;
      this.renderActiveTicket();
      this.stopServingTimer();

      if (window.app) window.app.showToast('Pelayanan berhasil diselesaikan!', 'success');
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }
};

window.PetugasModule = PetugasModule;
