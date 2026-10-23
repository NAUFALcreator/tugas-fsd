// ==========================================================================
// SIANTRI - Supabase Database Adapter & Bi-directional Sync
// ==========================================================================

const { supabase, isConfigured, testConnection, getUrl } = require('./supabaseClient');

// Converters: CamelCase <-> SnakeCase
const mappers = {
  settingsToDb(s) {
    return {
      id: 'main',
      institution_name: s.institutionName,
      institution_address: s.institutionAddress,
      running_text: s.runningText,
      daily_reset_time: s.dailyResetTime,
      last_reset_date: s.lastResetDate,
      voice_speed: s.voiceSpeed,
      voice_pitch: s.voicePitch,
      chime_sound: s.chimeSound,
      updated_at: new Date().toISOString()
    };
  },
  settingsFromDb(row) {
    if (!row) return null;
    return {
      institutionName: row.institution_name,
      institutionAddress: row.institution_address,
      runningText: row.running_text,
      dailyResetTime: row.daily_reset_time,
      lastResetDate: typeof row.last_reset_date === 'string' ? row.last_reset_date.split('T')[0] : row.last_reset_date,
      voiceSpeed: Number(row.voice_speed) || 1.0,
      voicePitch: Number(row.voice_pitch) || 1.0,
      chimeSound: row.chime_sound !== false
    };
  },

  serviceToDb(s) {
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description,
      avg_duration: s.avgDuration,
      color: s.color,
      active: s.active
    };
  },
  serviceFromDb(row) {
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || '',
      avgDuration: Number(row.avg_duration) || 10,
      color: row.color || '#2563eb',
      active: row.active !== false
    };
  },

  counterToDb(c) {
    return {
      id: c.id,
      name: c.name,
      service_ids: c.serviceIds || [],
      status: c.status || 'active',
      current_ticket_id: c.currentTicketId || null,
      assigned_staff_id: c.assignedStaffId || null
    };
  },
  counterFromDb(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      serviceIds: Array.isArray(row.service_ids) ? row.service_ids : [],
      status: row.status || 'active',
      currentTicketId: row.current_ticket_id || null,
      assignedStaffId: row.assigned_staff_id || null
    };
  },

  userToDb(u) {
    return {
      id: u.id,
      username: u.username,
      password: u.password,
      name: u.name,
      role: u.role || 'staff',
      assigned_counter_id: u.assignedCounterId || null
    };
  },
  userFromDb(row) {
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      password: row.password,
      name: row.name,
      role: row.role,
      assignedCounterId: row.assigned_counter_id || null
    };
  },

  ticketToDb(t) {
    return {
      id: t.id,
      ticket_code: t.ticketCode,
      number: t.number,
      service_id: t.serviceId,
      service_code: t.serviceCode,
      service_name: t.serviceName,
      customer_name: t.customerName,
      customer_phone: t.customerPhone,
      date: t.date,
      created_at: t.createdAt,
      call_time: t.callTime,
      complete_time: t.completeTime,
      counter_id: t.counterId,
      counter_name: t.counterName,
      staff_id: t.staffId,
      staff_name: t.staffName,
      status: t.status,
      notes: t.notes
    };
  },
  ticketFromDb(row) {
    if (!row) return null;
    return {
      id: row.id,
      ticketCode: row.ticket_code,
      number: row.number,
      serviceId: row.service_id,
      serviceCode: row.service_code,
      serviceName: row.service_name,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      date: typeof row.date === 'string' ? row.date.split('T')[0] : row.date,
      createdAt: row.created_at,
      callTime: row.call_time,
      completeTime: row.complete_time,
      counterId: row.counter_id,
      counterName: row.counter_name,
      staffId: row.staff_id,
      staffName: row.staff_name,
      status: row.status,
      notes: row.notes || ''
    };
  },

  historyToDb(h) {
    return {
      ticket_id: h.ticketId,
      ticket_code: h.ticketCode,
      service_name: h.serviceName,
      counter_id: h.counterId,
      counter_name: h.counterName,
      staff_name: h.staffName,
      time: h.time
    };
  },
  historyFromDb(row) {
    if (!row) return null;
    return {
      ticketId: row.ticket_id,
      ticketCode: row.ticket_code,
      serviceName: row.service_name,
      counterId: row.counter_id,
      counterName: row.counter_name,
      staffName: row.staff_name,
      time: row.time
    };
  }
};

const pending = new Set();
function track(fn) {
  return function (...args) {
    const p = fn.apply(this, args);
    pending.add(p);
    const done = () => pending.delete(p);
    p.then(done, done);
    return p;
  };
}

