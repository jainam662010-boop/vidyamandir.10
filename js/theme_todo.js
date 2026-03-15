/* ══ THEME ENGINE ══ */
const ThemeEngine = {
  colors: [], _open: false,
  init() { this.loadSaved(); },
  toggle() {
    this._open = !this._open;
    document.getElementById('themePanel')?.classList.toggle('open', this._open);
    document.getElementById('themeBack')?.classList.toggle('on', this._open);
    if (this._open) document.getElementById('todoPanel')?.classList.remove('open');
  },
  handleUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        this.extract(img);
        const pi = document.getElementById('themePreviewImg'); if (pi) pi.src = ev.target.result;
        document.getElementById('themePreviewWrap')?.style.setProperty('display', 'block');
        try { localStorage.setItem('vm_theme_img', ev.target.result.slice(0, 45000)); } catch(e) {}
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  },
  extract(img) {
    const c = document.createElement('canvas'); c.width = c.height = 80;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, 80, 80);
    const d = ctx.getImageData(0, 0, 80, 80).data;
    const map = {};
    for (let i = 0; i < d.length; i += 12) {
      if (d[i+3] < 180) continue;
      const r = Math.round(d[i]/30)*30, g = Math.round(d[i+1]/30)*30, b = Math.round(d[i+2]/30)*30;
      const k = `${r},${g},${b}`; map[k] = (map[k] || 0) + 1;
    }
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const picked = [];
    for (const [k] of sorted) {
      const [r, g, b] = k.split(',').map(Number);
      const lum = 0.299*r + 0.587*g + 0.114*b;
      const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
      const sat = max === min ? 0 : (max - min) / (1 - Math.abs(max + min - 1));
      if (sat > 0.14 && lum > 38 && lum < 215) {
        const hex = this._hex(r, g, b);
        if (!picked.find(c => this._dist(c, hex) < 50)) picked.push(hex);
      }
      if (picked.length >= 6) break;
    }
    if (picked.length < 2) picked.push('#C8822A', '#B05838');
    this.colors = picked;
    const row = document.getElementById('swatchRow');
    if (row) row.innerHTML = picked.map(c => `<div class="swatch" style="background:${c}" title="${c}" onclick="ThemeEngine._apply1('${c}')"></div>`).join('');
  },
  applyExtracted() {
    if (!this.colors.length) return;
    this._applyVars(this.colors[0], this.colors[1] || this.colors[0], this.colors[2] || this.colors[0]);
    App.toast('Colours extracted from your photo! 🎨');
  },
  _apply1(hex) { this._applyVars(hex, this._lighten(hex, 18), this._darken(hex, 15)); App.toast('Colour applied!'); },
  applyPreset(name, colors) { this._applyVars(colors[0], colors[1], colors[2]); App.toast(`"${name}" theme applied ✨`); },
  _applyVars(brand, sec, acc) {
    const r = document.documentElement;
    r.style.setProperty('--saffron', brand);
    r.style.setProperty('--saffron-l', this._lighten(brand, 16));
    r.style.setProperty('--saffron-d', this._darken(brand, 14));
    r.style.setProperty('--terra', sec);
    r.style.setProperty('--terra-l', this._lighten(sec, 14));
    r.style.setProperty('--sage', acc);
    r.style.setProperty('--sage-l', this._lighten(acc, 14));
    try { localStorage.setItem('vm_custom_theme', JSON.stringify({ brand, sec, acc })); } catch(e) {}
  },
  reset() {
    ['--saffron','--saffron-l','--saffron-d','--terra','--terra-l','--sage','--sage-l'].forEach(v => document.documentElement.style.removeProperty(v));
    localStorage.removeItem('vm_custom_theme'); localStorage.removeItem('vm_theme_img');
    document.getElementById('themePreviewWrap')?.style.setProperty('display', 'none');
    App.toast('Theme reset to default ↺');
  },
  loadSaved() {
    const s = localStorage.getItem('vm_custom_theme');
    if (s) { try { const {brand,sec,acc} = JSON.parse(s); this._applyVars(brand, sec, acc); } catch(e) {} }
    const img = localStorage.getItem('vm_theme_img');
    if (img) { const pi = document.getElementById('themePreviewImg'); if (pi) { pi.src = img; document.getElementById('themePreviewWrap')?.style.setProperty('display','block'); } }
  },
  _hex(r,g,b) { return '#' + [r,g,b].map(x => Math.min(255,Math.max(0,x)).toString(16).padStart(2,'0')).join(''); },
  _rgb(hex) { const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return m ? [parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)] : [200,130,42]; },
  _dist(h1,h2) { const [r1,g1,b1]=this._rgb(h1),[r2,g2,b2]=this._rgb(h2); return Math.sqrt((r1-r2)**2+(g1-g2)**2+(b1-b2)**2); },
  _lighten(hex,a) { const [r,g,b]=this._rgb(hex); return this._hex(r+a*2,g+a*2,b+a*2); },
  _darken(hex,a)  { const [r,g,b]=this._rgb(hex); return this._hex(r-a*2,g-a*2,b-a*2); },
};

