// ==========================================================================
// SIANTRI - Realtime Socket.IO Client Helper
// ==========================================================================

class SocketManager {
  constructor() {
    this.socket = null;
    this.callbacks = {};
    this.connected = false;
    this.init();
  }

  init() {
    // Tanpa Socket.IO (mis. di Vercel) -> pakai polling HTTP
    if (typeof io === 'undefined') {
      this.initPolling();
      return;
    }
    // Connect to same origin
    this.socket = io();

    this.socket.on('connect', () => {
      this.connected = true;
      console.log("[SIANTRI] Connected to Real-time WebSocket server:", this.socket.id);
      this.trigger('connect', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log("[SIANTRI] Disconnected from WebSocket server");
      this.trigger('disconnect');
    });

    // Universal state broadcast
    this.socket.on('monitor_state', (state) => {
      this.trigger('monitor_state', state);
    });

    this.socket.on('ticket_called', (data) => {
      console.log("[SIANTRI] Ticket called event:", data);
      this.trigger('ticket_called', data);
    });

    this.socket.on('ticket_created', (ticket) => {
      this.trigger('ticket_created', ticket);
    });

    this.socket.on('ticket_skipped', (ticket) => {
      this.trigger('ticket_skipped', ticket);
    });

    this.socket.on('ticket_completed', (ticket) => {
      this.trigger('ticket_completed', ticket);
    });

    this.socket.on('ticket_cancelled', (ticket) => {
      this.trigger('ticket_cancelled', ticket);
    });

    this.socket.on('daily_reset', (info) => {
      this.trigger('daily_reset', info);
    });

    this.socket.on('settings_updated', (settings) => {
      this.trigger('settings_updated', settings);
    });

    this.socket.on('services_updated', (services) => {
      this.trigger('services_updated', services);
    });

    this.socket.on('counters_updated', (counters) => {
      this.trigger('counters_updated', counters);
    });

    this.socket.on('factory_reset', () => {
      this.trigger('factory_reset');
    });
  }

  initPolling() {
    console.log("[SIANTRI] Socket.IO tidak tersedia, memakai polling HTTP");
    this.connected = true;
    this.prev = null;
    const tick = async () => {
      try {
        const res = await fetch('/api/monitor', { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status);
        const state = await res.json();
        const prev = this.prev;
        this.prev = state;
        this.trigger('monitor_state', state);
        if (prev) {
          const prevCalls = {};
          (prev.counters || []).forEach(c => {
            if (c.currentTicket) prevCalls[c.id] = c.currentTicket.ticketCode + '|' + c.currentTicket.callTime;
          });
          (state.counters || []).forEach(c => {
            const t = c.currentTicket;
            if (t && (t.status === 'calling' || t.status === 'serving') &&
                prevCalls[c.id] !== t.ticketCode + '|' + t.callTime) {
              this.trigger('ticket_called', { ticket: t, counter: c, isRecall: false });
            }
          });
          if (state.stats.total > prev.stats.total) this.trigger('ticket_created', {});
          if (state.stats.completed > prev.stats.completed) this.trigger('ticket_completed', {});
          if (state.stats.waiting < prev.stats.waiting && state.stats.total === prev.stats.total) {
            this.trigger('ticket_skipped', {});
          }
        }
      } catch (e) { /* abaikan, coba lagi */ }
      setTimeout(tick, 3000);
    };
    tick();
  }

  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  off(event, callback) {
    if (!this.callbacks[event]) return;
    this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in event callback '${event}':`, e);
        }
      });
    }
  }
}

window.socketManager = new SocketManager();
