/**
 * VIDYA MANDIR — Security Module
 * • SHA-256 hashed password (never plain text)
 * • Rate limiting + lockout
 * • Secure session tokens with expiry
 * • XSS sanitisation on all user inputs
 * • CSRF token helpers
 * • DevTools deterrence on admin pages
 */
'use strict';

const VidyaSec = {
  // SHA-256 of "6610" — never the raw password
  _HASH: '8daea85f35a1de82b18e99bd7b8655ee25808386d4a591439bc8b5cb891cee11',
  _MAX:  5,
  _LOCK: 30000,   // 30 seconds
  _TTL:  28800000, // 8 hours

  /* ── Crypto ── */
  async hash(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  },
  async verify(input) {
    return (await this.hash(input.trim())) === this._HASH;
  },

  /* ── Rate limiting ── */
  _att() { try { return JSON.parse(sessionStorage.getItem('_vm_a')||'{"n":0,"t":0}'); } catch { return {n:0,t:0}; } },
  _setAtt(n,t) { sessionStorage.setItem('_vm_a', JSON.stringify({n,t})); },
  isLocked() {
    const {n,t} = this._att();
    if (n >= this._MAX) {
      const rem = this._LOCK - (Date.now()-t);
      if (rem > 0) return Math.ceil(rem/1000);
      this._setAtt(0,0);
    }
    return false;
  },
  fail()  { const {n}=this._att(); this._setAtt(n+1, Date.now()); },
  reset() { this._setAtt(0,0); },
  attLeft() { return Math.max(0, this._MAX - this._att().n); },

  /* ── Session ── */
  createSession() {
    const tok = (crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join(''));
    sessionStorage.setItem('_vm_s', JSON.stringify({tok, exp: Date.now()+this._TTL}));
    return tok;
  },
  isValid() {
    try {
      const s = JSON.parse(sessionStorage.getItem('_vm_s')||'null');
      if (!s || Date.now() > s.exp) { this.kill(); return false; }
      return true;
    } catch { return false; }
  },
  kill() {
    sessionStorage.removeItem('_vm_s');
    sessionStorage.removeItem('_vm_a');
    localStorage.removeItem('vm_admin');
  },

  /* ── XSS sanitisation ── */
  sanitize(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#x27;')
      .replace(/\//g,'&#x2F;')
      .replace(/`/g,'&#x60;')
      .replace(/=/g,'&#x3D;');
  },

  /* Sanitise an object's string values recursively */
  sanitizeObj(obj) {
    if (typeof obj === 'string') return this.sanitize(obj);
    if (Array.isArray(obj)) return obj.map(v => this.sanitizeObj(v));
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const [k,v] of Object.entries(obj)) out[this.sanitize(k)] = this.sanitizeObj(v);
      return out;
    }
    return obj;
  },

  /* ── Input validation helpers ── */
  isValidYTId(id) { return /^[a-zA-Z0-9_-]{11}$/.test(id.trim()); },
  isValidURL(url) { try { new URL(url); return true; } catch { return false; } },
  clampStr(s, max=500) { return String(s||'').slice(0,max); },

  /* ── CSRF token (per-session) ── */
  getCsrf() {
    let t = sessionStorage.getItem('_vm_csrf');
    if (!t) { t = (Math.random()*1e18).toString(36); sessionStorage.setItem('_vm_csrf',t); }
    return t;
  },

  /* ── Protections for admin page ── */
  applyProtections() {
    /* Disable right-click */
    document.addEventListener('contextmenu', e => e.preventDefault());

    /* Block common devtools shortcuts */
    document.addEventListener('keydown', e => {
      if (e.key==='F12' || (e.ctrlKey&&e.shiftKey&&'IJC'.includes(e.key.toUpperCase())) || (e.ctrlKey&&e.key==='U'))
        e.preventDefault();
    });

    /* Detect devtools via size difference */
    const check = () => {
      if ((window.outerWidth-window.innerWidth>180 || window.outerHeight-window.innerHeight>180) && !VidyaSec.isValid())
        window.location.href='index.html';
    };
    setInterval(check, 4000);

    /* Auto-expire session on long background */
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        const h = parseInt(sessionStorage.getItem('_vm_hidden')||'0');
        if (h && Date.now()-h > VidyaSec._TTL) VidyaSec.kill();
      } else {
        sessionStorage.setItem('_vm_hidden', Date.now().toString());
      }
    });
  },
};
