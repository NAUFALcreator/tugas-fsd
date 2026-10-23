// ==========================================================================
// SIANTRI - Kiosk Registration Module
// ==========================================================================

const KioskModule = {
  selectedService: null,
  services: [],

  async init() {
    await this.loadServices();
    this.bindEvents();

    // Listen to real-time updates to keep queue counts fresh
    if (window.socketManager) {
      window.socketManager.on('ticket_created', () => this.refreshQueueCounts());
      window.socketManager.on('ticket_called', () => this.refreshQueueCounts());
      window.socketManager.on('ticket_completed', () => this.refreshQueueCounts());
      window.socketManager.on('ticket_skipped', () => this.refreshQueueCounts());
      window.socketManager.on('ticket_cancelled', () => this.refreshQueueCounts());
      window.socketManager.on('services_updated', (services) => {
        this.services = services;
        this.renderServices();
      });
    }
  },

  async loadServices() {
    try {
      const res = await fetch('/api/services');
      this.services = await res.json();
      this.renderServices();
    } catch (e) {
      console.error("Failed to load services for kiosk:", e);
    }
  },

  async refreshQueueCounts() {
    try {
      const res = await fetch('/api/tickets?status=waiting');
      const waitingTickets = await res.json();

      this.services.forEach(srv => {
        const count = waitingTickets.filter(t => t.serviceId === srv.id).length;
        const countEl = document.getElementById(`kiosk-count-${srv.id}`);
        const waitEl = document.getElementById(`kiosk-wait-${srv.id}`);
        if (countEl) countEl.textContent = `${count} Antrean`;
        if (waitEl) waitEl.textContent = `~${count * srv.avgDuration} mnt`;
      });
    } catch (e) {
      // ignore
    }
  },

  async renderServices() {
    const grid = document.getElementById('kiosk-services-grid');
    if (!grid) return;

    // Fetch current waiting counts
    let waitingTickets = [];
    try {
      const res = await fetch('/api/tickets?status=waiting');
      waitingTickets = await res.json();
    } catch (e) {}

    const activeServices = this.services.filter(s => s.active !== false);

    if (activeServices.length === 0) {
      grid.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
        <p style="color: var(--text-muted);">Belum ada layanan aktif saat ini.</p>
      </div>`;
      return;
    }

    grid.innerHTML = activeServices.map(srv => {
      const count = waitingTickets.filter(t => t.serviceId === srv.id).length;
      const estWait = count * srv.avgDuration;

      return `
        <div class="card kiosk-service-card" onclick="KioskModule.selectService('${srv.id}')" style="cursor: pointer; border-left: 6px solid ${srv.color || 'var(--primary)'}; position: relative; overflow: hidden;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span class="font-mono" style="background: ${srv.color || 'var(--primary)'}; color: #fff; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 800; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                ${srv.code}
              </span>
              <div>
                <h3 style="font-size: 1.15rem; color: #fff;">${srv.name}</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Durasi est: ~${srv.avgDuration} menit/orang</span>
              </div>
            </div>
            <span class="badge" style="background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid var(--border-color);">
              Pilih Layanan →
            </span>
          </div>

          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem; line-height: 1.4;">
            ${srv.description || 'Layanan loket terpadu'}
          </p>

          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.25); padding: 0.65rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="color: var(--amber);">⏳</span>
              <span style="font-size: 0.82rem; color: var(--text-muted);">Menunggu:</span>
              <strong id="kiosk-count-${srv.id}" style="color: #fff; font-size: 0.85rem;">${count} Antrean</strong>
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span style="font-size: 0.82rem; color: var(--text-dim);">Est. Tunggu:</span>
              <strong id="kiosk-wait-${srv.id}" style="color: var(--cyan); font-size: 0.85rem;">~${estWait} mnt</strong>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  selectService(serviceId) {
    this.selectedService = this.services.find(s => s.id === serviceId);
    if (!this.selectedService) return;

    const modal = document.getElementById('kiosk-modal');
    const title = document.getElementById('kiosk-modal-title');
    const badge = document.getElementById('kiosk-modal-badge');
    
    if (title) title.textContent = this.selectedService.name;
    if (badge) {
      badge.textContent = `Kode [${this.selectedService.code}]`;
      badge.style.background = this.selectedService.color || 'var(--primary)';
    }

    // Reset inputs
    const nameInput = document.getElementById('kiosk-customer-name');
    const phoneInput = document.getElementById('kiosk-customer-phone');
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';

    if (modal) modal.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('kiosk-modal');
    if (modal) modal.classList.remove('active');
    this.selectedService = null;
  },

  bindEvents() {
    const confirmBtn = document.getElementById('btn-confirm-kiosk');
    if (confirmBtn) {
      confirmBtn.onclick = () => this.submitTicket();
    }
  },

  async submitTicket() {
    if (!this.selectedService) return;

    const nameInput = document.getElementById('kiosk-customer-name');
    const phoneInput = document.getElementById('kiosk-customer-phone');

    const customerName = nameInput ? nameInput.value.trim() : '';
    const customerPhone = phoneInput ? phoneInput.value.trim() : '';

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: this.selectedService.id,
          customerName,
          customerPhone
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat tiket');

      this.closeModal();
      this.showTicketReceipt(data);
      if (window.app) window.app.showToast('Tiket antrean berhasil dicetak!', 'success');
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  },

  showTicketReceipt(result) {
    const { ticket, position, waitingAhead, estimatedWaitMinutes } = result;
    const receiptModal = document.getElementById('ticket-receipt-modal');
    const container = document.getElementById('ticket-receipt-container');
    if (!receiptModal || !container) return;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/tracking.html?ticket=' + ticket.ticketCode)}`;

    container.innerHTML = `
      <div class="ticket-print-card">
        <div class="ticket-print-header">
          <h2>KANTOR PELAYANAN TERPADU</h2>
          <p>Sistem Antrean Elektronik (SIANTRI)</p>
        </div>

        <div class="ticket-print-divider"></div>

        <span class="ticket-service-badge" style="background: ${this.selectedService?.color || '#3b82f6'}; color: #fff;">
          ${ticket.serviceName}
        </span>

        <div style="font-size: 0.8rem; color: #6b7280; margin-top: 4px;">NOMOR ANTREAN ANDA</div>
        <div class="ticket-large-num">${ticket.ticketCode}</div>

        <div class="ticket-print-divider"></div>

        <table class="ticket-info-table">
          <tr>
            <td>Nama Pemohon</td>
            <td class="val">${ticket.customerName || '-'}</td>
          </tr>
          <tr>
            <td>Tanggal & Waktu</td>
            <td class="val">${new Date(ticket.createdAt).toLocaleDateString('id-ID')} ${new Date(ticket.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
          </tr>
          <tr>
            <td>Antrean di Depan</td>
            <td class="val">${waitingAhead} orang</td>
          </tr>
          <tr>
            <td>Estimasi Giliran</td>
            <td class="val" style="color: #2563eb;">~${estimatedWaitMinutes} Menit</td>
          </tr>
        </table>

        <div class="ticket-qr-area">
          <img src="${qrUrl}" alt="QR Tracking" class="ticket-qr-img" onerror="this.style.display='none'" />
          <span class="ticket-qr-hint">Scan QR untuk pantau antrean langsung dari HP Anda</span>
        </div>

        <div class="ticket-print-divider"></div>

        <div class="ticket-print-footer">
          <p>Silakan duduk di ruang tunggu.</p>
          <p>Perhatikan nomor antrean Anda di Layar Monitor.</p>
          <p style="font-size: 0.65rem; margin-top: 4px;">Terima kasih atas kunjungan Anda.</p>
        </div>
      </div>
    `;

    // Setup action buttons in modal footer
    const printBtn = document.getElementById('btn-print-ticket');
    if (printBtn) {
      printBtn.onclick = () => window.print();
    }

    const trackBtn = document.getElementById('btn-open-tracking');
    if (trackBtn) {
      trackBtn.onclick = () => {
        receiptModal.classList.remove('active');
        if (window.app) {
          window.app.switchView('tracking');
          if (window.TrackingModule) {
            window.TrackingModule.searchTicket(ticket.ticketCode);
          }
        }
      };
    }

    receiptModal.classList.add('active');
  },

  closeReceiptModal() {
    const receiptModal = document.getElementById('ticket-receipt-modal');
    if (receiptModal) receiptModal.classList.remove('active');
  }
};

window.KioskModule = KioskModule;