const SupabaseAdapter = {
  async flushPending() {
    while (pending.size) await Promise.allSettled([...pending]);
  },

  isAvailable() {
    return isConfigured();
  },

  getUrl() {
    return getUrl();
  },

  async testConnection() {
    return await testConnection();
  },

  // Pull all data from Supabase into memory
  async fetchAll() {
    if (!isConfigured()) return null;

    try {
      const [resSet, resSrv, resCnt, resUsr, resTkt, resHist] = await Promise.all([
        supabase.from('settings').select('*').limit(1).maybeSingle(),
        supabase.from('services').select('*').order('created_at', { ascending: true }),
        supabase.from('counters').select('*').order('created_at', { ascending: true }),
        supabase.from('users').select('*').order('created_at', { ascending: true }),
        supabase.from('tickets').select('*').order('created_at', { ascending: true }),
        supabase.from('calling_history').select('*').order('time', { ascending: false }).limit(20)
      ]);

      if (resSrv.error || resCnt.error || resTkt.error) {
        console.warn("[SIANTRI Supabase] Warning fetching tables:", resSrv.error || resCnt.error || resTkt.error);
        return null;
      }

      return {
        settings: resSet.data ? mappers.settingsFromDb(resSet.data) : null,
        services: (resSrv.data || []).map(mappers.serviceFromDb),
        counters: (resCnt.data || []).map(mappers.counterFromDb),
        users: (resUsr.data || []).map(mappers.userFromDb),
        tickets: (resTkt.data || []).map(mappers.ticketFromDb),
        callingHistory: (resHist.data || []).map(mappers.historyFromDb)
      };
    } catch (err) {
      console.error("[SIANTRI Supabase] Error fetchAll:", err.message);
      return null;
    }
  },

  // Save / Sync operations to Supabase
  async saveSettings(settings) {
    if (!isConfigured()) return;
    try {
      const payload = mappers.settingsToDb(settings);
      await supabase.from('settings').upsert(payload, { onConflict: 'id' });
    } catch (e) {
      console.warn("[SIANTRI Supabase] Save settings error:", e.message);
    }
  },

  async saveService(service) {
    if (!isConfigured()) return;
    try {
      await supabase.from('services').upsert(mappers.serviceToDb(service), { onConflict: 'id' });
    } catch (e) {
      console.warn("[SIANTRI Supabase] Save service error:", e.message);
    }
  },

  async deleteService(id) {
    if (!isConfigured()) return;
    try {
      await supabase.from('services').delete().eq('id', id);
    } catch (e) {
      console.warn("[SIANTRI Supabase] Delete service error:", e.message);
    }
  },

  async saveCounter(counter) {
    if (!isConfigured()) return;
    try {
      await supabase.from('counters').upsert(mappers.counterToDb(counter), { onConflict: 'id' });
    } catch (e) {
      console.warn("[SIANTRI Supabase] Save counter error:", e.message);
    }
  },

  async deleteCounter(id) {
    if (!isConfigured()) return;
    try {
      await supabase.from('counters').delete().eq('id', id);
    } catch (e) {
      console.warn("[SIANTRI Supabase] Delete counter error:", e.message);
    }
  },

  async saveUser(user) {
    if (!isConfigured()) return;
    try {
      await supabase.from('users').upsert(mappers.userToDb(user), { onConflict: 'id' });
    } catch (e) {
      console.warn("[SIANTRI Supabase] Save user error:", e.message);
    }
  },

  async deleteUser(id) {
    if (!isConfigured()) return;
    try {
      await supabase.from('users').delete().eq('id', id);
    } catch (e) {
      console.warn("[SIANTRI Supabase] Delete user error:", e.message);
    }
  },

  async saveTicket(ticket) {
    if (!isConfigured()) return;
    try {
      await supabase.from('tickets').upsert(mappers.ticketToDb(ticket), { onConflict: 'id' });
    } catch (e) {
      console.warn("[SIANTRI Supabase] Save ticket error:", e.message);
    }
  },

  async addCallingHistory(historyItem) {
    if (!isConfigured()) return;
    try {
      await supabase.from('calling_history').insert(mappers.historyToDb(historyItem));
    } catch (e) {
      console.warn("[SIANTRI Supabase] Add calling history error:", e.message);
    }
  },

  // Push seed data to Supabase if newly connected
  async pushInitialSeed(data) {
    if (!isConfigured()) return;
    try {
      console.log("[SIANTRI Supabase] Mengunggah data seed awal ke Supabase...");
      if (data.settings) await this.saveSettings(data.settings);
      for (const s of data.services) await this.saveService(s);
      for (const u of data.users) await this.saveUser(u);
      for (const c of data.counters) await this.saveCounter(c);
      for (const t of data.tickets) await this.saveTicket(t);
      console.log("[SIANTRI Supabase] Berhasil sinkronisasi awal ke Supabase!");
    } catch (e) {
      console.warn("[SIANTRI Supabase] Seed push error:", e.message);
    }
  }
};

['saveSettings','saveService','deleteService','saveCounter','deleteCounter','saveUser','deleteUser','saveTicket','addCallingHistory']
  .forEach(k => { SupabaseAdapter[k] = track(SupabaseAdapter[k]); });

module.exports = SupabaseAdapter;
