'use strict';
const App={
_data:null,
async loadData(){
  if(this._data)return this._data;
  try{const r=await fetch('data/subjects.json');if(!r.ok)throw 0;this._data=await r.json();}
  catch{this._data={subjects:[]};}
  this._mergeAdminData();return this._data;
},
_mergeAdminData(){
  if(!this._data)return;
  const ov=this._parseLS('vm_overrides',{});
  const ad=this._parseLS('vm_admin_data',{subjects:[],quiz:[],pdfs:[],ncertTopics:[],announcements:[],teachers:[],ncertHighlights:[]});
  this._data.subjects.forEach(s=>{
    s.chapters.forEach(ch=>{
      const key=`${s.id}::${ch.id}`;const o=ov[key];if(!o)return;
      if(o.lessons&&o.lessons.length)ch.lessons=o.lessons;
      else{
        if(o.videoId&&ch.lessons?.length)ch.lessons[0].videoId=o.videoId;
        if(o.lesson0Title&&ch.lessons?.length)ch.lessons[0].title=o.lesson0Title;
        if(o.extraLessons?.length)ch.lessons=[...(ch.lessons||[]),...o.extraLessons];
      }
      if(o.adminNote)ch._adminNote=o.adminNote;
      if(o.adminNotes)ch._adminNotes=o.adminNotes;
      if(o.extraTopics?.length)ch.ncertTopics=[...(ch.ncertTopics||[]),...o.extraTopics];
      if(o.extraQuiz?.length)ch.quiz=[...(ch.quiz||[]),...o.extraQuiz];
      if(o.replaceQuiz?.length)ch.quiz=o.replaceQuiz;
      if(o.highlights)ch._highlights=o.highlights;
    });
  });
  (ad.subjects||[]).forEach(cs=>{
    if(!this._data.subjects.find(s=>s.id===cs.id)){
      this._data.subjects.push({id:cs.id||this._slug(cs.name),name:cs.name,nameHi:cs.nameHi||'',icon:cs.icon||'📖',description:cs.desc||'',chapters:cs.chapters||[],gradient:`linear-gradient(135deg,${cs.color||'#C8822A'},#9A6218)`,glow:'rgba(200,130,42,.1)',bg:'rgba(200,130,42,.09)',border:'rgba(200,130,42,.22)',color:cs.color||'#C8822A'});
    }
  });
},
saveOverride(sid,cid,patch){const ov=this._parseLS('vm_overrides',{});const key=`${sid}::${cid}`;ov[key]={...(ov[key]||{}),...patch};this._saveLS('vm_overrides',ov);this._data=null;},
getOverride(sid,cid){return(this._parseLS('vm_overrides',{}))[`${sid}::${cid}`]||{};},
_parseLS(k,def){try{return JSON.parse(localStorage.getItem(k)||'null')??def;}catch{return def;}},
_saveLS(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}},
_slug(s){return(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');},
getSubject(id){return(this._data?.subjects||[]).find(s=>s.id===id)||null;},
getChapter(sid,cid){return(this.getSubject(sid)?.chapters||[]).find(c=>c.id===cid)||null;},
getParam(k){return new URLSearchParams(location.search).get(k);},
getProgress(){return this._parseLS('vm_prog',{});},
saveProgress(p){this._saveLS('vm_prog',p);},
_ep(p,sid){if(!p[sid])p[sid]={done:[],scores:{},last:null,watched:[]};},
markDone(sid,cid){const p=this.getProgress();this._ep(p,sid);if(!p[sid].done.includes(cid))p[sid].done.push(cid);this.saveProgress(p);this.updateStreak();},
saveScore(sid,cid,score,total){const p=this.getProgress();this._ep(p,sid);p[sid].scores[cid]={score,total,pct:Math.round(score/total*100),ts:Date.now()};this.saveProgress(p);},
setLast(sid,cid,title){const p=this.getProgress();this._ep(p,sid);p[sid].last={cid,title,ts:Date.now()};this.saveProgress(p);},
markWatched(sid,cid,lid){if(!lid)return;const p=this.getProgress();this._ep(p,sid);const key=`${cid}::${lid}`;if(!p[sid].watched.includes(key))p[sid].watched.push(key);this.saveProgress(p);},
getSubjPct(sid,subj){const p=this.getProgress()[sid]||{};return subj.chapters.length?Math.round(((p.done||[]).length/subj.chapters.length)*100):0;},
getBookmarks(){return this._parseLS('vm_bm',[]);},
toggleBookmark(sid,cid){const bm=this.getBookmarks();const key=`${sid}::${cid}`;const i=bm.indexOf(key);if(i>=0)bm.splice(i,1);else bm.push(key);this._saveLS('vm_bm',bm);return i<0;},
isBookmarked(sid,cid){return this.getBookmarks().includes(`${sid}::${cid}`);},
updateStreak(){const today=new Date().toDateString();const last=localStorage.getItem('vm_sdate');let s=parseInt(localStorage.getItem('vm_streak')||'0');if(last!==today){s=(last===new Date(Date.now()-86400000).toDateString())?s+1:1;localStorage.setItem('vm_streak',s);localStorage.setItem('vm_sdate',today);}},
applyMode(){document.documentElement.setAttribute('data-mode',localStorage.getItem('vm_mode')||'dark');document.documentElement.setAttribute('data-scheme',localStorage.getItem('vm_scheme')||'rajasthani');},
setMode(m){document.documentElement.setAttribute('data-mode',m);localStorage.setItem('vm_mode',m);document.querySelectorAll('.mt-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));const btn=document.getElementById('modeBtn');if(btn)btn.textContent=m==='dark'?'☀️':'🌙';},
toggleMode(){this.setMode((localStorage.getItem('vm_mode')||'dark')==='dark'?'light':'dark');},
setScheme(s){document.documentElement.setAttribute('data-scheme',s);localStorage.setItem('vm_scheme',s);document.querySelectorAll('.theme-tile').forEach(t=>t.classList.toggle('selected',t.dataset.scheme===s));App.toast('Theme changed ✨');},
navbarHTML(){
  const site=localStorage.getItem('vm_site_name')||'Vidya Mandir';
  return`<nav class="topnav" id="mainNav">
    <button class="mob-burger" onclick="App.toggleSidebar()">☰</button>
    <a href="index.html" class="nav-brand"><div class="nav-gem">🪷</div><div class="nav-wordmark"><span class="nav-title">${VidyaSec.sanitize(site)}</span><span class="nav-sub">Class 10 · NCERT · CBSE</span></div></a>
    <div class="nav-search"><span class="nav-sico">⌕</span><input type="text" id="searchInput" placeholder="Search chapters, topics…" autocomplete="off" oninput="App.doSearch(this.value)" onfocus="App.showSearch()" onblur="setTimeout(()=>App.hideSearch(),180)"><div class="search-drop" id="searchDrop"></div></div>
    <div class="nav-right">
      <button class="nav-ic" onclick="TodoPanel.toggle()" title="Tasks" id="todoNavBtn">✓<div class="notif-pip" id="todoNDot"></div></button>
      <button class="nav-ic" onclick="ThemeEngine.toggle()" title="Theme">🎨</button>
      <button class="nav-ic" id="modeBtn" onclick="App.toggleMode()">☀️</button>
      <div class="user-pill"><div class="user-av">छ</div><span class="user-nm">${VidyaSec.sanitize(localStorage.getItem('vm_username')||'Chhatra')}</span></div>
    </div>
  </nav>`;
},
sidebarHTML(active){
  const p=this.getProgress();
  const subs=[{id:'mathematics',name:'Ganit',icon:'📐'},{id:'science',name:'Vigyan',icon:'🔬'},{id:'social-science',name:'Samaj Vigyan',icon:'🌍'},{id:'english',name:'Angrezi',icon:'📚'}];
  const bm=this.getBookmarks().length;
  return`<aside class="sidebar" id="sidebar">
    <span class="sb-lbl">Navigate</span>
    <a href="dashboard.html" class="sb-link ${active==='dashboard'?'on':''}"><div class="sb-icon">🏛️</div>Dashboard</a>
    <a href="todo.html" class="sb-link ${active==='todo'?'on':''}"><div class="sb-icon">✅</div>My Tasks</a>
    <a href="bookmarks.html" class="sb-link ${active==='bookmarks'?'on':''}"><div class="sb-icon">🔖</div>Bookmarks${bm>0?` <span class="sb-badge">${bm}</span>`:''}</a>
    <div class="sb-div"></div>
    <span class="sb-lbl">Subjects</span>
    ${subs.map(s=>{const done=(p[s.id]?.done||[]).length;return`<a href="subject.html?id=${s.id}" class="sb-link ${active===s.id?'on':''}"><div class="sb-icon">${s.icon}</div>${s.name}${done>0?` <span class="sb-badge">${done}</span>`:''}</a>`;}).join('')}
    <div class="sb-div"></div>
    <a href="admin.html" class="sb-link ${active==='admin'?'on':''}" style="opacity:.4;font-size:.78rem"><div class="sb-icon" style="font-size:12px">⚙️</div>Admin</a>
  </aside>`;
},
themeHTML(){
  const schemes=[{id:'rajasthani',name:'Rajasthani',img:'assets/bg-pattern.png'},{id:'mandala',name:'Mandala',img:'assets/theme-mandala.png'},{id:'kalamkari',name:'Kalamkari',img:'assets/theme-kalamkari.png'},{id:'tanjore',name:'Tanjore',img:'assets/theme-tanjore.png'}];
  const cur=localStorage.getItem('vm_scheme')||'rajasthani';
  return`<div class="slide-panel" id="themePanel">
    <div class="sp-head"><h3>🎨 Theme</h3><button class="btn btn-gh btn-sm" onclick="ThemeEngine.toggle()">✕</button></div>
    <span class="sp-lbl">Heritage Theme</span>
    <div class="theme-grid">${schemes.map(s=>`<div class="theme-tile ${s.id===cur?'selected':''}" data-scheme="${s.id}" onclick="App.setScheme('${s.id}')"><img class="theme-art" src="${s.img}" alt="${s.name}" loading="lazy"><div class="theme-foot"><span>${s.name}</span><div class="theme-tick">✓</div></div></div>`).join('')}</div>
    <span class="sp-lbl">Display Mode</span>
    <div class="mode-toggle"><div class="mt-btn active" data-mode="dark" onclick="App.setMode('dark')">🌙 Dark</div><div class="mt-btn" data-mode="light" onclick="App.setMode('light')">☀️ Light</div></div>
    <span class="sp-lbl">Extract from Photo</span>
    <div class="upload-drop" onclick="document.getElementById('themeFileInp').click()">
      <input type="file" id="themeFileInp" accept="image/*" style="display:none" onchange="ThemeEngine.handleUpload(event)">
      <div style="font-size:26px;margin-bottom:6px">🖼️</div><p style="font-size:.82rem;color:var(--t2);font-weight:600;margin-bottom:2px">Upload any image</p><span style="font-size:.72rem;color:var(--t3)">Colours extracted automatically</span>
    </div>
    <div id="themePreviewWrap" style="display:none">
      <img id="themePreviewImg" src="" alt="" style="width:100%;height:78px;object-fit:cover;border-radius:8px;margin-bottom:8px">
      <div class="swatches-row" id="swatchRow"></div>
      <button class="btn btn-b" style="width:100%;margin-bottom:6px" onclick="ThemeEngine.applyExtracted()">✨ Apply Colours</button>
      <button class="btn btn-gh" style="width:100%" onclick="ThemeEngine.reset()">↺ Reset</button>
    </div>
  </div>
  <div class="backdrop" id="themeBack" onclick="ThemeEngine.toggle()"></div>`;
},
todoPanelHTML(){return`<div class="slide-panel" id="todoPanel"><div class="sp-head"><h3>📋 मेरे कार्य</h3><button class="btn btn-gh btn-sm" onclick="TodoPanel.toggle()">✕</button></div><div id="todoPanelBody"></div></div><div class="backdrop" id="todoBack" onclick="TodoPanel.toggle()"></div>`;},
async doSearch(q){
  const drop=document.getElementById('searchDrop');if(!drop)return;
  const sq=q.trim();if(!sq){drop.classList.remove('open');return;}
  const data=await this.loadData();const lq=sq.toLowerCase();const res=[];
  data.subjects.forEach(s=>{
    if(s.name.toLowerCase().includes(lq))res.push({icon:s.icon,title:s.name,sub:`${s.chapters.length} chapters`,url:`subject.html?id=${s.id}`});
    s.chapters.forEach(ch=>{
      if(ch.title.toLowerCase().includes(lq))res.push({icon:'📄',title:ch.title,sub:s.name,url:`chapter.html?subject=${s.id}&chapter=${ch.id}`});
      (ch.lessons||[]).forEach(l=>{if(l.title.toLowerCase().includes(lq))res.push({icon:'▶️',title:l.title,sub:`${s.name} › ${ch.title}`,url:`chapter.html?subject=${s.id}&chapter=${ch.id}&lesson=${l.id}`});});
      (ch.ncertTopics||[]).forEach(t=>{if(t.text.toLowerCase().includes(lq))res.push({icon:'⭐',title:t.text.slice(0,55),sub:`${s.name} › ${ch.title}`,url:`chapter.html?subject=${s.id}&chapter=${ch.id}`});});
    });
  });
  drop.innerHTML=res.length?res.slice(0,9).map(r=>`<div class="sd-row" onclick="location.href='${r.url}'"><div class="sd-ico">${r.icon}</div><div><div class="sd-title">${VidyaSec.sanitize(r.title)}</div><div class="sd-sub">${VidyaSec.sanitize(r.sub)}</div></div></div>`).join(''):`<div class="sd-row"><div class="sd-sub">No results</div></div>`;
  drop.classList.add('open');
},
showSearch(){const v=document.getElementById('searchInput')?.value;if(v)this.doSearch(v);},
hideSearch(){document.getElementById('searchDrop')?.classList.remove('open');},
toggleSidebar(){document.getElementById('sidebar')?.classList.toggle('open');document.getElementById('sbBack')?.classList.toggle('on');},
toast(msg,ico='✅'){let t=document.getElementById('appToast');if(!t){t=document.createElement('div');t.id='appToast';t.className='toast';t.setAttribute('role','alert');document.body.appendChild(t);}t.innerHTML=`<span>${ico}</span> ${VidyaSec.sanitize(msg)}`;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),3200);},
initPage(active){
  this.applyMode();
  const nb=document.getElementById('nb');const sb=document.getElementById('sb');
  if(nb)nb.innerHTML=this.navbarHTML();
  if(sb)sb.innerHTML=this.sidebarHTML(active);
  document.body.insertAdjacentHTML('beforeend',this.themeHTML());
  document.body.insertAdjacentHTML('beforeend',this.todoPanelHTML());
  document.body.insertAdjacentHTML('beforeend',`<div class="backdrop" id="sbBack" onclick="App.toggleSidebar()"></div>`);
  ThemeEngine.init();TodoPanel.init();
  const m=localStorage.getItem('vm_mode')||'dark';
  const btn=document.getElementById('modeBtn');if(btn)btn.textContent=m==='dark'?'☀️':'🌙';
  document.querySelectorAll('.mt-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));
}
};
