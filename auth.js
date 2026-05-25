// ============================================================
// auth.js  —  SmartBear Coach: Auth integration
// ============================================================
// Drop-in replacement for the demo password check in index.html.
// Requires supabase.js to be loaded first.
//
// To activate:
//   1. Fill in SUPABASE_URL + SUPABASE_ANON in supabase.js
//   2. Add this to index.html just before </body>:
//        <script type="module" src="auth.js"></script>
//   3. Remove or comment out the demo doLogin() function in index.html
// ============================================================

import {
  signIn, signUp, signOut,
  getSession, onAuthStateChange,
  getProfile, setSelectedProduct,
  getMyProgress, upsertModuleProgress,
  recordQuizAttempt, saveChatMessage,
  getChatHistory, logEvent
} from './supabase.js';

// ── SESSION RESTORE ──────────────────────────────────────────
// On page load, check if the user already has a valid session
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const session = await getSession();
    if (session) {
      await onAuthSuccess(session);
    }
  } catch (e) {
    console.warn('Session restore failed:', e.message);
  }
});

// Listen for auth state changes (token refresh, sign-out from another tab)
onAuthStateChange(async (session) => {
  if (session) {
    await onAuthSuccess(session);
  } else {
    // Session ended — go back to login
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
  }
});

// ── OVERRIDE LOGIN ───────────────────────────────────────────
// Replaces the demo doLogin() defined in index.html
window.doLogin = async function () {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl    = document.getElementById('loginError');
  errEl.textContent = '';

  if (!email)    { errEl.textContent = 'Please enter your email address.'; return; }
  if (!password) { errEl.textContent = 'Please enter your password.'; return; }

  const btn = document.querySelector('.login-btn');
  btn.textContent = 'Signing in…';
  btn.disabled = true;

  try {
    await signIn(email, password);
    // onAuthStateChange fires and calls onAuthSuccess
  } catch (err) {
    // Try sign-up if user not found (first-time users)
    if (err.message?.includes('Invalid login credentials')) {
      try {
        await signUp(email, password);
        errEl.textContent = 'Account created — check your email to confirm, then sign in.';
      } catch (signUpErr) {
        errEl.textContent = signUpErr.message || 'Sign-up failed.';
      }
    } else {
      errEl.textContent = err.message || 'Sign-in failed.';
    }
  } finally {
    btn.textContent = 'Sign in →';
    btn.disabled = false;
  }
};

// ── OVERRIDE LOGOUT ──────────────────────────────────────────
window.doLogout = async function () {
  try { await signOut(); } catch (e) { /* ignore */ }
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPass').value  = '';
  document.getElementById('loginError').textContent = '';
  document.getElementById('chatMessages').innerHTML = '';
};

// ── AUTH SUCCESS ─────────────────────────────────────────────
async function onAuthSuccess(session) {
  try {
    // Load profile + set product preference
    const profile = await getProfile();
    window.product = window.loginProduct || profile.selected_product || 'qmetry';

    // Restore progress from DB
    const progressData = await getMyProgress();
    // Merge into the in-memory completed object
    for (const [prod, modules] of Object.entries(progressData)) {
      for (const [modId, row] of Object.entries(modules)) {
        if (row.completed) {
          window.completed = window.completed || { qmetry: {}, reflect: {} };
          window.completed[prod][modId] = true;
        }
      }
    }

    // Show the app
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');

    logEvent('login', window.product);
    window.init();
  } catch (e) {
    console.error('Auth success handler failed:', e);
  }
}

// ── HOOK: MODULE VIEW ────────────────────────────────────────
// Intercept selectModule to persist views to Supabase
const _origSelectModule = window.selectModule;
window.selectModule = function(id) {
  _origSelectModule(id);
  upsertModuleProgress(window.product, id, false, window.activeTier || 'basics')
    .catch(e => console.warn('Progress save:', e.message));
  logEvent('module_view', window.product, id);
};

// ── HOOK: TIER CHANGE ────────────────────────────────────────
const _origSetTier = window.setTier;
window.setTier = function(tier) {
  _origSetTier(tier);
  upsertModuleProgress(window.product, window.activeModule, false, tier)
    .catch(e => console.warn('Tier save:', e.message));
};

// ── HOOK: QUIZ FINISH ────────────────────────────────────────
// Wrap finishQuiz to persist the attempt
const _origFinishQuiz = window.finishQuiz;
window.finishQuiz = async function() {
  _origFinishQuiz();
  try {
    await recordQuizAttempt(
      window.product,
      window.activeModule,
      window.quizScore,
      window.quizCards.length
    );
  } catch (e) {
    console.warn('Quiz record:', e.message);
  }
};

// ── HOOK: CHAT ───────────────────────────────────────────────
// Persist chat messages to Supabase
const _origSendChat = window.sendChat;
window.sendChat = async function() {
  const input = document.getElementById('chatInput');
  const q = input.value.trim();
  if (!q) return;

  // Save user message
  saveChatMessage(window.product, window.activeModule, 'user', q)
    .catch(e => console.warn('Chat user save:', e.message));

  // Call original (which also calls the API and renders response)
  await _origSendChat();

  // Note: coach reply is async inside sendChat — for full persistence
  // you'd patch the fetch callback. This saves user messages immediately.
};

// ── SAVE PRODUCT PREFERENCE ──────────────────────────────────
const _origSwitchProduct = window.switchProduct;
window.switchProduct = function(p) {
  _origSwitchProduct(p);
  setSelectedProduct(p).catch(e => console.warn('Product pref:', e.message));
};
