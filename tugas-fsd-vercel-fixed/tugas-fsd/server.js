const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');

const IS_VERCEL = !!process.env.VERCEL;

const app = express();
const server = http.createServer(app);
// Di Vercel (serverless) WebSocket tidak didukung -> client memakai polling.
const io = IS_VERCEL ? null : new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Serverless: setiap invocation bisa berjalan di instance berbeda, jadi
// muat ulang data dari Supabase sebelum menangani request API dan tunggu
// semua penulisan ke Supabase selesai sebelum mengirim respons.
if (IS_VERCEL) {
  app.use('/api', async (req, res, next) => {
    try {
      await db.syncSupabase();
    } catch (e) {
      console.warn('[SIANTRI] sync gagal:', e.message);
    }
    const flushThen = (orig) => function (...args) {
      db.flushPending().then(() => orig.apply(this, args), () => orig.apply(this, args));
      return this;
    };
    res.json = flushThen(res.json);
    res.send = flushThen(res.send);
    next();
  });
}

// Socket.IO Connection Handler
if (io) io.on('connection', (socket) => {
  console.log(`[SIANTRI Socket] Client connected: ${socket.id}`);

  // Send initial monitor state on connection
  socket.emit('monitor_state', db.getMonitorState());

  socket.on('disconnect', () => {
    // client disconnected
  });
});

// Broadcast helper for real-time updates
function broadcastUpdate(eventType, payload) {
  if (!io) return;
  io.emit(eventType, payload);
  io.emit('monitor_state', db.getMonitorState());
}

// Check daily reset on interval (every 30 seconds) - hanya server persisten
if (!IS_VERCEL) setInterval(() => {
  try {
    const settings = db.getSettings();
    const resetTime = settings.dailyResetTime || '00:00';
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];

    if (currentHHMM === resetTime && settings.lastResetDate !== today) {
      console.log(`[SIANTRI Cron] Triggering scheduled daily reset at ${currentHHMM} for ${today}`);
      db.resetDailyQueues(today);
      broadcastUpdate('daily_reset', { date: today });
    }
  } catch (err) {
    console.error("Error in daily reset check:", err);
  }
}, 30000);

// --- REST API ROUTES ---

// 1. Settings
app.get('/api/settings', (req, res) => {
  res.json(db.getSettings());
});

app.put('/api/settings', (req, res) => {
  const updated = db.updateSettings(req.body);
  broadcastUpdate('settings_updated', updated);
  res.json(updated);
});

// Supabase Integration Routes
app.get('/api/supabase/status', (req, res) => {
  res.json(db.getSupabaseStatus());
});

app.post('/api/supabase/test', async (req, res) => {
  const result = await db.testSupabase();
  res.json(result);
});