/* ══ TODO PANEL ══ */
const TodoPanel = {
  _open: false, filter: 'all',
  init() { this.updateDot(); },
  getData() { return JSON.parse(localStorage.getItem('vm_todos') || '[]'); },
  saveData(d) { localStorage.setItem('vm_todos', JSON.stringify(d)); },
  toggle() {
    this._open = !this._open;
    document.getElementById('todoPanel')?.classList.toggle('open', this._open);
    document.getElementById('todoBack')?.classList.toggle('on', this._open);
    if (this._open) { document.getElementById('themePanel')?.classList.remove('open'); this.renderPanel(); }
  },
  updateDot() {
    const n = this.getData().filter(t => !t.done && t.due && new Date(t.due) < new Date()).length;
    const d = document.getElementById('todoNDot');
    if (d) d.style.display = n > 0 ? 'block' : 'none';
  },
  renderPanel() {
    const body = document.getElementById('todoPanelBody'); if (!body) return;
    const all = this.getData();
    const filtered = this.filter === 'pending' ? all.filter(t => !t.done) : this.filter === 'done' ? all.filter(t => t.done) : all;
    body.innerHTML = `
      <div style="display:flex;gap:7px;margin-bottom:12px;flex-wrap:wrap">
        <span class="chip chip-b">📋 ${all.length}</span>
        <span class="chip chip-a">⏳ ${all.filter(t=>!t.done).length} pending</span>
        <span class="chip chip-tl">✅ ${all.filter(t=>t.done).length} done</span>
      </div>
      <div class="todo-add-row">
        <input class="todo-inp" id="panelIn" placeholder="Quick task…" onkeydown="if(event.key==='Enter')TodoPanel.quickAdd()">
        <button class="btn btn-b btn-sm" onclick="TodoPanel.quickAdd()">+</button>
      </div>
      <div class="filter-tabs" style="margin-bottom:12px">
        ${['all','pending','done'].map(f => `<div class="ftab ${this.filter===f?'active':''}" onclick="TodoPanel.setFilter('${f}')">${f[0].toUpperCase()+f.slice(1)}</div>`).join('')}
      </div>
      <div class="todo-items">${filtered.length ? filtered.map(t => this.itemHTML(t)).join('') : '<div style="text-align:center;padding:20px;color:var(--t3);font-size:.84rem">✨ All clear here</div>'}</div>
      <br>
      <a href="todo.html" class="btn btn-gh" style="width:100%;justify-content:center">Open Task Manager →</a>`;
  },
  itemHTML(t) {
    const late = t.due && !t.done && new Date(t.due) < new Date();
    const subColors = { mathematics: 'var(--saffron)', science: 'var(--sage-l)', 'social-science': 'var(--terra-l)', english: 'var(--indigo-l)', general: 'var(--t3)' };
    const col = subColors[t.subject] || 'var(--t3)';
    return `<div class="todo-item ${t.done ? 'is-done' : ''}" data-id="${t.id}">
      <div class="todo-cb ${t.done ? 'checked' : ''}" onclick="TodoPanel.toggleItem('${t.id}')">${t.done ? '✓' : ''}</div>
      <div style="flex:1;min-width:0">
        <div class="todo-txt">${t.text}</div>
        <div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap;align-items:center">
          ${t.subject && t.subject !== 'general' ? `<span style="font-size:.67rem;font-weight:800;color:${col}">${t.subject.replace('-',' ')}</span>` : ''}
          ${t.due ? `<span class="due-chip ${late ? 'late' : ''}">${late ? '⚠ late' : '📅 ' + new Date(t.due).toLocaleDateString('en-IN', {day:'numeric',month:'short'})}</span>` : ''}
          ${t.priority === 'high' ? `<span class="chip chip-a" style="font-size:.63rem;padding:1px 6px">● High</span>` : ''}
          ${t.marks ? `<span class="chip chip-b" style="font-size:.63rem;padding:1px 6px">${t.marks}M</span>` : ''}
        </div>
      </div>
      <div class="todo-del" onclick="TodoPanel.deleteItem('${t.id}')">✕</div>
    </div>`;
  },
  setFilter(f) {
    this.filter = f;
    if (document.getElementById('panelIn')) this.renderPanel();
    if (document.getElementById('fullTodoList')) TodoPage.render();
  },
  quickAdd() {
    const inp = document.getElementById('panelIn');
    const text = inp?.value.trim(); if (!text) return;
    this.add(text, 'general', '', 'normal', '');
    inp.value = ''; this.renderPanel();
    App.toast('Task added! ✅');
  },
  add(text, subject, due, priority, marks) {
    const todos = this.getData();
    todos.unshift({ id: Date.now().toString(), text, subject: subject || 'general', due: due || '', priority: priority || 'normal', marks: marks || '', done: false, ts: Date.now() });
    this.saveData(todos); this.updateDot();
  },
  toggleItem(id) {
    const todos = this.getData();
    const t = todos.find(t => t.id === id);
    if (t) t.done = !t.done;
    this.saveData(todos); this.updateDot();
    if (document.getElementById('panelIn')) this.renderPanel();
    if (document.getElementById('fullTodoList')) TodoPage.render();
  },
  deleteItem(id) {
    this.saveData(this.getData().filter(t => t.id !== id));
    this.updateDot();
    if (document.getElementById('panelIn')) this.renderPanel();
    if (document.getElementById('fullTodoList')) TodoPage.render();
  },
};

