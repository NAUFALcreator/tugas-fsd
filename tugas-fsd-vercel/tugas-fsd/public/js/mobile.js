// ==========================================================================
// SIANTRI Mobile - PWA Mobile Application Controller
// ==========================================================================

const MobileApp = {
  activeTab: 'home',
  myTicket: null,
  services: [],
  deferredPrompt: null,
  pollInterval: null,

  async init() {
    this.registerServiceWorker();
    this.restoreMyTicket();
    this.bindNavigation();
    this.bindPwaInstall();
    await this.loadServices();
    await this.loadLiveOverview();

    // Check URL parameters (e.g. ?ticket=A-005)
    const urlParams = new URLSearchParams(window.location.search);
    const paramTicket = urlParams.get('ticket');
    if (paramTicket) {
      await this.setAndTrackTicket(paramTicket);
      this.switchTab('ticket');
    }

    // Socket.io Real-time Event Listeners
    if (window.socketManager) {
      window.socketManager.on('ticket_called', (data) => {
        if (this.myTicket && data.ticket && data.ticket.ticketCode === this.myTicket.ticketCode) {
          this.handleCalledEvent(data);
        }
        this.refreshMyTicket();
        this.loadLiveOverview();
      });

      window.socketManager.on('ticket_completed', () => {
        this.refreshMyTicket();
        this.loadLiveOverview();
      });

      window.socketManager.on('ticket_skipped', () => {
        this.refreshMyTicket();
        this.loadLiveOverview();
      });

      window.socketManager.on('ticket_cancelled', () => {
        this.refreshMyTicket();
        this.loadLiveOverview();
      });

      window.socketManager.on('ticket_created', () => {
        this.refreshMyTicket();
        this.loadLiveOverview();
      });
    }

    // Periodic backup poll every 8 seconds
    this.pollInterval = setInterval(() => {
      if (this.myTicket && this.myTicket.status === 'waiting') {
        this.refreshMyTicket();
      }
    }, 8000);
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }
  },

  bindPwaInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'flex';
    });

    const installBtn = document.getElementById('btn-pwa-install');
    if (installBtn) {
      installBtn.onclick = async () => {
        if (!this.deferredPrompt) return;
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          const banner = document.getElementById('pwa-install-banner');
          if (banner) banner.style.display = 'none';
        }
        this.deferredPrompt = null;
      };
    }
  },

  bindNavigation() {
    const navButtons = document.querySelectorAll('.mobile-nav-btn');
    navButtons.forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      };
    });
  },

  switchTab(tabName) {
    this.activeTab = tabName;

    // Update nav active states
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update pages visibility
    document.querySelectorAll('.mobile-tab-page').forEach(page => {
      page.classList.toggle('active', page.id === `tab-${tabName}`);
    });

    if (tabName === 'ticket') {
      this.refreshMyTicket();
    } else if (tabName === 'history') {
      this.renderHistory();
    } else if (tabName === 'take') {
      this.renderTakeServices();
    }
  },

  restoreMyTicket() {
    try {
      const saved = localStorage.getItem('siantri_my_ticket');
      if (saved) {
        this.myTicket = JSON.parse(saved);
        this.updateNavBadge(true);
      }
    } catch (e) {}
  },

  updateNavBadge(hasActive) {
    const badge = document.getElementById('nav-ticket-badge');
    if (badge) {
      badge.style.display = (hasActive && this.myTicket && this.myTicket.status === 'waiting') ? 'block' : 'none';
    }
  },

  async loadServices() {
    try {
      const res = await fetch('/api/services');
      this.services = await res.json();
      this.renderTakeServices();
    } catch (e) {
      console.error("Load services error:", e);
    }
  },

  async loadLiveOverview() {
    try {
      const res = await fetch('/api/monitor');
      const data = await res.json();

      const callEl = document.getElementById('home-live-call');
      const counterEl = document.getElementById('home-live-counter');
      const totalEl = document.getElementById('home-stat-total');
      const waitingEl = document.getElementById('home-stat-waiting');

      if (callEl) callEl.textContent = data.currentCall ? data.currentCall.ticketCode : '---';
      if (counterEl) counterEl.textContent = data.currentCall ? data.currentCall.counterName : 'LOKET';
      if (totalEl) totalEl.textContent = data.stats.total;
      if (waitingEl) waitingEl.textContent = data.stats.waiting;
    } catch (e) {}
  },

  renderTakeServices() {
    const list = document.getElementById('mobile-services-list');
    if (!list) return;

    list.innerHTML = this.services.filter(s => s.active !== false).map(s => `
      <div class="mobile-action-card" onclick="MobileApp.openTakeForm('${s.id}')" style="border-left: 5px solid ${s.color || '#4f46e5'};">
        <div class="mobile-action-icon" style="background: ${s.color || '#4f46e5'}22; color: ${s.color || '#4f46e5'}; font-weight: 800; font-family: monospace;">
          ${s.code}
        </div>
        <div style="flex: 1;">
          <h4 style="font-size: 0.95rem; color: #fff; margin-bottom: 2px;">${s.name}</h4>
          <p style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.3;">${s.description || 'Pelayanan umum'}</p>
          <div style="display: flex; gap: 0.75rem; margin-top: 6px; font-size: 0.72rem; color: var(--text-dim);">
            <span>⏱️ ~${s.avgDuration} mnt</span>
            <span style="color: var(--cyan);">Pilih Layanan →</span>
          </div>
        </div>
      </div>
    `).join('');
  },

  openTakeForm(serviceId) {
    const s = this.services.find(x => x.id === serviceId);
    if (!s) return;

    this.selectedService = s;
    document.getElementById('mobile-form-srv-title').textContent = s.name;
    document.getElementById('mobile-form-srv-badge').textContent = `[${s.code}]`;
    document.getElementById('mobile-form-srv-badge').style.background = s.color || 'var(--primary)';
    
    document.getElementById('mobile-take-modal').classList.add('active');
  },

  closeTakeForm() {
    document.getElementById('mobile-take-modal').classList.remove('active');
  },

  async submitTakeTicket() {
    if (!this.selectedService) return;

    const name = document.getElementById('mobile-input-name').value.trim();
    const phone = document.getElementById('mobile-input-phone').value.trim();

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: this.selectedService.id,
          customerName: name || 'Pelanggan Mobile',
          customerPhone: phone
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mendaftar antrean');

      this.closeTakeForm();
      this.myTicket = data.ticket;
      localStorage.setItem('siantri_my_ticket', JSON.stringify(data.ticket));
      this.saveToHistory(data.ticket);
      this.updateNavBadge(true);

      // Switch to ticket view
      this.switchTab('ticket');
      this.renderTicketPass(data);
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  async setAndTrackTicket(ticketCode) {
    try {
      const res = await fetch(`/api/tickets/track/${encodeURIComponent(ticketCode)}`);
      if (res.ok) {
        const data = await res.json();
        this.myTicket = data.ticket;
        localStorage.setItem('siantri_my_ticket', JSON.stringify(data.ticket));
        this.saveToHistory(data.ticket);
        this.renderTicketPass(data);
        this.updateNavBadge(true);
      }
    } catch (e) {}
  },

  async refreshMyTicket() {
    if (!this.myTicket) {
      this.renderEmptyTicket();
      return;
    }

    try {
      const res = await fetch(`/api/tickets/track/${encodeURIComponent(this.myTicket.ticketCode)}`);
      if (!res.ok) {
        this.renderEmptyTicket();
        return;
      }
      const data = await res.json();
      this.myTicket = data.ticket;
      localStorage.setItem('siantri_my_ticket', JSON.stringify(data.ticket));
      this.renderTicketPass(data);
      this.checkAlerts(data);
    } catch (e) {
      // offline fallback
      this.renderTicketPass({ ticket: this.myTicket, waitingAhead: 0, estimatedWaitMinutes: 0 });
    }
  },

  checkAlerts(data) {
    const { ticket, waitingAhead } = data;
    if (ticket.status === 'waiting' && waitingAhead <= 2) {
      // Vibrate mobile device
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      if (window.audioEngine) {
        window.audioEngine.playAlertBeep();
      }
    }
  },

  handleCalledEvent(data) {
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500]);
    }
    if (window.audioEngine) {
      window.audioEngine.announceCall(data.ticket.ticketCode, data.counter ? data.counter.name : 'Loket Pelayanan');
    }
  },

  renderEmptyTicket() {
    const container = document.getElementById('mobile-ticket-container');
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem;">
        <div style="font-size: 3.5rem; margin-bottom: 0.75rem;">🎫</div>
        <h3 style="font-size: 1.25rem; color: #fff; margin-bottom: 0.4rem;">Belum Ada Tiket Aktif</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 280px; margin: 0 auto 1.5rem auto;">
          Anda belum mengambil nomor antrean hari ini. Silakan pilih layanan untuk mendaftar.
        </p>
        <button class="btn btn-primary" onclick="MobileApp.switchTab('take')">
          ➕ Ambil Nomor Antrean
        </button>
      </div>
    `;
  },

  renderTicketPass(data) {
    const container = document.getElementById('mobile-ticket-container');
    if (!container) return;

    const { ticket, waitingAhead, estimatedWaitMinutes } = data;

    let statusPill = '';
    let alertBanner = '';

    if (ticket.status === 'waiting') {
      statusPill = `<span class="badge badge-waiting">⏳ Menunggu</span>`;
      if (waitingAhead <= 2) {
        alertBanner = `
          <div class="alert-near-turn">
            <span style="font-size: 1.5rem;">🔔</span>
            <div>
              <strong style="color: #fbbf24; font-size: 0.88rem; display: block;">Giliran Anda Segera Tiba!</strong>
              <span style="font-size: 0.75rem; color: #fef08a;">Tinggal ${waitingAhead} antrean di depan Anda. Mohon mendekat ke loket.</span>
            </div>
          </div>
        `;
      }
    } else if (ticket.status === 'calling') {
      statusPill = `<span class="badge badge-calling">📢 DIPANGGIL</span>`;
      alertBanner = `
        <div class="alert-called-turn">
          <div style="font-size: 2rem; margin-bottom: 0.25rem;">🎉</div>
          <strong style="color: #34d399; font-size: 1.25rem; display: block;">GILIRAN ANDA SEKARANG!</strong>
          <p style="font-size: 1.05rem; color: #fff; margin: 0.4rem 0;">
            Segera menuju ke: <strong style="color: #38bdf8; font-size: 1.4rem;">${ticket.counterName || 'Loket Pelayanan'}</strong>
          </p>
          <span style="font-size: 0.8rem; color: #a7f3d0;">Petugas: ${ticket.staffName || 'Petugas'}</span>
        </div>
      `;
    } else if (ticket.status === 'completed') {
      statusPill = `<span class="badge badge-completed">✅ Selesai</span>`;
    } else if (ticket.status === 'cancelled') {
      statusPill = `<span class="badge badge-cancelled">❌ Dibatalkan</span>`;
    } else if (ticket.status === 'skipped') {
      statusPill = `<span class="badge badge-skipped">⏭️ Dilewati</span>`;
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/mobile.html?ticket=' + ticket.ticketCode)}`;

    container.innerHTML = `
      <div class="ticket-pass-card">
        <div class="ticket-pass-header">
          <div>
            <span style="font-size: 0.7rem; color: #818cf8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">DIGITAL QUEUE PASS</span>
            <h3 style="font-size: 1.05rem; color: #fff;">${ticket.serviceName}</h3>
          </div>
          <div>${statusPill}</div>
        </div>

        <div style="text-align: center; margin: 0.5rem 0;">
          <span style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase;">Nomor Antrean Anda</span>
          <div class="ticket-pass-code">${ticket.ticketCode}</div>
          <span style="font-size: 0.78rem; color: var(--text-muted);">${ticket.customerName || '-'}</span>
        </div>

        ${ticket.status === 'waiting' ? `
          <div class="grid-2" style="margin: 1.25rem 0 0.5rem 0;">
            <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 0.75rem; text-align: center; border: 1px solid var(--border-color);">
              <span style="font-size: 0.7rem; color: var(--text-dim); display: block;">Di Depan Anda</span>
              <strong class="font-mono" style="font-size: 1.6rem; color: var(--amber);">${waitingAhead} Orang</strong>
            </div>
            <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 0.75rem; text-align: center; border: 1px solid var(--border-color);">
              <span style="font-size: 0.7rem; color: var(--text-dim); display: block;">Estimasi Waktu</span>
              <strong class="font-mono" style="font-size: 1.6rem; color: var(--cyan);">~${estimatedWaitMinutes} Mnt</strong>
            </div>
          </div>
        ` : ''}

        ${alertBanner}

        <!-- Barcode / QR Simulation -->
        <div style="text-align: center; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.15);">
          <img src="${qrUrl}" alt="QR" style="width: 100px; height: 100px; border-radius: 8px; border: 1px solid var(--border-color);" />
          <span style="font-size: 0.7rem; color: var(--text-dim); display: block; margin-top: 4px;">Tunjukkan QR ini ke petugas loket saat dipanggil</span>
        </div>
      </div>

      <!-- Actions -->
      <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
        <button class="btn btn-outline" style="flex: 1; font-size: 0.8rem;" onclick="MobileApp.shareTicket()">
          📤 Bagikan Tiket
        </button>
        ${ticket.status === 'waiting' ? `
          <button class="btn btn-outline" style="flex: 1; font-size: 0.8rem; color: #fb7185; border-color: rgba(244,63,94,0.3);" onclick="MobileApp.cancelMyTicket()">
            ❌ Batalkan
          </button>
        ` : ''}
      </div>
    `;
  },

  shareTicket() {
    if (!this.myTicket) return;
    const shareText = `Nomor Antrean SIANTRI: ${this.myTicket.ticketCode} (${this.myTicket.serviceName}). Pantau langsung: ${window.location.origin}/mobile.html?ticket=${this.myTicket.ticketCode}`;

    if (navigator.share) {
      navigator.share({
        title: 'Tiket Antrean SIANTRI',
        text: shareText,
        url: `${window.location.origin}/mobile.html?ticket=${this.myTicket.ticketCode}`
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Tautan tiket disalin ke clipboard!');
    }
  },

  async cancelMyTicket() {
    if (!this.myTicket) return;
    const ok = confirm(`Batalkan nomor antrean ${this.myTicket.ticketCode}?`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/tickets/cancel/${this.myTicket.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal membatalkan tiket');

      this.myTicket.status = 'cancelled';
      localStorage.setItem('siantri_my_ticket', JSON.stringify(this.myTicket));
      this.updateNavBadge(false);
      this.refreshMyTicket();
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  },

  saveToHistory(ticket) {
    try {
      const history = JSON.parse(localStorage.getItem('siantri_history') || '[]');
      const filtered = history.filter(h => h.id !== ticket.id);
      filtered.unshift({
        id: ticket.id,
        ticketCode: ticket.ticketCode,
        serviceName: ticket.serviceName,
        date: ticket.date || new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        status: ticket.status
      });
      localStorage.setItem('siantri_history', JSON.stringify(filtered.slice(0, 15)));
    } catch (e) {}
  },

  renderHistory() {
    const list = document.getElementById('mobile-history-list');
    if (!list) return;

    try {
      const history = JSON.parse(localStorage.getItem('siantri_history') || '[]');
      if (history.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 3rem 1rem; color: var(--text-dim); font-size: 0.85rem;">Belum ada riwayat tiket pada perangkat ini</div>`;
        return;
      }

      list.innerHTML = history.map(h => `
        <div class="mobile-action-card" onclick="MobileApp.setAndTrackTicket('${h.ticketCode}'); MobileApp.switchTab('ticket');">
          <div class="font-mono" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem;">
            ${h.ticketCode}
          </div>
          <div style="flex: 1;">
            <h4 style="font-size: 0.92rem; color: #fff;">${h.serviceName}</h4>
            <span style="font-size: 0.75rem; color: var(--text-dim);">${h.date} • ${h.time}</span>
          </div>
          <span style="font-size: 0.75rem; color: var(--cyan);">Buka →</span>
        </div>
      `).join('');
    } catch (e) {}
  }
};

window.MobileApp = MobileApp;

document.addEventListener('DOMContentLoaded', () => {
  MobileApp.init();
});
