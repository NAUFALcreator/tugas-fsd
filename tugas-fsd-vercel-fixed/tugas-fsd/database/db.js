const fs = require('fs');
const path = require('path');
const supabaseAdapter = require('./supabaseAdapter');

// Di Vercel filesystem read-only kecuali /tmp (sementara, per-instance).
const DB_FILE = process.env.VERCEL
  ? path.join('/tmp', 'data.json')
  : path.join(__dirname, 'data.json');

// Default Initial Data
const defaultData = {
  settings: {
    institutionName: "KANTOR PELAYANAN TERPADU SATU PINTU (PTSP)",
    institutionAddress: "Jl. Pemuda No. 45, Kompleks Perkantoran Pemerintah",
    runningText: "Selamat datang di Sistem Antrean Terpadu (SIANTRI). Mohon perhatikan nomor antrean dan loket pelayanan Anda. Layanan buka Senin - Jumat pukul 08:00 - 15:30 WIB.",
    dailyResetTime: "00:00",
    lastResetDate: new Date().toISOString().split('T')[0],
    voiceSpeed: 1.0,
    voicePitch: 1.0,
    chimeSound: true
  },
  services: [
    {
      id: "srv-1",
      code: "A",
      name: "Layanan Kependudukan & KTP",
      description: "Perekaman KTP-el, KK, Akta Kelahiran, dan Surat Pindah",
      avgDuration: 7, // minutes
      color: "#2563eb", // blue
      active: true
    },
    {
      id: "srv-2",
      code: "B",
      name: "Layanan Pajak & Retribusi Daerah",
      description: "Pembayaran PBB, BPHTB, PKB, dan Retribusi Usaha",
      avgDuration: 10, // minutes
      color: "#059669", // emerald
      active: true
    },
    {
      id: "srv-3",
      code: "C",
      name: "Layanan Perizinan & OSS Usaha",
      description: "Izin Usaha NIB, IMB/PBG, Reklame, dan Izin Lingkungan",
      avgDuration: 12, // minutes
      color: "#d97706", // amber
      active: true
    },
    {
      id: "srv-4",
      code: "D",
      name: "Layanan Customer Service & Aduan",
      description: "Informasi umum, konsultasi berkas, dan layanan pengaduan",
      avgDuration: 5, // minutes
      color: "#7c3aed", // violet
      active: true
    }
  ],
  counters: [
    {
      id: "cnt-1",
      name: "Loket 1",
      serviceIds: ["srv-1"],
      status: "active", // active, rest, closed
      currentTicketId: null,
      assignedStaffId: "usr-2"
    },
    {
      id: "cnt-2",
      name: "Loket 2",
      serviceIds: ["srv-1", "srv-4"],
      status: "active",
      currentTicketId: null,
      assignedStaffId: "usr-3"
    },
    {
      id: "cnt-3",
      name: "Loket 3",
      serviceIds: ["srv-2"],
      status: "active",
      currentTicketId: null,
      assignedStaffId: "usr-4"
    },
    {
      id: "cnt-4",
      name: "Loket 4",
      serviceIds: ["srv-3"],
      status: "active",
      currentTicketId: null,
      assignedStaffId: "usr-5"
    }
  ],
  users: [
    {
      id: "usr-1",
      username: "admin",
      password: "admin123", // in production use bcrypt, for assignment clear mock is best
      name: "Administrator Utama",
      role: "admin", // admin, staff
      assignedCounterId: null
    },
    {
      id: "usr-2",
      username: "petugas1",
      password: "petugas123",
      name: "Ahmad Fauzi",
      role: "staff",
      assignedCounterId: "cnt-1"
    },
    {
      id: "usr-3",
      username: "petugas2",
      password: "petugas123",
      name: "Siti Rahma",
      role: "staff",
      assignedCounterId: "cnt-2"
    },
    {
      id: "usr-4",
      username: "petugas3",
      password: "petugas123",
      name: "Budi Santoso",
      role: "staff",
      assignedCounterId: "cnt-3"
    },
    {
      id: "usr-5",
      username: "petugas4",
      password: "petugas123",
      name: "Dewi Lestari",
      role: "staff",
      assignedCounterId: "cnt-4"
    }
  ],
  tickets: [],
  callingHistory: []
};

