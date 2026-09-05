// Polyfill WebSocket for Node < 22 BEFORE importing supabase-js.
// @supabase/realtime-js checks for a global WebSocket at import time and throws
// on Node 20. We also disable Realtime (this server only uses Storage), so the
// polyfill is never used for actual I/O — it just lets the module load.
if (typeof global.WebSocket === 'undefined') {
  try {
    global.WebSocket = require('ws');
  } catch (e) {
    console.warn('⚠️ Could not polyfill WebSocket (ws package missing):', e.message);
  }
}

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

// Disable Realtime — this server only uses Supabase for Storage uploads.
const supabaseOptions = {
  realtime: { enabled: false },
  auth: { persistSession: false }
};

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions);
    console.log('⚡ Supabase Client initialized successfully.');
  } catch (err) {
    console.warn('⚠️ Could not initialize Supabase Client:', err.message);
  }
} else {
  console.log('ℹ️ Running with Built-in Express Persistent Engine (Supabase keys not set).');
}

// Service-role client for server-side storage uploads (bypasses RLS).
let supabaseService = null;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (supabaseUrl && serviceKey && supabaseUrl.startsWith('http')) {
  try {
    supabaseService = createClient(supabaseUrl, serviceKey, supabaseOptions);
    console.log('⚡ Supabase Service-Role Client initialized for storage uploads.');
  } catch (err) {
    console.warn('⚠️ Could not initialize Supabase Service Client:', err.message);
  }
}

module.exports = { supabase, supabaseService };
