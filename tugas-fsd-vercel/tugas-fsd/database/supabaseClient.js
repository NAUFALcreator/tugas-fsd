// ==========================================================================
// SIANTRI - Supabase Client Initialization & Helper
// ==========================================================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

let client = null;
let isConfigured = false;

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project-id')) {
  try {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });
    isConfigured = true;
    console.log(`[SIANTRI Supabase] Terhubung ke URL: ${supabaseUrl}`);
  } catch (err) {
    console.error("[SIANTRI Supabase] Gagal menginisialisasi klien:", err.message);
  }
} else {
  console.log("[SIANTRI Supabase] Kredensial Supabase belum diisi di .env. Menggunakan mode database lokal dengan opsi integrasi Supabase.");
}

async function testConnection() {
  if (!client) {
    return {
      connected: false,
      message: 'Kredensial SUPABASE_URL / SUPABASE_KEY belum dikonfigurasi di file .env'
    };
  }

  try {
    const { data, error } = await client.from('settings').select('*').limit(1);
    if (error) {
      return {
        connected: false,
        error: error.message,
        message: 'Gagal query ke tabel Supabase. Pastikan database/supabase_schema.sql sudah dijalankan di Supabase SQL Editor.'
      };
    }
    return {
      connected: true,
      message: 'Berhasil terhubung ke database Supabase PostgreSQL!',
      url: supabaseUrl
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  }
}

module.exports = {
  supabase: client,
  isConfigured: () => isConfigured && client !== null,
  getUrl: () => supabaseUrl,
  testConnection
};