app.post('/api/supabase/config', async (req, res) => {
  try {
    const { supabaseUrl, supabaseKey } = req.body;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(400).json({ error: "URL dan Key Supabase wajib diisi" });
    }

    // Write to .env
    const envContent = `PORT=${PORT}\nSUPABASE_URL=${supabaseUrl.trim()}\nSUPABASE_KEY=${supabaseKey.trim()}\n`;
    if (IS_VERCEL) {
      return res.status(400).json({ error: "Di Vercel, isi SUPABASE_URL & SUPABASE_KEY lewat Project Settings > Environment Variables, lalu redeploy." });
    }
    const envPath = path.join(__dirname, '.env');
    require('fs').writeFileSync(envPath, envContent, 'utf8');

    // Reload environment in process
    process.env.SUPABASE_URL = supabaseUrl.trim();
    process.env.SUPABASE_KEY = supabaseKey.trim();

    // Re-trigger sync
    await db.syncSupabase();

    res.json({
      success: true,
      message: "Konfigurasi Supabase berhasil disimpan ke .env dan disinkronkan!"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Services (Layanan)
app.get('/api/services', (req, res) => {
  res.json(db.getServices());
});

app.post('/api/services', (req, res) => {
  try {
    const service = db.addService(req.body);
    broadcastUpdate('services_updated', db.getServices());
    res.status(201).json(service);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/services/:id', (req, res) => {
  const updated = db.updateService(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Layanan tidak ditemukan" });
  broadcastUpdate('services_updated', db.getServices());
  res.json(updated);
});

app.delete('/api/services/:id', (req, res) => {
  const ok = db.deleteService(req.params.id);
  if (!ok) return res.status(404).json({ error: "Layanan tidak ditemukan" });
  broadcastUpdate('services_updated', db.getServices());
  res.json({ success: true });
});

// 3. Counters (Loket)
app.get('/api/counters', (req, res) => {
  res.json(db.getCounters());
});

app.post('/api/counters', (req, res) => {
  try {
    const counter = db.addCounter(req.body);
    broadcastUpdate('counters_updated', db.getCounters());
    res.status(201).json(counter);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/counters/:id', (req, res) => {
  const updated = db.updateCounter(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Loket tidak ditemukan" });
  broadcastUpdate('counters_updated', db.getCounters());
  res.json(updated);
});

app.delete('/api/counters/:id', (req, res) => {
  const ok = db.deleteCounter(req.params.id);
  if (!ok) return res.status(404).json({ error: "Loket tidak ditemukan" });
  broadcastUpdate('counters_updated', db.getCounters());
  res.json({ success: true });
});

// 4. Users & Auth
app.get('/api/users', (req, res) => {
  res.json(db.getUsers());
});

app.post('/api/users', (req, res) => {
  try {
    const user = db.addUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  const user = db.updateUser(req.params.id, req.body);
  if (!user) return res.status(404).json({ error: "User tidak ditemukan" });
  res.json(user);
});

app.delete('/api/users/:id', (req, res) => {
  const ok = db.deleteUser(req.params.id);
  if (!ok) return res.status(404).json({ error: "User tidak ditemukan" });
  res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi" });
  }

  const user = db.authenticate(username, password);
  if (!user) {
    return res.status(401).json({ error: "Username atau password salah" });
  }

  res.json({ success: true, user });
});

// 5. Tickets (Registration, List, Track, Cancel)
app.post('/api/tickets', (req, res) => {
  try {
    const { serviceId, customerName, customerPhone } = req.body;
    if (!serviceId) {
      return res.status(400).json({ error: "Layanan wajib dipilih" });
    }

    const result = db.createTicket({ serviceId, customerName, customerPhone });
    broadcastUpdate('ticket_created', result.ticket);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tickets', (req, res) => {
  const { date, serviceId, status, counterId } = req.query;
  const tickets = db.getTickets({ date, serviceId, status, counterId });
  res.json(tickets);
});

app.get('/api/tickets/track/:query', (req, res) => {
  const data = db.getTicketTracking(req.params.query);
  if (!data) return res.status(404).json({ error: "Nomor tiket tidak ditemukan" });
  res.json(data);
});

app.post('/api/tickets/cancel/:id', (req, res) => {
  const result = db.cancelTicket(req.params.id);
  if (!result.success) return res.status(400).json(result);
  broadcastUpdate('ticket_cancelled', result.ticket);
  res.json(result);
});

// 6. Calling Operations (Petugas Interface)
app.post('/api/calling/next', (req, res) => {
  try {
    const { counterId, staffId } = req.body;
    if (!counterId) return res.status(400).json({ error: "Counter ID wajib diisi" });

    const result = db.callNext(counterId, staffId);
    if (!result.success) {
      return res.status(400).json(result);
    }

    // Broadcast calling sound & update
    broadcastUpdate('ticket_called', {
      ticket: result.ticket,
      counter: result.counter,
      isRecall: false
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/calling/recall', (req, res) => {
  try {
    const { counterId } = req.body;
    if (!counterId) return res.status(400).json({ error: "Counter ID wajib diisi" });

    const result = db.recallCurrent(counterId);
    if (!result.success) {
      return res.status(400).json(result);
    }

    broadcastUpdate('ticket_called', {
      ticket: result.ticket,
      counter: result.counter,
      isRecall: true
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/calling/skip', (req, res) => {
  try {
    const { counterId, reason } = req.body;
    if (!counterId) return res.status(400).json({ error: "Counter ID wajib diisi" });

    const result = db.skipCurrent(counterId, reason);
    if (!result.success) {
      return res.status(400).json(result);
    }

    broadcastUpdate('ticket_skipped', result.ticket);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/calling/complete', (req, res) => {
  try {
    const { counterId, notes } = req.body;
    if (!counterId) return res.status(400).json({ error: "Counter ID wajib diisi" });

    const result = db.completeCurrent(counterId, notes);
    if (!result.success) {
      return res.status(400).json(result);
    }

    broadcastUpdate('ticket_completed', result.ticket);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Monitor API
app.get('/api/monitor', (req, res) => {
  res.json(db.getMonitorState());
});

// 8. Reports & Analytics
app.get('/api/reports', (req, res) => {
  const { startDate, endDate } = req.query;
  const report = db.getReportData(startDate, endDate);
  res.json(report);
});

// CSV Export Endpoint
app.get('/api/reports/export-csv', (req, res) => {
  const { startDate, endDate } = req.query;
  const report = db.getReportData(startDate, endDate);
  
  // Format CSV header and rows
  const headers = [
    "Nomor Tiket",
    "Layanan",
    "Nama Pelanggan",
    "No Telepon",
    "Tanggal",
    "Waktu Ambil",
    "Waktu Panggil",
    "Waktu Selesai",
    "Loket",
    "Petugas",
    "Status",
    "Catatan"
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = report.tickets.map(t => [
    escapeCSV(t.ticketCode),
    escapeCSV(t.serviceName),
    escapeCSV(t.customerName),
    escapeCSV(t.customerPhone),
    escapeCSV(t.date),
    escapeCSV(t.createdAt ? new Date(t.createdAt).toLocaleTimeString('id-ID') : ''),
    escapeCSV(t.callTime ? new Date(t.callTime).toLocaleTimeString('id-ID') : ''),
    escapeCSV(t.completeTime ? new Date(t.completeTime).toLocaleTimeString('id-ID') : ''),
    escapeCSV(t.counterName || '-'),
    escapeCSV(t.staffName || '-'),
    escapeCSV(t.status),
    escapeCSV(t.notes || '')
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const filename = `Laporan_Antrean_${startDate || 'all'}_${endDate || ''}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csvContent); // Add UTF-8 BOM for Excel compatibility
});

// 9. Admin Maintenance (Manual Daily Reset & Reset to Factory Seed)
app.post('/api/admin/reset-daily', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.resetDailyQueues(today);
  broadcastUpdate('daily_reset', { date: today });
  res.json({ success: true, message: `Antrean hari ini (${today}) berhasil direset!` });
});

app.post('/api/admin/reset-factory', (req, res) => {
  db.resetToFactorySeed();
  broadcastUpdate('factory_reset', {});
  res.json({ success: true, message: "Seluruh data berhasil dikembalikan ke kondisi demo awal!" });
});

// Fallback for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
if (!IS_VERCEL) server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 SIANTRI - Sistem Antrean Terpadu berjalan!`);
  console.log(`🌐 Server Port: http://localhost:${PORT}`);
  console.log(`📺 Monitor TV: http://localhost:${PORT}/monitor.html`);
  console.log(`🎫 Mesin Kiosk: http://localhost:${PORT}/kiosk.html`);
  console.log(`📱 Cek Antrean: http://localhost:${PORT}/tracking.html`);
  console.log(`=======================================================`);
});

module.exports = app;
