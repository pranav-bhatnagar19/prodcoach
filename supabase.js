// ============================================================
// supabase.js  —  SmartBear Coach: Supabase client & all DB calls
// ============================================================
// Replace the two constants below with your actual project values.
// Find them: Supabase dashboard → Settings → API
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL  = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── AUTH ─────────────────────────────────────────────────────

/** Sign in with email + password */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Sign up a new user */
export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } }
  });
  if (error) throw error;
  return data;
}

/** Sign out */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Get current session (null if not logged in) */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Subscribe to auth state changes */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

// ── PROFILE ──────────────────────────────────────────────────

/** Load the current user's profile */
export async function getProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Update selected product preference */
export async function setSelectedProduct(product) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ selected_product: product })
    .eq('id', (await supabase.auth.getUser()).data.user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── PROGRESS ─────────────────────────────────────────────────

/** Load all progress for the current user */
export async function getMyProgress() {
  const { data, error } = await supabase.rpc('get_my_progress');
  if (error) throw error;
  // Returns array; reshape to { qmetry: { moduleId: row }, reflect: { moduleId: row } }
  const out = { qmetry: {}, reflect: {} };
  for (const row of data || []) {
    if (out[row.product]) out[row.product][row.module_id] = row;
  }
  return out;
}

/**
 * Mark a module as viewed or completed.
 * @param {string} product - 'qmetry' | 'reflect'
 * @param {string} moduleId
 * @param {boolean} completed
 * @param {string} tier - 'basics' | 'intermediate' | 'advanced'
 */
export async function upsertModuleProgress(product, moduleId, completed = false, tier = 'basics') {
  const { data, error } = await supabase.rpc('upsert_module_progress', {
    p_product:   product,
    p_module_id: moduleId,
    p_completed: completed,
    p_tier:      tier,
  });
  if (error) throw error;
  return data;
}

// ── QUIZ ─────────────────────────────────────────────────────

/**
 * Save a finished quiz attempt.
 * @param {string} product
 * @param {string} moduleId
 * @param {number} score  - correct answers
 * @param {number} total  - total questions
 */
export async function recordQuizAttempt(product, moduleId, score, total) {
  const { data, error } = await supabase.rpc('record_quiz_attempt', {
    p_product:   product,
    p_module_id: moduleId,
    p_score:     score,
    p_total:     total,
  });
  if (error) throw error;
  return data;
}

/**
 * Get quiz history for a specific module.
 */
export async function getQuizHistory(product, moduleId) {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('score, total, pct, passed, attempted_at')
    .eq('product', product)
    .eq('module_id', moduleId)
    .order('attempted_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data;
}

// ── CHAT ─────────────────────────────────────────────────────

/** Save a single chat message */
export async function saveChatMessage(product, moduleId, role, content) {
  const { error } = await supabase.rpc('save_chat_message', {
    p_product:   product,
    p_module_id: moduleId,
    p_role:      role,
    p_content:   content,
  });
  if (error) console.warn('Chat save error:', error.message);
}

/** Load chat history for a module (last 50 messages) */
export async function getChatHistory(product, moduleId) {
  const { data, error } = await supabase.rpc('get_chat_history', {
    p_product:   product,
    p_module_id: moduleId,
    p_limit:     50,
  });
  if (error) throw error;
  return data || [];
}

// ── EVENTS ───────────────────────────────────────────────────

/** Fire-and-forget event logger */
export function logEvent(eventType, product = null, moduleId = null, meta = null) {
  supabase.rpc('log_event', {
    p_event_type: eventType,
    p_product:    product,
    p_module_id:  moduleId,
    p_meta:       meta,
  }).then(({ error }) => {
    if (error) console.warn('Event log error:', error.message);
  });
}

// ── ADMIN ────────────────────────────────────────────────────

/** Admin summary stats (requires service role or admin session) */
export async function getAdminSummary() {
  const { data, error } = await supabase.rpc('get_admin_summary');
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Admin: list all learners with their progress stats */
export async function getAdminLearners() {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, email, display_name, selected_product, created_at,
      module_progress (product, module_id, completed, highest_tier, last_viewed),
      quiz_attempts (product, module_id, pct, passed, attempted_at)
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Admin: recent events feed */
export async function getAdminEvents(limit = 50) {
  const { data, error } = await supabase
    .from('events')
    .select('*, profiles(email, display_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