// Seed initial realistic tickets for today and yesterday so analytics & monitor look great right away
function generateSeedTickets(data) {
  const today = new Date().toISOString().split('T')[0];
  
  // Yesterday's date
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterday = yest.toISOString().split('T')[0];

  // Helper to format ticket number: A-001
  const fmt = (code, num) => `${code}-${String(num).padStart(3, '0')}`;

  const sampleTickets = [];
  
  // Yesterday's completed tickets
  const yestHours = ["08", "09", "10", "11", "13", "14", "15"];
  let yestId = 1;
  ["srv-1", "srv-2", "srv-3", "srv-4"].forEach((srvId, sIdx) => {
    const srv = data.services.find(s => s.id === srvId);
    for (let i = 1; i <= 8; i++) {
      const hr = yestHours[(i - 1) % yestHours.length];
      const minute = 10 + (i * 5);
      const createdAt = `${yesterday}T${hr}:${String(minute).padStart(2, '0')}:00.000Z`;
      const callTime = `${yesterday}T${hr}:${String(minute + 5).padStart(2, '0')}:00.000Z`;
      const completeTime = `${yesterday}T${hr}:${String(minute + 5 + srv.avgDuration).padStart(2, '0')}:00.000Z`;
      
      sampleTickets.push({
        id: `tkt-y-${yestId++}`,
        ticketCode: fmt(srv.code, i),
        number: i,
        serviceId: srv.id,
        serviceCode: srv.code,
        serviceName: srv.name,
        customerName: `Pelanggan ${srv.code}${i}`,
        customerPhone: `08123456${String(i).padStart(4, '0')}`,
        date: yesterday,
        createdAt,
        callTime,
        completeTime,
        counterId: `cnt-${(sIdx % 4) + 1}`,
        counterName: `Loket ${(sIdx % 4) + 1}`,
        staffId: `usr-${(sIdx % 4) + 2}`,
        staffName: data.users.find(u => u.id === `usr-${(sIdx % 4) + 2}`)?.name || "Petugas",
        status: i === 7 ? "skipped" : "completed",
        notes: i === 7 ? "Pelanggan tidak hadir saat dipanggil 3x" : "Pelayanan selesai lancar"
      });
    }
  });

  // Today's tickets: some completed, 1 currently being called/served, some waiting
  const todayHours = ["08", "09", "10", "11"];
  let todayId = 100;
  
  // Service A
  const srvA = data.services[0];
  for (let i = 1; i <= 6; i++) {
    const isCompleted = i <= 3;
    const isServing = i === 4;
    const isWaiting = i >= 5;
    
    const hr = todayHours[(i - 1) % todayHours.length] || "09";
    const minute = 10 + (i * 6);
    const createdAt = `${today}T${hr}:${String(minute).padStart(2, '0')}:00.000Z`;
    const callTime = !isWaiting ? `${today}T${hr}:${String(minute + 4).padStart(2, '0')}:00.000Z` : null;
    const completeTime = isCompleted ? `${today}T${hr}:${String(minute + 4 + srvA.avgDuration).padStart(2, '0')}:00.000Z` : null;

    const tkt = {
      id: `tkt-t-${todayId++}`,
      ticketCode: fmt(srvA.code, i),
      number: i,
      serviceId: srvA.id,
      serviceCode: srvA.code,
      serviceName: srvA.name,
      customerName: i === 1 ? "Bambang Wijaya" : i === 2 ? "Indah Permata" : i === 3 ? "Rian Syahputra" : i === 4 ? "Mega Utami" : `Pelanggan A${i}`,
      customerPhone: `08219988${String(i).padStart(4, '0')}`,
      date: today,
      createdAt,
      callTime,
      completeTime,
      counterId: !isWaiting ? "cnt-1" : null,
      counterName: !isWaiting ? "Loket 1" : null,
      staffId: !isWaiting ? "usr-2" : null,
      staffName: !isWaiting ? "Ahmad Fauzi" : null,
      status: isCompleted ? "completed" : isServing ? "calling" : "waiting",
      notes: isCompleted ? "Berkas lengkap" : ""
    };
    sampleTickets.push(tkt);
    
    if (isServing) {
      data.counters[0].currentTicketId = tkt.id;
      data.callingHistory.unshift({
        ticketId: tkt.id,
        ticketCode: tkt.ticketCode,
        serviceName: tkt.serviceName,
        counterId: "cnt-1",
        counterName: "Loket 1",
        time: callTime
      });
    }
  }

  // Service B
  const srvB = data.services[1];
  for (let i = 1; i <= 4; i++) {
    const isCompleted = i <= 2;
    const isServing = i === 3;
    const isWaiting = i === 4;
    
    const createdAt = `${today}T09:${String(15 + i * 8).padStart(2, '0')}:00.000Z`;
    const callTime = !isWaiting ? `${today}T09:${String(20 + i * 8).padStart(2, '0')}:00.000Z` : null;
    const completeTime = isCompleted ? `${today}T09:${String(30 + i * 8).padStart(2, '0')}:00.000Z` : null;

    const tkt = {
      id: `tkt-t-${todayId++}`,
      ticketCode: fmt(srvB.code, i),
      number: i,
      serviceId: srvB.id,
      serviceCode: srvB.code,
      serviceName: srvB.name,
      customerName: i === 1 ? "Dian Sastro" : i === 2 ? "Hendra Gunawan" : i === 3 ? "Novi Anggraini" : "Rudi Hartono",
      customerPhone: `08561122${String(i).padStart(4, '0')}`,
      date: today,
      createdAt,
      callTime,
      completeTime,
      counterId: !isWaiting ? "cnt-3" : null,
      counterName: !isWaiting ? "Loket 3" : null,
      staffId: !isWaiting ? "usr-4" : null,
      staffName: !isWaiting ? "Budi Santoso" : null,
      status: isCompleted ? "completed" : isServing ? "calling" : "waiting",
      notes: ""
    };
    sampleTickets.push(tkt);

    if (isServing) {
      data.counters[2].currentTicketId = tkt.id;
      data.callingHistory.unshift({
        ticketId: tkt.id,
        ticketCode: tkt.ticketCode,
        serviceName: tkt.serviceName,
        counterId: "cnt-3",
        counterName: "Loket 3",
        time: callTime
      });
    }
  }

  // Service C
  const srvC = data.services[2];
  for (let i = 1; i <= 3; i++) {
    const isCompleted = i === 1;
    const isWaiting = i > 1;
    const createdAt = `${today}T09:${String(30 + i * 5).padStart(2, '0')}:00.000Z`;
    const callTime = isCompleted ? `${today}T09:35:00.000Z` : null;
    const completeTime = isCompleted ? `${today}T09:47:00.000Z` : null;

    sampleTickets.push({
      id: `tkt-t-${todayId++}`,
      ticketCode: fmt(srvC.code, i),
      number: i,
      serviceId: srvC.id,
      serviceCode: srvC.code,
      serviceName: srvC.name,
      customerName: i === 1 ? "PT Berkah Usaha" : `Pemohon C${i}`,
      customerPhone: `08139977${String(i).padStart(4, '0')}`,
      date: today,
      createdAt,
      callTime,
      completeTime,
      counterId: isCompleted ? "cnt-4" : null,
      counterName: isCompleted ? "Loket 4" : null,
      staffId: isCompleted ? "usr-5" : null,
      staffName: isCompleted ? "Dewi Lestari" : null,
      status: isCompleted ? "completed" : "waiting",
      notes: ""
    });
  }

  data.tickets = sampleTickets;
}

