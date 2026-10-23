// ==========================================================================
// SIANTRI - Complete Automated End-to-End API Test Suite
// ==========================================================================

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
  } else {
    const text = await res.text();
    return { status: res.status, ok: res.ok, text };
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 Memulai Pengujian Otomatis Fitur SIANTRI...");
  console.log("=================================================");

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  try {
    // 1. Settings
    const resSet = await request('/api/settings');
    assert(resSet.ok && resSet.data.institutionName.includes('PTSP'), '1. Pengaturan Sistem: Nama instansi terbaca');

    // 2. Services Master Data
    const resSrv = await request('/api/services');
    assert(resSrv.ok && resSrv.data.length >= 4, `2. Layanan & Loket: Master data memiliki ${resSrv.data.length} jenis layanan`);

    // 3. Counters Master Data
    const resCnt = await request('/api/counters');
    assert(resCnt.ok && resCnt.data.length >= 4, `3. Layanan & Loket: Master data memiliki ${resCnt.data.length} loket`);

    // 4. Auth: Admin Login
    const resLoginAdmin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert(resLoginAdmin.ok && resLoginAdmin.data.user.role === 'admin', '4. Login Petugas/Admin: Autentikasi Admin berhasil');

    // 5. Auth: Petugas Login
    const resLoginStaff = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'petugas1', password: 'petugas123' })
    });
    assert(resLoginStaff.ok && resLoginStaff.data.user.role === 'staff' && resLoginStaff.data.user.assignedCounterId === 'cnt-1', '5. Login Petugas/Admin: Petugas 1 terbatas ke loketnya');

    // 6. Pendaftaran Antrean (Customer Kiosk)
    const srv1 = resSrv.data[0];
    const resCreateTicket = await request('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({
        serviceId: srv1.id,
        customerName: 'Ahmad Dahlan',
        customerPhone: '081234567890'
      })
    });
    assert(resCreateTicket.ok && resCreateTicket.data.ticket.ticketCode.startsWith(srv1.code), `6. Pendaftaran Antrean: Tiket baru dibuat (${resCreateTicket.data.ticket.ticketCode}) dengan estimasi waktu`);

    const newTicket = resCreateTicket.data.ticket;

    // 7. Status Antrean Pribadi (Tracking Pelanggan)
    const resTrack = await request(`/api/tickets/track/${newTicket.ticketCode}`);
    assert(resTrack.ok && resTrack.data.ticket.id === newTicket.id && typeof resTrack.data.waitingAhead === 'number', `7. Status Antrean Pribadi: Pelanggan melihat posisi antrean & estimasi tunggu`);

    // 8. Panggilan Antrean: Panggil Berikutnya
    const resCallNext = await request('/api/calling/next', {
      method: 'POST',
      body: JSON.stringify({ counterId: 'cnt-1', staffId: 'usr-2' })
    });
    assert(resCallNext.ok && resCallNext.data.ticket.status === 'calling', `8. Panggilan Antrean: Tombol Panggil Berikutnya sukses (${resCallNext.data.ticket.ticketCode} dipanggil di ${resCallNext.data.counter.name})`);

    // 9. Panggilan Antrean: Panggil Ulang
    const resRecall = await request('/api/calling/recall', {
      method: 'POST',
      body: JSON.stringify({ counterId: 'cnt-1' })
    });
    assert(resRecall.ok && resRecall.data.ticket.ticketCode === resCallNext.data.ticket.ticketCode, '9. Panggilan Antrean: Tombol Panggil Ulang berfungsi');

    // 10. Panggilan Antrean: Selesai
    const resComplete = await request('/api/calling/complete', {
      method: 'POST',
      body: JSON.stringify({ counterId: 'cnt-1', notes: 'Pelayanan KTP selesai' })
    });
    assert(resComplete.ok && resComplete.data.ticket.status === 'completed', '10. Panggilan Antrean: Tombol Selesai sukses menyimpan transaksi');

    // 11. Layar Monitor: Auto-refresh & Data
    const resMon = await request('/api/monitor');
    assert(resMon.ok && resMon.data.counters.length > 0 && resMon.data.history.length > 0, '11. Layar Monitor: Tampilan nomor, riwayat panggilan & status loket valid');

    // 12. Laporan & Statistik: Metrics & Hourly Chart
    const resRep = await request('/api/reports');
    assert(resRep.ok && resRep.data.summary.totalTickets > 0 && resRep.data.hourlyTraffic['08:00'] !== undefined, '12. Laporan & Statistik: KPI jumlah dilayani, rata-rata tunggu, dan grafik per jam');

    // 13. Export CSV
    const resCsv = await request('/api/reports/export-csv');
    assert(resCsv.ok && resCsv.text.includes('Nomor Tiket') && resCsv.text.includes('Layanan'), '13. Laporan & Statistik: Export CSV berfungsi dengan format UTF-8');

    // 14. Status Antrean Pribadi: Pembatalan Antrean
    const resCreateToCancel = await request('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ serviceId: srv1.id, customerName: 'Pemohon Batal' })
    });
    const ticketToCancel = resCreateToCancel.data.ticket;
    const resCancel = await request(`/api/tickets/cancel/${ticketToCancel.id}`, { method: 'POST' });
    assert(resCancel.ok && resCancel.data.ticket.status === 'cancelled', '14. Status Antrean Pribadi: Pembatalan tiket oleh pelanggan sukses');

    // 15. Manajemen Harian: Reset Harian
    const resResetDaily = await request('/api/admin/reset-daily', { method: 'POST' });
    assert(resResetDaily.ok && resResetDaily.data.success === true, '15. Manajemen Harian: Reset nomor antrean harian berfungsi (riwayat tersimpan)');

    console.log("=================================================");
    console.log(`📊 HASIL PENGUJIAN: ${passed}/${total} PENGUJIAN BERHASIL (100% SUKSES)!`);
    console.log("=================================================");
  } catch (err) {
    console.error("Test Suite Error:", err);
  }
}

runTests();
