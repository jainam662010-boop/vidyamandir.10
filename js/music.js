/**
 * VIDYA MANDIR — Ambient Music Player
 * Indian sitar background music with persistent
 * state, floating controls, and user preferences.
 */
'use strict';

const MusicPlayer = {
  _audio: null,
  _vol: 0.25,      // default volume (quiet ambient)
  _ui: null,
  _fadeTimer: null,

  init() {
    // Don't auto-play if user previously muted
    const prefs = this._prefs();
    this._vol = prefs.vol ?? 0.25;
    const muted = prefs.muted ?? true; // default OFF until user enables

    this._audio = new Audio('assets/bg-music.mp3');
    this._audio.loop   = true;
    this._audio.volume = this._vol;
    this._audio.preload = 'none'; // don't load until user presses play

    this._buildUI(muted);
    if (!muted) this._play();
  },

  _buildUI(muted) {
    const el = document.createElement('div');
    el.id = 'musicWidget';
    el.innerHTML = `
      <div id="mw-inner" title="${muted ? 'Play ambient music' : 'Music playing'}">
        <button id="mw-btn" onclick="MusicPlayer.toggle()" aria-label="Toggle music">
          <span id="mw-icon">${muted ? '🎵' : '🎶'}</span>
        </button>
        <div id="mw-panel">
          <div id="mw-label">🪕 Sitar Ambience</div>
          <div id="mw-controls">
            <input id="mw-vol" type="range" min="0" max="1" step="0.05"
              value="${this._vol}" oninput="MusicPlayer.setVol(this.value)"
              aria-label="Music volume">
            <span id="mw-vol-lbl">${Math.round(this._vol*100)}%</span>
          </div>
          <div id="mw-status">${muted ? '⏸ Off' : '▶ Playing'}</div>
        </div>
      </div>`;
    el.style.cssText = `
      position:fixed; bottom:22px; left:22px; z-index:800;
      font-family:var(--fu,'Plus Jakarta Sans',sans-serif);
    `;
    document.body.appendChild(el);
    this._ui = el;

    // Inject styles once
    if (!document.getElementById('mw-style')) {
      const s = document.createElement('style');
      s.id = 'mw-style';
      s.textContent = `
        #mw-inner { position:relative; display:flex; align-items:center; gap:0; }

        #mw-btn {
          width:40px; height:40px; border-radius:50%;
          background:var(--gl2,rgba(30,22,14,.92));
          border:1px solid var(--bdr2,rgba(200,130,42,.4));
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          font-size:17px; transition:all .2s;
          box-shadow:0 4px 16px rgba(0,0,0,.5), 0 0 0 0 rgba(200,130,42,.4);
          position:relative; z-index:2; flex-shrink:0;
        }
        #mw-btn:hover {
          transform:scale(1.12);
          box-shadow:0 4px 20px rgba(0,0,0,.6), 0 0 0 6px rgba(200,130,42,.15);
        }
        #mw-btn.playing {
          animation: mw-pulse 3s ease-in-out infinite;
          border-color: rgba(var(--br,200,130,42),.7);
        }
        @keyframes mw-pulse {
          0%,100% { box-shadow:0 4px 16px rgba(0,0,0,.5), 0 0 0 0 rgba(var(--br,200,130,42),.5); }
          50%      { box-shadow:0 4px 16px rgba(0,0,0,.5), 0 0 0 8px rgba(var(--br,200,130,42),0); }
        }

        #mw-panel {
          position:absolute; bottom:0; left:50px;
          background:var(--gl2,rgba(30,22,14,.95));
          border:1px solid var(--bdr2,rgba(200,130,42,.4));
          border-radius:12px; padding:12px 14px;
          width:190px; opacity:0; pointer-events:none;
          transform:translateX(-8px) scale(.95);
          transition:all .22s cubic-bezier(.25,1,.5,1);
          box-shadow:0 8px 32px rgba(0,0,0,.6);
          backdrop-filter:blur(16px);
        }
        #mw-inner:hover #mw-panel,
        #mw-inner:focus-within #mw-panel {
          opacity:1; pointer-events:all; transform:translateX(0) scale(1);
        }

        #mw-label {
          font-size:.72rem; font-weight:800; color:rgba(200,130,42,.9);
          text-transform:uppercase; letter-spacing:.08em; margin-bottom:9px;
        }
        #mw-controls {
          display:flex; align-items:center; gap:8px; margin-bottom:7px;
        }
        #mw-vol {
          flex:1; -webkit-appearance:none; height:3px;
          background:linear-gradient(90deg, rgba(200,130,42,.8) var(--pct,25%), rgba(255,255,255,.12) 0);
          border-radius:99px; cursor:pointer; outline:none;
        }
        #mw-vol::-webkit-slider-thumb {
          -webkit-appearance:none; width:13px; height:13px;
          border-radius:50%; background:rgba(200,130,42,.9);
          cursor:pointer; border:2px solid rgba(255,255,255,.3);
          box-shadow:0 1px 4px rgba(0,0,0,.4);
        }
        #mw-vol-lbl {
          font-size:.68rem; color:rgba(255,255,255,.45); min-width:28px; text-align:right;
        }
        #mw-status {
          font-size:.7rem; color:rgba(255,255,255,.35); text-align:right;
        }

        /* Light mode */
        [data-mode="light"] #mw-btn {
          background:rgba(255,252,245,.94);
          border-color:rgba(200,130,42,.4);
        }
        [data-mode="light"] #mw-panel {
          background:rgba(255,252,245,.97);
        }
        [data-mode="light"] #mw-status { color:rgba(0,0,0,.35); }
        [data-mode="light"] #mw-vol-lbl { color:rgba(0,0,0,.35); }
      `;
      document.head.appendChild(s);
    }

    // Reflect saved state
    this._updateUI(!muted);
  },

  toggle() {
    if (!this._audio) return;
    if (this._audio.paused) this._play();
    else this._pause();
  },

  _play() {
    if (!this._audio) return;
    // Browsers block autoplay; play() returns a Promise
    this._audio.play().then(() => {
      this._updateUI(true);
      this._savePrefs(false);
    }).catch(() => {
      // Autoplay blocked — silently keep paused state
      this._updateUI(false);
    });
  },

  _pause() {
    this._fadeOut(() => {
      this._audio.pause();
      this._updateUI(false);
      this._savePrefs(true);
    });
  },

  _fadeOut(cb) {
    clearInterval(this._fadeTimer);
    const step = this._vol / 15;
    let v = this._audio.volume;
    this._fadeTimer = setInterval(() => {
      v = Math.max(0, v - step);
      this._audio.volume = v;
      if (v <= 0) { clearInterval(this._fadeTimer); cb(); this._audio.volume = this._vol; }
    }, 40);
  },

  _fadeIn() {
    clearInterval(this._fadeTimer);
    this._audio.volume = 0;
    const target = this._vol;
    const step = target / 20;
    this._fadeTimer = setInterval(() => {
      const v = Math.min(target, this._audio.volume + step);
      this._audio.volume = v;
      if (v >= target) clearInterval(this._fadeTimer);
    }, 50);
  },

  setVol(v) {
    this._vol = parseFloat(v);
    this._audio.volume = this._vol;
    const lbl = document.getElementById('mw-vol-lbl');
    if (lbl) lbl.textContent = Math.round(this._vol * 100) + '%';
    // Update CSS gradient on range
    const range = document.getElementById('mw-vol');
    if (range) range.style.setProperty('--pct', Math.round(this._vol*100)+'%');
    this._savePrefs(this._audio.paused);
  },

  _updateUI(playing) {
    const btn  = document.getElementById('mw-btn');
    const icon = document.getElementById('mw-icon');
    const stat = document.getElementById('mw-status');
    if (btn)  btn.classList.toggle('playing', playing);
    if (icon) icon.textContent = playing ? '🎶' : '🎵';
    if (stat) stat.textContent = playing ? '▶ Playing' : '⏸ Off';
    // Update vol track
    const range = document.getElementById('mw-vol');
    if (range) range.style.setProperty('--pct', Math.round(this._vol*100)+'%');
  },

  _prefs() { try { return JSON.parse(localStorage.getItem('vm_music')||'{}'); } catch { return {}; } },
  _savePrefs(muted) {
    try { localStorage.setItem('vm_music', JSON.stringify({ muted, vol: this._vol })); } catch(e) {}
  },
};

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MusicPlayer.init());
} else {
  MusicPlayer.init();
}