class Database {
  constructor() {
    this.init();
  }

  init() {
    if (process.env.VERCEL && !fs.existsSync(DB_FILE) && fs.existsSync(path.join(__dirname, 'data.json'))) {
      try { fs.copyFileSync(path.join(__dirname, 'data.json'), DB_FILE); } catch (e) {}
    }
    if (!fs.existsSync(DB_FILE)) {
      const data = JSON.parse(JSON.stringify(defaultData));
      generateSeedTickets(data);
      this.saveData(data);
      this.data = data;
    } else {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
        // Ensure all required fields exist
        if (!this.data.settings) this.data.settings = defaultData.settings;
        if (!this.data.services) this.data.services = defaultData.services;
        if (!this.data.counters) this.data.counters = defaultData.counters;
        if (!this.data.users) this.data.users = defaultData.users;
        if (!this.data.tickets) this.data.tickets = [];
        if (!this.data.callingHistory) this.data.callingHistory = [];
      } catch (err) {
        console.error("Error reading db.json, recreating with defaults:", err);
        const data = JSON.parse(JSON.stringify(defaultData));
        generateSeedTickets(data);
        this.saveData(data);
        this.data = data;
      }
    }

    // Check automatic daily reset
    this.checkDailyReset();

    // Async sync with Supabase if configured
    this.syncSupabase();
  }

  async syncSupabase() {
    if (supabaseAdapter.isAvailable()) {
      try {
        const cloudData = await supabaseAdapter.fetchAll();
        if (cloudData && cloudData.services && cloudData.services.length > 0) {
          console.log("[SIANTRI Supabase] ✅ Terhubung & sinkron dengan cloud database Supabase!");
          if (cloudData.settings) this.data.settings = cloudData.settings;
          if (cloudData.services.length) this.data.services = cloudData.services;
          if (cloudData.counters.length) this.data.counters = cloudData.counters;
          if (cloudData.users.length) this.data.users = cloudData.users;
          if (cloudData.tickets.length) this.data.tickets = cloudData.tickets;
          if (cloudData.callingHistory.length) this.data.callingHistory = cloudData.callingHistory;
          this.saveData();
        } else {
          // Supabase connected but tables are fresh/empty, seed initial data
          await supabaseAdapter.pushInitialSeed(this.data);
        }
      } catch (err) {
        console.warn("[SIANTRI Supabase] Sinkronisasi cloud gagal, menggunakan data lokal:", err.message);
      }
    }
  }

  flushPending() {
    return supabaseAdapter.flushPending();
  }

  getSupabaseStatus() {
    return {
      isConfigured: supabaseAdapter.isAvailable(),
      url: supabaseAdapter.getUrl()
    };
  }

  async testSupabase() {
    return await supabaseAdapter.testConnection();
  }

  saveData(data = this.data) {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.warn('[SIANTRI DB] Gagal menulis file lokal:', err.message);
    }
  }

  checkDailyReset() {
    const today = new Date().toISOString().split('T')[0];
    const lastReset = this.data.settings.lastResetDate;

    if (lastReset !== today) {
      console.log(`[SIANTRI DB] Auto daily reset triggered for new date: ${today} (previous: ${lastReset})`);
      this.resetDailyQueues(today);
    }
  }

  resetDailyQueues(newDate = new Date().toISOString().split('T')[0]) {
    // Note: Past tickets are KEPT in this.data.tickets with their old `date` field.
    // Daily reset only clears the current active calling tickets on counters and resets counter state
    this.data.counters.forEach(cnt => {
      cnt.currentTicketId = null;
    });
    this.data.callingHistory = [];
    this.data.settings.lastResetDate = newDate;
    this.saveData();
  }

  // --- SETTINGS ---
  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.saveData();
    supabaseAdapter.saveSettings(this.data.settings);
    return this.data.settings;
  }

  // --- SERVICES ---
  getServices() {
    return this.data.services;
  }

  getServiceById(id) {
    return this.data.services.find(s => s.id === id);
  }

  addService(service) {
    const id = `srv-${Date.now()}`;
    const newService = {
      id,
      code: service.code.toUpperCase().trim(),
      name: service.name.trim(),
      description: service.description || '',
      avgDuration: Number(service.avgDuration) || 10,
      color: service.color || '#2563eb',
      active: service.active !== false
    };
    this.data.services.push(newService);
    this.saveData();
    supabaseAdapter.saveService(newService);
    return newService;
  }

  updateService(id, updates) {
    const idx = this.data.services.findIndex(s => s.id === id);
    if (idx === -1) return null;
    this.data.services[idx] = { ...this.data.services[idx], ...updates };
    this.saveData();
    supabaseAdapter.saveService(this.data.services[idx]);
    return this.data.services[idx];
  }

  deleteService(id) {
    const idx = this.data.services.findIndex(s => s.id === id);
    if (idx === -1) return false;
    this.data.services.splice(idx, 1);
    // Remove from counters as well
    this.data.counters.forEach(c => {
      c.serviceIds = c.serviceIds.filter(sid => sid !== id);
      supabaseAdapter.saveCounter(c);
    });
    this.saveData();
    supabaseAdapter.deleteService(id);
    return true;
  }

  // --- COUNTERS ---
  getCounters() {
    return this.data.counters.map(cnt => {
      const staff = this.data.users.find(u => u.id === cnt.assignedStaffId);
      const currentTicket = this.data.tickets.find(t => t.id === cnt.currentTicketId);
      return {
        ...cnt,
        staffName: staff ? staff.name : 'Belum Ditugaskan',
        currentTicket: currentTicket || null
      };
    });
  }

  getCounterById(id) {
    return this.data.counters.find(c => c.id === id);
  }

  addCounter(counter) {
    const id = `cnt-${Date.now()}`;
    const newCounter = {
      id,
      name: counter.name.trim(),
      serviceIds: counter.serviceIds || [],
      status: counter.status || "active",
      currentTicketId: null,
      assignedStaffId: counter.assignedStaffId || null
    };
    this.data.counters.push(newCounter);
    this.saveData();
    supabaseAdapter.saveCounter(newCounter);
    return newCounter;
  }

  updateCounter(id, updates) {
    const idx = this.data.counters.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this.data.counters[idx] = { ...this.data.counters[idx], ...updates };
    this.saveData();
    supabaseAdapter.saveCounter(this.data.counters[idx]);
    return this.data.counters[idx];
  }

  deleteCounter(id) {
    const idx = this.data.counters.findIndex(c => c.id === id);
    if (idx === -1) return false;
    this.data.counters.splice(idx, 1);
    this.saveData();
    supabaseAdapter.deleteCounter(id);
    return true;
  }

  // --- USERS & AUTH ---
  getUsers() {
    return this.data.users.map(({ password, ...u }) => u);
  }

  authenticate(username, password) {
    const user = this.data.users.find(u => u.username.toLowerCase() === username.toLowerCase().trim() && u.password === password);
    if (!user) return null;
    const { password: _, ...safeUser } = user;
    return safeUser;
  }

  addUser(userData) {
    const id = `usr-${Date.now()}`;
    const newUser = {
      id,
      username: userData.username.trim(),
      password: userData.password || '123456',
      name: userData.name.trim(),
      role: userData.role || 'staff',
      assignedCounterId: userData.assignedCounterId || null
    };
    this.data.users.push(newUser);
    this.saveData();
    supabaseAdapter.saveUser(newUser);
    const { password: _, ...safe } = newUser;
    return safe;
  }

  updateUser(id, updates) {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.saveData();
    supabaseAdapter.saveUser(this.data.users[idx]);
    const { password: _, ...safe } = this.data.users[idx];
    return safe;
  }

  deleteUser(id) {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) return false;
    this.data.users.splice(idx, 1);
    this.saveData();
    supabaseAdapter.deleteUser(id);
    return true;
  }

  // --- TICKETS / QUEUES ---
  getTickets(filter = {}) {
    let result = [...this.data.tickets];
    if (filter.date) {
      result = result.filter(t => t.date === filter.date);
    }
    if (filter.serviceId) {
      result = result.filter(t => t.serviceId === filter.serviceId);
    }
    if (filter.status) {
      result = result.filter(t => t.status === filter.status);
    }
    if (filter.counterId) {
      result = result.filter(t => t.counterId === filter.counterId);
    }
    return result;
  }

  getTicketById(id) {
    if (!id) return null;
    const today = new Date().toISOString().split('T')[0];
    // 1. Exact ID
    const byId = this.data.tickets.find(t => t.id === id);
    if (byId) return byId;

    // 2. Today's ticket by code
    const todayMatch = this.data.tickets.find(t => t.date === today && t.ticketCode.toUpperCase() === id.toUpperCase());
    if (todayMatch) return todayMatch;

    // 3. Newest ticket by code
    return [...this.data.tickets].reverse().find(t => t.ticketCode.toUpperCase() === id.toUpperCase());
  }

  // Customer registers for a ticket
  createTicket({ serviceId, customerName, customerPhone }) {
    const today = new Date().toISOString().split('T')[0];
    const service = this.getServiceById(serviceId);
    if (!service) throw new Error("Layanan tidak ditemukan");

    // Get today's tickets for this service to calculate next sequence number
    const todayServiceTickets = this.data.tickets.filter(
      t => t.date === today && t.serviceId === serviceId
    );

    const nextNumber = todayServiceTickets.length + 1;
    const ticketCode = `${service.code}-${String(nextNumber).padStart(3, '0')}`;
    const id = `tkt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Calculate queue position & estimated wait time
    const waitingBefore = this.data.tickets.filter(
      t => t.date === today && t.serviceId === serviceId && (t.status === 'waiting' || t.status === 'calling')
    ).length;

    const estimatedWaitMinutes = waitingBefore * service.avgDuration;

    const newTicket = {
      id,
      ticketCode,
      number: nextNumber,
      serviceId: service.id,
      serviceCode: service.code,
      serviceName: service.name,
      customerName: customerName ? customerName.trim() : `Pelanggan ${ticketCode}`,
      customerPhone: customerPhone ? customerPhone.trim() : '',
      date: today,
      createdAt: new Date().toISOString(),
      callTime: null,
      completeTime: null,
      counterId: null,
      counterName: null,
      staffId: null,
      staffName: null,
      status: 'waiting', // waiting, calling, serving, completed, skipped, cancelled
      notes: ''
    };

    this.data.tickets.push(newTicket);
    this.saveData();
    supabaseAdapter.saveTicket(newTicket);

    return {
      ticket: newTicket,
      position: waitingBefore + 1,
      waitingAhead: waitingBefore,
      estimatedWaitMinutes
    };
  }

  // Get ticket customer tracking status
  getTicketTracking(ticketQuery) {
    const ticket = this.getTicketById(ticketQuery);
    if (!ticket) return null;

    const service = this.getServiceById(ticket.serviceId);
    const avgDuration = service ? service.avgDuration : 10;

    let waitingAhead = 0;
    if (ticket.status === 'waiting') {
      waitingAhead = this.data.tickets.filter(
        t => t.date === ticket.date &&
             t.serviceId === ticket.serviceId &&
             t.status === 'waiting' &&
             new Date(t.createdAt) < new Date(ticket.createdAt)
      ).length;
    }

    const estimatedWaitMinutes = ticket.status === 'waiting' ? waitingAhead * avgDuration : 0;

    // Currently calling ticket in same service
    const currentCalling = this.data.tickets.find(
      t => t.date === ticket.date && t.serviceId === ticket.serviceId && (t.status === 'calling' || t.status === 'serving')
    );

    return {
      ticket,
      service,
      waitingAhead,
      position: waitingAhead + 1,
      estimatedWaitMinutes,
      currentCalling: currentCalling ? currentCalling.ticketCode : '-'
    };
  }

  // Customer cancels queue
  cancelTicket(ticketId) {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) return { success: false, message: "Tiket tidak ditemukan" };
    if (ticket.status === 'completed') {
      return { success: false, message: "Tiket sudah selesai dilayani" };
    }

    ticket.status = 'cancelled';
    ticket.notes = 'Dibatalkan oleh pelanggan';
    ticket.completeTime = new Date().toISOString();

    // If counter was serving this ticket, free the counter
    const counter = this.data.counters.find(c => c.currentTicketId === ticket.id);
    if (counter) {
      counter.currentTicketId = null;
      supabaseAdapter.saveCounter(counter);
    }

    this.saveData();
    supabaseAdapter.saveTicket(ticket);
    return { success: true, ticket };
  }

  // Staff calls next ticket for their counter
  callNext(counterId, staffId) {
    const today = new Date().toISOString().split('T')[0];
    const counter = this.getCounterById(counterId);
    if (!counter) throw new Error("Loket tidak ditemukan");

    // If counter currently has a calling/serving ticket, automatically mark it completed or check
    if (counter.currentTicketId) {
      const prevTicket = this.getTicketById(counter.currentTicketId);
      if (prevTicket && (prevTicket.status === 'calling' || prevTicket.status === 'serving')) {
        prevTicket.status = 'completed';
        prevTicket.completeTime = new Date().toISOString();
        prevTicket.notes = prevTicket.notes || 'Selesai otomatis saat panggil berikutnya';
        supabaseAdapter.saveTicket(prevTicket);
      }
    }

    // Find next ticket waiting matching this counter's assigned services
    const eligibleTickets = this.data.tickets.filter(
      t => t.date === today &&
           t.status === 'waiting' &&
           counter.serviceIds.includes(t.serviceId)
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (eligibleTickets.length === 0) {
      counter.currentTicketId = null;
      this.saveData();
      supabaseAdapter.saveCounter(counter);
      return { success: false, message: "Tidak ada antrean yang menunggu untuk loket ini" };
    }

    const nextTicket = eligibleTickets[0];
    const staff = this.data.users.find(u => u.id === staffId);

    const now = new Date().toISOString();
    nextTicket.status = 'calling';
    nextTicket.callTime = now;
    nextTicket.counterId = counter.id;
    nextTicket.counterName = counter.name;
    nextTicket.staffId = staff ? staff.id : null;
    nextTicket.staffName = staff ? staff.name : 'Petugas';

    counter.currentTicketId = nextTicket.id;
    counter.status = 'active';

    const historyItem = {
      ticketId: nextTicket.id,
      ticketCode: nextTicket.ticketCode,
      serviceName: nextTicket.serviceName,
      counterId: counter.id,
      counterName: counter.name,
      staffName: nextTicket.staffName,
      time: now
    };

    // Add to calling history
    this.data.callingHistory.unshift(historyItem);

    // Limit history to 20
    if (this.data.callingHistory.length > 20) {
      this.data.callingHistory.pop();
    }

    this.saveData();
    supabaseAdapter.saveTicket(nextTicket);
    supabaseAdapter.saveCounter(counter);
    supabaseAdapter.addCallingHistory(historyItem);

    return {
      success: true,
      ticket: nextTicket,
      counter: this.getCounterById(counter.id)
    };
  }

  // Staff recalls current ticket (play sound again)
  recallCurrent(counterId) {
    const counter = this.getCounterById(counterId);
    if (!counter || !counter.currentTicketId) {
      return { success: false, message: "Tidak ada tiket yang sedang dipanggil di loket ini" };
    }

    const ticket = this.getTicketById(counter.currentTicketId);
    if (!ticket) {
      return { success: false, message: "Tiket tidak ditemukan" };
    }

    const now = new Date().toISOString();
    ticket.callTime = now;

    const historyItem = {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      serviceName: ticket.serviceName,
      counterId: counter.id,
      counterName: counter.name,
      staffName: ticket.staffName,
      time: now
    };

    // Update history top
    this.data.callingHistory = this.data.callingHistory.filter(h => h.ticketId !== ticket.id);
    this.data.callingHistory.unshift(historyItem);

    this.saveData();
    supabaseAdapter.saveTicket(ticket);
    supabaseAdapter.addCallingHistory(historyItem);

    return {
      success: true,
      ticket,
      counter
    };
  }

  // Staff skips current ticket (pelanggan tidak ada)
  skipCurrent(counterId, reason = 'Pelanggan tidak hadir') {
    const counter = this.getCounterById(counterId);
    if (!counter || !counter.currentTicketId) {
      return { success: false, message: "Tidak ada antrean yang sedang aktif di loket ini" };
    }

    const ticket = this.getTicketById(counter.currentTicketId);
    if (!ticket) return { success: false, message: "Tiket tidak ditemukan" };

    ticket.status = 'skipped';
    ticket.completeTime = new Date().toISOString();
    ticket.notes = reason;

    counter.currentTicketId = null;
    this.saveData();
    supabaseAdapter.saveTicket(ticket);
    supabaseAdapter.saveCounter(counter);

    return {
      success: true,
      ticket,
      counter
    };
  }

  // Staff completes current ticket
  completeCurrent(counterId, notes = 'Pelayanan selesai') {
    const counter = this.getCounterById(counterId);
    if (!counter || !counter.currentTicketId) {
      return { success: false, message: "Tidak ada antrean yang sedang aktif di loket ini" };
    }

    const ticket = this.getTicketById(counter.currentTicketId);
    if (!ticket) return { success: false, message: "Tiket tidak ditemukan" };

    ticket.status = 'completed';
    ticket.completeTime = new Date().toISOString();
    ticket.notes = notes;

    counter.currentTicketId = null;
    this.saveData();
    supabaseAdapter.saveTicket(ticket);
    supabaseAdapter.saveCounter(counter);

    return {
      success: true,
      ticket,
      counter
    };
  }

  // Get monitor state
  getMonitorState() {
    const today = new Date().toISOString().split('T')[0];
    const counters = this.getCounters();
    
    // Find latest active calling ticket
    const activeCalling = counters
      .filter(c => c.currentTicket && (c.currentTicket.status === 'calling' || c.currentTicket.status === 'serving'))
      .sort((a, b) => new Date(b.currentTicket.callTime || 0) - new Date(a.currentTicket.callTime || 0))[0];

    const todayTickets = this.data.tickets.filter(t => t.date === today);
    const waitingCount = todayTickets.filter(t => t.status === 'waiting').length;
    const completedCount = todayTickets.filter(t => t.status === 'completed').length;

    return {
      currentCall: activeCalling ? {
        ticketCode: activeCalling.currentTicket.ticketCode,
        serviceName: activeCalling.currentTicket.serviceName,
        counterName: activeCalling.name,
        counterId: activeCalling.id,
        callTime: activeCalling.currentTicket.callTime
      } : null,
      history: this.data.callingHistory.slice(0, 6),
      counters,
      stats: {
        total: todayTickets.length,
        waiting: waitingCount,
        completed: completedCount
      },
      settings: this.data.settings
    };
  }

  // Get Analytics & Report data
  getReportData(startDate, endDate) {
    let tickets = [...this.data.tickets];
    
    if (startDate && endDate) {
      tickets = tickets.filter(t => t.date >= startDate && t.date <= endDate);
    } else if (startDate) {
      tickets = tickets.filter(t => t.date === startDate);
    }

    const totalTickets = tickets.length;
    const completedTickets = tickets.filter(t => t.status === 'completed');
    const skippedTickets = tickets.filter(t => t.status === 'skipped');
    const cancelledTickets = tickets.filter(t => t.status === 'cancelled');
    const waitingTickets = tickets.filter(t => t.status === 'waiting');

    // Calculate average wait time (minutes from createdAt to callTime)
    let totalWaitMinutes = 0;
    let waitCount = 0;
    completedTickets.forEach(t => {
      if (t.createdAt && t.callTime) {
        const diff = (new Date(t.callTime) - new Date(t.createdAt)) / 60000;
        if (diff >= 0 && diff < 300) {
          totalWaitMinutes += diff;
          waitCount++;
        }
      }
    });
    const avgWaitMinutes = waitCount > 0 ? (totalWaitMinutes / waitCount).toFixed(1) : 0;

    // Calculate average service duration (minutes from callTime to completeTime)
    let totalServiceMinutes = 0;
    let serviceCount = 0;
    completedTickets.forEach(t => {
      if (t.callTime && t.completeTime) {
        const diff = (new Date(t.completeTime) - new Date(t.callTime)) / 60000;
        if (diff >= 0 && diff < 300) {
          totalServiceMinutes += diff;
          serviceCount++;
        }
      }
    });
    const avgServiceMinutes = serviceCount > 0 ? (totalServiceMinutes / serviceCount).toFixed(1) : 0;

    // Hourly traffic distribution (08:00 - 16:00)
    const hourlyData = {};
    for (let h = 8; h <= 16; h++) {
      const key = `${String(h).padStart(2, '0')}:00`;
      hourlyData[key] = 0;
    }
    tickets.forEach(t => {
      if (t.createdAt) {
        const d = new Date(t.createdAt);
        const h = d.getHours();
        const key = `${String(h).padStart(2, '0')}:00`;
        if (hourlyData[key] !== undefined) {
          hourlyData[key]++;
        }
      }
    });

    // Performance per counter
    const counterPerformance = this.data.counters.map(cnt => {
      const cntTickets = completedTickets.filter(t => t.counterId === cnt.id);
      let waitSum = 0;
      let srvSum = 0;
      cntTickets.forEach(t => {
        if (t.createdAt && t.callTime) waitSum += (new Date(t.callTime) - new Date(t.createdAt)) / 60000;
        if (t.callTime && t.completeTime) srvSum += (new Date(t.completeTime) - new Date(t.callTime)) / 60000;
      });

      return {
        counterId: cnt.id,
        counterName: cnt.name,
        totalServed: cntTickets.length,
        avgServiceTime: cntTickets.length > 0 ? (srvSum / cntTickets.length).toFixed(1) : 0
      };
    });

    // Distribution by service
    const serviceDistribution = this.data.services.map(srv => {
      const srvTickets = tickets.filter(t => t.serviceId === srv.id);
      return {
        serviceId: srv.id,
        serviceCode: srv.code,
        serviceName: srv.name,
        color: srv.color,
        count: srvTickets.length,
        completed: srvTickets.filter(t => t.status === 'completed').length
      };
    });

    return {
      summary: {
        totalTickets,
        completedCount: completedTickets.length,
        skippedCount: skippedTickets.length,
        cancelledCount: cancelledTickets.length,
        waitingCount: waitingTickets.length,
        avgWaitMinutes: Number(avgWaitMinutes),
        avgServiceMinutes: Number(avgServiceMinutes)
      },
      hourlyTraffic: hourlyData,
      counterPerformance,
      serviceDistribution,
      tickets
    };
  }

  // Reset entire database to factory seed
  resetToFactorySeed() {
    const data = JSON.parse(JSON.stringify(defaultData));
    generateSeedTickets(data);
    this.saveData(data);
    this.data = data;
    return true;
  }
}

module.exports = new Database();