/* ══ FULL TODO PAGE ══ */
const TodoPage = {
  filter: 'all', searchQ: '',
  render() {
    const all = TodoPanel.getData();
    let items = all;
    if (this.filter === 'pending') items = all.filter(t => !t.done);
    else if (this.filter === 'done') items = all.filter(t => t.done);
    else if (this.filter === 'overdue') items = all.filter(t => !t.done && t.due && new Date(t.due) < new Date());
    else if (this.filter === 'high') items = all.filter(t => t.priority === 'high' && !t.done);
    if (this.searchQ) items = items.filter(t => t.text.toLowerCase().includes(this.searchQ));

    const done = all.filter(t => t.done).length;
    const pct = all.length ? Math.round(done / all.length * 100) : 0;
    const late = all.filter(t => !t.done && t.due && new Date(t.due) < new Date()).length;

    const sEl = document.getElementById('todo-stats');
    if (sEl) sEl.innerHTML = `
      <div class="stat-tile"><div class="stat-ico">📋</div><div><div class="stat-num">${all.length}</div><div class="stat-label">Total</div></div></div>
      <div class="stat-tile"><div class="stat-ico">⏳</div><div><div class="stat-num">${all.filter(t=>!t.done).length}</div><div class="stat-label">Pending</div></div></div>
      <div class="stat-tile"><div class="stat-ico">✅</div><div><div class="stat-num">${done}</div><div class="stat-label">Done</div></div></div>
      <div class="stat-tile"><div class="stat-ico">⚠️</div><div><div class="stat-num">${late}</div><div class="stat-label">Overdue</div></div></div>`;
    const pctEl = document.getElementById('todo-pct'); if (pctEl) pctEl.textContent = pct + '%';
    const pfEl = document.getElementById('todo-pf'); if (pfEl) pfEl.style.width = pct + '%';
    const list = document.getElementById('fullTodoList'); if (!list) return;
    list.innerHTML = !items.length
      ? `<div style="text-align:center;padding:52px;color:var(--t3)"><div style="font-size:44px;margin-bottom:12px">🪷</div><div style="font-size:.88rem">No tasks here. Start adding!</div></div>`
      : items.map(t => TodoPanel.itemHTML(t)).join('');
  },
  addTask() {
    const text = document.getElementById('ftText')?.value.trim();
    const subj = document.getElementById('ftSubj')?.value || 'general';
    const due  = document.getElementById('ftDue')?.value || '';
    const pri  = document.getElementById('ftPri')?.value || 'normal';
    const marks= document.getElementById('ftMarks')?.value || '';
    if (!text) { App.toast('Please enter a task!', '⚠️'); return; }
    TodoPanel.add(text, subj, due, pri, marks);
    document.getElementById('ftText').value = '';
    document.getElementById('ftDue').value = '';
    if (document.getElementById('ftMarks')) document.getElementById('ftMarks').value = '';
    this.render(); App.toast('Task added! ✅');
  },
  setFilter(f) {
    this.filter = f;
    document.querySelectorAll('[data-tf]').forEach(b => b.classList.toggle('active', b.dataset.tf === f));
    this.render();
  },
  clearDone() {
    if (!confirm('Clear all completed tasks?')) return;
    TodoPanel.saveData(TodoPanel.getData().filter(t => !t.done));
    TodoPanel.updateDot(); this.render(); App.toast('Cleared completed tasks 🗑️');
  },
};
