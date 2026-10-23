// ==========================================================================
// SIANTRI - Personal Queue Tracking Module (Customer Mobile View)
// ==========================================================================

const TrackingModule = {
  activeTicketCode: null,
  currentData: null,
  pollTimer: null,
  lastAlertAhead: null,

  init() {
    this.bindEvents();

    // Check if ticket code passed in URL (e.g. ?ticket=A-005)
    const urlParams = new URLSearchParams(window.location.search);
    const ticketFromUrl = urlParams.get('ticket');
    if (ticketFromUrl) {
      const input = document.getElementById('tracking-input-code');
      if (input) input.value = ticketFromUrl;
      this.searchTicket(ticketFromUrl);
    }

    // Listen to real-time socket events
    if (window.socketManager) {
      window.socketManager.on('ticket_called', (data) => {
        if (this.currentData && this.currentData.ticket) {
          if (data.ticket && data.ticket.ticketCode === this.currentData.ticket.ticketCode) {
            this.handleCalledAlert(data);
          }
          this.refreshCurrent();
        }
      });

      window.socketManager.on('ticket_completed', () => this.refreshCurrent());
      window.socketManager.on('ticket_skipped', () => this.refreshCurrent());
      window.socketManager.on('ticket_cancelled', () => this.refreshCurrent());
    }
  },

  bindEvents() {
    const searchBtn = document.getElementById('btn-search-tracking');
    const input = document.getElementById('tracking-input-code');

    if (searchBtn && input) {
      searchBtn.onclick = () => {
        const val = input.value.trim();
        if (val) this.searchTicket(val);
      };

      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const val = input.value.trim();
          if (val) this.searchTicket(val);
        }
      };
    }

    const cancelBtn = document.getElementById('btn-cancel-my-ticket');
    if (cancelBtn) {
      cancelBtn.onclick = () => this.confirmCancelTicket();
    }
  },

  async searchTicket(query) {
    if (!query) return;
    this.activeTicketCode = query.toUpperCase();

    try {
      const res = await fetch(`/api/tickets/track/${encodeURIComponent(this.activeTicketCode)}`);
      if (!res.ok) {
        this.renderNotFound();
        return;
      }

      const data = await res.json();
      this.currentData = data;
      this.renderTracking(data);
      this.checkNearTurnAlert(data);
    } catch (e) {
      console.error("Tracking error:", e);
      this.renderNotFound();
    }
  },

  async refreshCurrent() {
    if (!this.activeTicketCode) return;
    try {
      const res = await fetch(`/api/tickets/track/${encodeURIComponent(this.activeTicketCode)}`);
      if (res.ok) {
        const data = await res.json();
        this.currentData = data;
        this.renderTracking(data);
        this.checkNearTurnAlert(data);
      }
    } catch (e) {}
  },

  checkNearTurnAlert(data) {
    if (!data || !data.ticket) return;

    // If waiting and waiting ahead is <= 2
    if (data.ticket.status === 'waiting') {
      if (data.waitingAhead <= 2 && this.lastAlertAhead !== data.waitingAhead) {
        this.lastAlertAhead = data.waitingAhead;
        if (window.audioEngine) {
          window.audioEngine.playAlertBeep();
        }
        if (window.app) {
          window.app.showToast(`Peringatan: Tinggal ${data.waitingAhead} antrean di depan Anda! Mohon bersiap.`, 'warning');
        }
      }
    } else if (data.ticket.status === 'calling' || data.ticket.status === 'serving') {
      // Trigger calling notification
      if (window.audioEngine) {
        window.audioEngine.playAlertBeep();
      }
    }
  },

  handleCalledAlert(data) {
    if (window.audioEngine) {
      window.audioEngine.announceCall(data.ticket.ticketCode, data.counter ? data.counter.name : 'Loket Pelayanan');
    }
  },

  renderNotFound() {
    const container = document.getElementById('tracking-result-card');
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem;">
        <div style="font-size: 3rem; margin-bottom: 0.75rem;">🔍</div>
        <h3 style="font-size: 1.2rem; color: #fff; margin-bottom: 0.5rem;">Nomor Antrean Tidak Ditemukan</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 320px; margin: 0 auto;">
          Pastikan format kode tiket sesuai (contoh: <strong>A-001</strong>). Periksa kembali struk tiket Anda.
        </p>
      </div>
    `;
    container.style.display = 'block';

    const cancelBtn = document.getElementById('btn-cancel-my-ticket');
    if (cancelBtn) cancelBtn.style.display = 'none';
  },

  renderTracking(data) {
    const container = document.getElementById('tracking-result-card');
    if (!container) return;

    const { ticket, service, waitingAhead, position, estimatedWaitMinutes, currentCalling } = data;
    const cancelBtn = document.getElementById('btn-cancel-my-ticket');

    let statusBadgeHtml = '';
    let statusNoticeHtml = '';
    let isCancellable = ticket.status === 'waiting';

    if (ticket.status === 'waiting') {
      statusBadgeHtml = `<span class="badge badge-waiting">⏳ Menunggu Antrean</span>`;
      
      if (waitingAhead <= 2) {
        statusNoticeHtml = `
          <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid var(--amber); border-radius: var(--radius-md); padding: 0.85rem; margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 1.5rem;">🔔</span>
            <div>
              <strong style="color: #fbbf24; font-size: 0.9rem; display: block;">GILIRAN ANDA SEBENTAR LAGI!</strong>
              <span style="font-size: 0.8rem; color: #fde68a;">Harap mendekat ke area loket pelayanan.</span>
            </div>
          </div>
        `;
      }
    } else if (ticket.status === 'calling') {
      statusBadgeHtml = `<span class="badge badge-calling">📢 SEDANG DIPANGGIL</span>`;
      statusNoticeHtml = `
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(6, 78, 59, 0.5)); border: 2px solid #10b981; border-radius: var(--radius-lg); padding: 1.25rem; margin-top: 1rem; text-align: center; animation: pulseGlow 1.5s infinite;">
          <div style="font-size: 1.8rem; margin-bottom: 0.25rem;">🎉</div>
          <strong style="color: #34d399; font-size: 1.15rem; display: block;">GILIRAN ANDA SEKARANG!</strong>
          <p style="font-size: 1rem; color: #fff; margin-top: 0.25rem;">
            Segera menuju ke: <strong style="color: #38bdf8; font-size: 1.3rem;">${ticket.counterName || 'Loket Pelayanan'}</strong>
          </p>
          <span style="font-size: 0.75rem; color: #a7f3d0;">Petugas: ${ticket.staffName || 'Petugas'}</span>
        </div>
      `;
    } else if (ticket.status === 'completed') {
      statusBadgeHtml = `<span class="badge badge-completed">✅ Selesai Dilayani</span>`;
      statusNoticeHtml = `
        <div style="background: rgba(99, 102, 241, 0.15); border: 1px solid var(--indigo); border-radius: var(--radius-md); padding: 0.85rem; margin-top: 1rem; text-align: center;">
          <strong style="color: #818cf8; font-size: 0.9rem;">Pelayanan Anda Telah Selesai</strong>
          <p style="font-size: 0.78rem; color: #cbd5e1; margin-top: 2px;">Terima kasih telah menggunakan sistem antrean kami.</p>
        </div>
      `;
    } else if (ticket.status === 'skipped') {
      statusBadgeHtml = `<span class="badge badge-skipped">⏭️ Nomor Dilewati</span>`;
      statusNoticeHtml = `
        <div style="background: rgba(244, 63, 94, 0.15); border: 1px solid var(--rose); border-radius: var(--radius-md); padding: 0.85rem; margin-top: 1rem; text-align: center;">
          <strong style="color: #fb7185; font-size: 0.9rem;">Nomor Anda Telah Dilewati</strong>
          <p style="font-size: 0.78rem; color: #fecdd3; margin-top: 2px;">Silakan melapor ke meja informasi untuk konfirmasi panggilan ulang.</p>
        </div>
      `;
    } else if (ticket.status === 'cancelled') {
      statusBadgeHtml = `<span class="badge badge-cancelled">❌ Antrean Dibatalkan</span>`;
    }

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Layanan</span>
          <h3 style="font-size: 1.15rem; color: #fff;">${ticket.serviceName}</h3>
          <span style="font-size: 0.8rem; color: var(--text-dim);">Pemohon: ${ticket.customerName || '-'}</span>
        </div>
        <div>${statusBadgeHtml}</div>
      </div>

      <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; text-align: center; margin-bottom: 1rem;">
        <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Nomor Tiket Anda</span>
        <div class="font-mono" style="font-size: 3.5rem; font-weight: 900; color: #fff; line-height: 1.1; margin: 0.3rem 0; letter-spacing: -0.02em;">
          ${ticket.ticketCode}
        </div>
        <span style="font-size: 0.78rem; color: var(--text-dim);">
          Diambil pada: ${new Date(ticket.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
        </span>
      </div>

      ${ticket.status === 'waiting' ? `
        <div class="grid-2" style="margin-bottom: 1rem;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; text-align: center;">
            <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Orang di Depan Anda</span>
            <strong class="font-mono" style="font-size: 1.75rem; color: var(--amber);">${waitingAhead} Orang</strong>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; text-align: center;">
            <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Estimasi Waktu Tunggu</span>
            <strong class="font-mono" style="font-size: 1.75rem; color: var(--cyan);">~${estimatedWaitMinutes} Mnt</strong>
          </div>
        </div>

        <div style="background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: 0.75rem 1rem; font-size: 0.82rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color);">
          <span style="color: var(--text-muted);">Sedang Dipanggil di Layanan Ini:</span>
          <strong class="font-mono" style="color: #38bdf8; font-size: 1rem;">${currentCalling}</strong>
        </div>
      ` : ''}

      ${statusNoticeHtml}
    `;

    container.style.display = 'block';

    if (cancelBtn) {
      cancelBtn.style.display = isCancellable ? 'inline-flex' : 'none';
    }
  },

  confirmCancelTicket() {
    if (!this.currentData || !this.currentData.ticket) return;

    const ticketCode = this.currentData.ticket.ticketCode;
    const ok = confirm(`Apakah Anda yakin ingin MEMBATALKAN nomor antrean ${ticketCode}? Tindakan ini tidak dapat diulang.`);
    if (!ok) return;

    this.executeCancelTicket();
  },

  async executeCancelTicket() {
    if (!this.currentData || !this.currentData.ticket) return;

    try {
      const res = await fetch(`/api/tickets/cancel/${this.currentData.ticket.id}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal membatalkan tiket');

      if (window.app) window.app.showToast('Nomor antrean berhasil dibatalkan', 'info');
      this.refreshCurrent();
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }
};

window.TrackingModule = TrackingModule;
