// ==========================================================================
// SIANTRI - Main Application Controller & View Orchestrator
// ==========================================================================

const App = {
  currentView: 'monitor',
  currentUser: null,
  monitorState: null,

  async init() {
    this.restoreSession();
    this.bindNavigation();
    this.bindAuthEvents();
    this.bindMonitorEvents();

    // Initialize modules
    if (window.KioskModule) await window.KioskModule.init();
    if (window.TrackingModule) window.TrackingModule.init();
    if (window.PetugasModule) await window.PetugasModule.init();
    if (window.AdminModule) await window.AdminModule.init();

    // Listen to real-time monitor state
    if (window.socketManager) {
      window.socketManager.on('monitor_state', (state) => {
        this.monitorState = state;
        this.renderMonitor(state);
      });

      window.socketManager.on('ticket_called', (data) => {
        // Play announcement on monitor view
        if (this.currentView === 'monitor') {
          if (window.audioEngine) {
            window.audioEngine.announceCall(data.ticket.ticketCode, data.counter ? data.counter.name : 'Loket Pelayanan');
          }
        }
      });
    }

    // Initial load of monitor state via HTTP
    try {
      const res = await fetch('/api/monitor');
      const state = await res.json();
      this.monitorState = state;
      this.renderMonitor(state);
    } catch (e) {
      console.warn("Monitor initial fetch failed:", e);
    }

    // Default view: switch based on hash or default to monitor
    const hash = window.location.hash.replace('#', '');
    if (['monitor', 'kiosk', 'tracking', 'petugas', 'admin'].includes(hash)) {
      this.switchView(hash);
    } else {
      this.switchView('monitor');
    }

    this.startDigitalClock();
  },

  startDigitalClock() {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      document.querySelectorAll('.live-time-display').forEach(el => el.textContent = timeStr);
      document.querySelectorAll('.live-date-display').forEach(el => el.textContent = dateStr);
    };

    updateTime();
    setInterval(updateTime, 1000);
  },

  restoreSession() {
    try {
      const saved = localStorage.getItem('siantri_user');
      if (saved) {
        this.currentUser = JSON.parse(saved);
        this.updateAuthUI();
      }
    } catch (e) {}
  },

  bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-view]');
    navItems.forEach(item => {
      item.onclick = (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        this.switchView(view);
      };
    });
  },

  switchView(viewName) {
    // Check permission for petugas & admin
    if (viewName === 'admin') {
      if (!this.currentUser || this.currentUser.role !== 'admin') {
        this.openLoginModal('admin');
        return;
      }
    } else if (viewName === 'petugas') {
      if (!this.currentUser) {
        this.openLoginModal('petugas');
        return;
      }
    }

    this.currentView = viewName;
    window.location.hash = viewName;

    // Update nav active state
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Update view visibility
    document.querySelectorAll('.app-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewName}`);
    });

    // Refresh view specific logic
    if (viewName === 'petugas' && window.PetugasModule) {
      window.PetugasModule.syncUserAssignedCounter();
    } else if (viewName === 'admin' && window.AdminModule) {
      window.AdminModule.loadAll();
    } else if (viewName === 'kiosk' && window.KioskModule) {
      window.KioskModule.renderServices();
    }
  },

  bindAuthEvents() {
    // Login form submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value;
        await this.performLogin(u, p);
      };
    }

    // Quick demo login buttons
    document.querySelectorAll('.btn-quick-login').forEach(btn => {
      btn.onclick = async () => {
        const u = btn.dataset.user;
        const p = btn.dataset.pass;
        await this.performLogin(u, p);
      };
    });

    // Logout button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.onclick = () => this.performLogout();
    }
  },

  openLoginModal(targetRole = '') {
    const modal = document.getElementById('login-modal');
    if (modal) {
      document.getElementById('login-err-msg').style.display = 'none';
      modal.classList.add('active');
    }
  },

  closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('active');
  },

  async performLogin(username, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = document.getElementById('login-err-msg');
        if (errMsg) {
          errMsg.textContent = data.error || 'Login gagal';
          errMsg.style.display = 'block';
        }
        return;
      }

      this.currentUser = data.user;
      localStorage.setItem('siantri_user', JSON.stringify(data.user));
      this.closeLoginModal();
      this.updateAuthUI();
      this.showToast(`Selamat datang, ${data.user.name}!`, 'success');

      // Auto redirect to appropriate view
      if (data.user.role === 'admin') {
        this.switchView('admin');
      } else {
        this.switchView('petugas');
      }
    } catch (e) {
      alert(`Login error: ${e.message}`);
    }
  },

  performLogout() {
    this.currentUser = null;
    localStorage.removeItem('siantri_user');
    this.updateAuthUI();
    this.showToast('Anda telah keluar.', 'info');
    this.switchView('monitor');
  },

  updateAuthUI() {
    const user = this.currentUser;
    const authLogged = document.getElementById('nav-user-logged');
    const authGuest = document.getElementById('nav-user-guest');
    const nameEl = document.getElementById('nav-user-name');
    const roleEl = document.getElementById('nav-user-role');
    const avatarEl = document.getElementById('nav-user-avatar');

    if (user) {
      if (authLogged) authLogged.style.display = 'flex';
      if (authGuest) authGuest.style.display = 'none';
      if (nameEl) nameEl.textContent = user.name;
      if (roleEl) {
        roleEl.textContent = user.role.toUpperCase();
        roleEl.className = `user-role-badge ${user.role === 'admin' ? 'role-admin' : 'role-staff'}`;
      }
      if (avatarEl) avatarEl.textContent = user.name.charAt(0);
    } else {
      if (authLogged) authLogged.style.display = 'none';
      if (authGuest) authGuest.style.display = 'flex';
    }
  },

  bindMonitorEvents() {
    // Sound unlock banner click
    const soundBanner = document.getElementById('monitor-sound-banner');
    if (soundBanner) {
      soundBanner.onclick = () => {
        if (window.audioEngine) {
          window.audioEngine.enableAudio();
          soundBanner.style.display = 'none';
          this.showToast('Audio pengumuman telah diaktifkan!', 'success');
        }
      };
    }
  },

  renderMonitor(state) {
    if (!state) return;

    // 1. Institution branding
    if (state.settings) {
      document.querySelectorAll('.inst-name-display').forEach(el => el.textContent = state.settings.institutionName);
      document.querySelectorAll('.inst-addr-display').forEach(el => el.textContent = state.settings.institutionAddress);
      
      const runningTextEl = document.getElementById('monitor-running-text');
      if (runningTextEl) {
        runningTextEl.textContent = state.settings.runningText || '';
      }
    }

    // 2. Active Call Card
    const heroCard = document.getElementById('monitor-hero-card');
    const heroNumber = document.getElementById('monitor-calling-number');
    const heroService = document.getElementById('monitor-calling-service');
    const heroCounter = document.getElementById('monitor-calling-counter');

    if (state.currentCall) {
      if (heroNumber) heroNumber.textContent = state.currentCall.ticketCode;
      if (heroService) heroService.textContent = state.currentCall.serviceName;
      if (heroCounter) heroCounter.textContent = state.currentCall.counterName;
      if (heroCard) heroCard.classList.add('calling-pulse');
    } else {
      if (heroNumber) heroNumber.textContent = '---';
      if (heroService) heroService.textContent = 'Menunggu Panggilan Berikutnya';
      if (heroCounter) heroCounter.textContent = 'LOKET';
      if (heroCard) heroCard.classList.remove('calling-pulse');
    }

    // 3. History Strip
    const historyGrid = document.getElementById('monitor-history-chips');
    if (historyGrid) {
      const hist = state.history || [];
      if (hist.length === 0) {
        historyGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); font-size: 0.8rem; padding: 0.5rem;">Belum ada riwayat panggilan</div>`;
      } else {
        historyGrid.innerHTML = hist.slice(0, 4).map(h => `
          <div class="history-chip">
            <div class="chip-num">${h.ticketCode}</div>
            <div class="chip-counter">${h.counterName}</div>
          </div>
        `).join('');
      }
    }

    // 4. Counters list
    const countersList = document.getElementById('monitor-counters-list');
    if (countersList && state.counters) {
      countersList.innerHTML = state.counters.map(c => `
        <div class="counter-monitor-card ${c.currentTicket ? 'is-active' : ''}">
          <div class="counter-monitor-info">
            <h3>${c.name}</h3>
            <p>${c.staffName}</p>
          </div>
          <div class="counter-ticket-display">
            <div class="counter-ticket-num">${c.currentTicket ? c.currentTicket.ticketCode : '---'}</div>
            <span class="counter-status-pill ${c.currentTicket ? 'status-serving' : 'status-idle'}">
              ${c.currentTicket ? 'Melayani' : 'Siap'}
            </span>
          </div>
        </div>
      `).join('');
    }
  },

  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
      <span style="font-size: 1.1rem;">${icon}</span>
      <div style="flex: 1;">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideInRight 0.3s ease reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

window.app = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
