'use strict';
/**
 * VIDYA MANDIR — Admin CMS v5
 * Key additions vs v4:
 *  • Full lesson management per built-in chapter (add/edit/delete/reorder)
 *  • Text-format notes parser  (## Heading / ** Key point / >> Example etc.)
 *  • Text-format quiz parser   (Q: … / A: / B: / C: / D: / ANS: B)
 *  • YT link auto-extraction   (paste full URL or just ID)
 *  • NCERT highlights manager  (text + page ref + colour)
 *  • All inputs sanitised, validated
 */

/* ─── Text parsers ─── */
const Parsers = {
  /* Extract YouTube video ID from URL or bare ID */
  ytId(input) {
    const s = (input||'').trim();
    // Direct 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
    // youtu.be/ID
    const short = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (short) return short[1];
    // youtube.com/watch?v=ID
    const long  = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (long) return long[1];
    // youtube.com/embed/ID
    const embed = s.match(/embed\/([a-zA-Z0-9_-]{11})/);
    if (embed) return embed[1];
    return null;
  },

  /* Parse plain-text notes into blocks
     Supported tokens:
       ## Heading
       **Key point text
       >> Example question | Answer
       :: formula text
       (blank line) = paragraph break
       anything else = body text
  */
  notes(raw) {
    const lines = (raw||'').split('\n');
    const blocks = [];
    let buf = [];
    const flush = () => { if(buf.length){blocks.push({type:'text',text:buf.join('\n').trim()});buf=[];} };
    lines.forEach(line => {
      const t = line.trim();
      if (!t) { flush(); return; }
      if (t.startsWith('## ')) { flush(); blocks.push({type:'heading',text:t.slice(3)}); return; }
      if (t.startsWith('**')) { flush(); blocks.push({type:'keypoint',text:t.slice(2)}); return; }
      if (t.startsWith('::')) { flush(); blocks.push({type:'formula',text:t.slice(2).trim()}); return; }
      if (t.startsWith('>>')) {
        flush();
        const parts=t.slice(2).split('|');
        blocks.push({type:'example',question:parts[0]?.trim()||'',answer:parts[1]?.trim()||''});
        return;
      }
      if (t.startsWith('>>>')) { flush(); blocks.push({type:'intro',text:t.slice(3).trim()}); return; }
      buf.push(t);
    });
    flush();
    return blocks;
  },

  /* Parse text-format quiz
     Format (one question block):
       Q: What is the value of sin 30°?
       A: 0
       B: 1/2
       C: 1
       D: √3/2
       ANS: B
       DIFF: easy   (optional)
       MARKS: 1     (optional)
       ---          (separator between questions)
  */
  quiz(raw) {
    const questions = [];
    const blocks = (raw||'').split(/^---+$/m).map(b=>b.trim()).filter(Boolean);
    blocks.forEach(block => {
      const lines = block.split('\n').map(l=>l.trim()).filter(Boolean);
      let q='', opts=[], ans=0, diff='medium', marks='1';
      const optMap={A:0,B:1,C:2,D:3,E:4};
      lines.forEach(l=>{
        if(l.startsWith('Q:'))  q=l.slice(2).trim();
        else if(/^[A-E]:/.test(l)) opts.push(l.slice(2).trim());
        else if(l.startsWith('ANS:'))   ans=optMap[l.slice(4).trim().toUpperCase()]||0;
        else if(l.startsWith('DIFF:'))  diff=l.slice(5).trim().toLowerCase();
        else if(l.startsWith('MARKS:')) marks=l.slice(6).trim();
      });
      if(q && opts.length>=2) questions.push({q,options:opts,answer:ans,difficulty:diff,marks});
    });
    return questions;
  }
};

/* ─── Admin main object ─── */
const Admin = {
  _section: 'overview',
  _editingLesson: null, // {sid, cid, idx} when editing a lesson

  init() {
    VidyaSec.applyProtections();
    if (VidyaSec.isValid()) this._show();
    else this._showLogin();
  },
  _showLogin() { document.getElementById('loginWall').style.display='flex'; document.getElementById('adminBody').style.display='none'; },
  _show()      { document.getElementById('loginWall').style.display='none'; document.getElementById('adminBody').style.display='block'; this.switchSection('overview'); this.refresh(); },

  async tryLogin() {
    const btn=document.getElementById('loginBtn'), err=document.getElementById('loginErr'), inp=document.getElementById('adminPass');
    if(!inp||!err||!btn) return;
    const secs=VidyaSec.isLocked();
    if(secs){err.textContent=`Too many attempts. Wait ${secs}s.`;err.classList.add('show');return;}
    btn.disabled=true; btn.textContent='Verifying…';
    const ok=await VidyaSec.verify(inp.value||'');
    if(ok){VidyaSec.createSession();VidyaSec.reset();inp.value='';this._show();}
    else{VidyaSec.fail();const rem=VidyaSec.attLeft();err.textContent=rem>0?`Incorrect. ${rem} attempt${rem!==1?'s':''} remaining.`:'Locked. Wait 30 seconds.';err.classList.add('show');inp.value='';inp.focus();}
    btn.disabled=false; btn.textContent='Sign In →';
  },
  logout() { VidyaSec.kill(); location.href='index.html'; },

  getData()     { return App._parseLS('vm_admin_data',{subjects:[],quiz:[],pdfs:[],ncertTopics:[],announcements:[],teachers:[],ncertHighlights:[]}); },
  saveData(d)   { App._saveLS('vm_admin_data',d); },

  switchSection(id) {
    this._section=id;
    document.querySelectorAll('.a-panel').forEach(p=>p.classList.remove('on'));
    document.querySelectorAll('.al-link').forEach(l=>l.classList.remove('on'));
    document.getElementById('ap-'+id)?.classList.add('on');
    document.getElementById('al-'+id)?.classList.add('on');
    this.refresh();
  },

  refresh() {
    this._rStats(); this._rBuiltin(); this._rSubj(); this._rCh();
    this._rPDF(); this._rNCERT(); this._rQuiz(); this._rAnn();
    this._rTeachers(); this._rProgress(); this._rTodos(); this._rSettings();
    this._rHighlights();
  },

  /* ── Stats ── */
  _rStats() {
    const d=this.getData(); const el=document.getElementById('admin-stats'); if(!el) return;
    el.innerHTML=`
      <div class="stat-tile"><div class="stat-ico">📁</div><div><div class="stat-num">${d.pdfs.length}</div><div class="stat-lbl">PDFs</div></div></div>
      <div class="stat-tile"><div class="stat-ico">⭐</div><div><div class="stat-num">${d.ncertTopics.length}</div><div class="stat-lbl">Topics</div></div></div>
      <div class="stat-tile"><div class="stat-ico">🧠</div><div><div class="stat-num">${d.quiz.length}</div><div class="stat-lbl">Quiz Qs</div></div></div>
      <div class="stat-tile"><div class="stat-ico">📢</div><div><div class="stat-num">${(d.announcements||[]).length}</div><div class="stat-lbl">Notices</div></div></div>`;
  },

  /* ── Built-in Chapter Editor ─────────────────────────────
     Per chapter: manage ALL lessons (add/edit/delete/reorder)
     + Notes (text-format paste)  + Quiz (text-format paste)
     + Teacher note  + Extra NCERT topics
  ──────────────────────────────────────────────────────── */
  _BUILTIN:[
    {sid:'mathematics',cid:'real-numbers',name:'Real Numbers'},
    {sid:'mathematics',cid:'polynomials',name:'Polynomials'},
    {sid:'mathematics',cid:'linear-equations',name:'Linear Equations'},
    {sid:'mathematics',cid:'triangles',name:'Triangles'},
    {sid:'mathematics',cid:'trigonometry',name:'Trigonometry'},
    {sid:'science',cid:'chemical-reactions',name:'Chemical Reactions'},
    {sid:'science',cid:'acids-bases',name:'Acids, Bases & Salts'},
    {sid:'science',cid:'life-processes',name:'Life Processes'},
    {sid:'science',cid:'metals-nonmetals',name:'Metals & Non-metals'},
    {sid:'science',cid:'carbon-compounds',name:'Carbon Compounds'},
    {sid:'social-science',cid:'nationalism-europe',name:'Nationalism in Europe'},
    {sid:'social-science',cid:'resources-development',name:'Resources & Development'},
    {sid:'social-science',cid:'power-sharing',name:'Power Sharing'},
    {sid:'social-science',cid:'development',name:'Development'},
    {sid:'english',cid:'a-letter-to-god',name:'A Letter to God'},
    {sid:'english',cid:'nelson-mandela',name:'Nelson Mandela'},
    {sid:'english',cid:'grammar-writing',name:'Grammar & Writing'},
    {sid:'english',cid:'his-first-flight',name:'His First Flight'},
  ],

  _rBuiltin() {
    const el=document.getElementById('builtin-select'); if(!el) return;
    // Chapter selector
    el.innerHTML='<option value="">— Select Chapter —</option>'+this._BUILTIN.map(b=>`<option value="${b.sid}::${b.cid}">${b.sid.replace('-',' ')} › ${b.name}</option>`).join('');
    this._refreshBuiltinEditor();
  },

  _refreshBuiltinEditor() {
    const sel=document.getElementById('builtin-select')?.value;
    const panel=document.getElementById('builtin-editor'); if(!panel) return;
    if(!sel){panel.innerHTML='<div style="color:var(--t3);text-align:center;padding:24px">Select a chapter above to edit it</div>';return;}
    const[sid,cid]=sel.split('::');
    const ov=App.getOverride(sid,cid);
    // Get effective lessons (overridden or base)
    App._data=null; // ensure fresh merge
    App.loadData().then(()=>{
      const ch=App.getChapter(sid,cid); const lessons=ch?.lessons||[];
      panel.innerHTML=`
        <div style="margin-bottom:18px">
          <div class="admin-sec-title" style="font-size:.88rem">▶ Lessons <span style="font-size:.75rem;color:var(--t3);margin-left:6px">${lessons.length} total</span></div>
          <div id="lesson-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
            ${lessons.map((l,i)=>`<div class="lesson-edit-row" data-i="${i}" style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:9px">
              <span style="font-size:.7rem;color:var(--t3);font-family:monospace;flex-shrink:0">${i+1}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:.83rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${VidyaSec.sanitize(l.title)}</div>
                <div style="font-size:.7rem;color:var(--t3)">
                  ID: ${VidyaSec.sanitize(l.videoId||'—')} &nbsp;·&nbsp; ${l.duration||'—'}
                  &nbsp;·&nbsp; <a href="https://www.youtube.com/watch?v=${VidyaSec.sanitize(l.videoId)}" target="_blank" rel="noopener" style="color:var(--b)">▶ Preview</a>
                </div>
              </div>
              <button class="btn btn-gh btn-sm" onclick="Admin.editLesson('${sid}','${cid}',${i})">Edit</button>
              <button class="btn btn-dn btn-sm" onclick="Admin.deleteLesson('${sid}','${cid}',${i})">✕</button>
            </div>`).join('')}
          </div>
          <div class="gcard" style="padding:14px">
            <div style="font-size:.8rem;font-weight:700;color:var(--bl);margin-bottom:10px" id="lesson-form-title">➕ Add New Lesson</div>
            <div class="fg2">
              <div class="fg"><label>YouTube URL or Video ID *</label><input class="fc" id="l-url" placeholder="https://youtube.com/watch?v=... or 11-char ID"></div>
              <div class="fg"><label>Lesson Title *</label><input class="fc" id="l-title" placeholder="e.g. Introduction to Real Numbers"></div>
            </div>
            <div class="fg2">
              <div class="fg"><label>Duration</label><input class="fc" id="l-dur" placeholder="e.g. 14:30"></div>
              <div class="fg"><label>Lesson ID</label><input class="fc" id="l-id" placeholder="e.g. l3 (auto if blank)"></div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-b" onclick="Admin.saveLesson('${sid}','${cid}')">Save Lesson</button>
              <button class="btn btn-gh" onclick="Admin.cancelEditLesson()">Cancel</button>
            </div>
          </div>
        </div>

        <div style="margin-bottom:18px">
          <div class="admin-sec-title" style="font-size:.88rem">📝 Teacher's Note (shown at top)</div>
          <textarea class="fc fc-ta" id="b-note" style="min-height:65px" placeholder="Short note from teacher shown at top of chapter…">${VidyaSec.sanitize(ov.adminNote||'')}</textarea>
          <button class="btn btn-b btn-sm" style="margin-top:6px" onclick="Admin._saveOv('${sid}','${cid}','adminNote',document.getElementById('b-note').value)">Save Note</button>
        </div>

        <div style="margin-bottom:18px">
          <div class="admin-sec-title" style="font-size:.88rem">📄 Notes (Paste Text Format)</div>
          <div style="font-size:.74rem;color:var(--t3);margin-bottom:8px;background:var(--bg3);border-radius:8px;padding:10px;line-height:1.8">
            <strong style="color:var(--bl)">Format guide:</strong><br>
            <code style="color:var(--b)">>>> Intro text</code> → intro box &nbsp;|&nbsp;
            <code style="color:var(--b)">## Heading</code> → section heading<br>
            <code style="color:var(--b)">** Key point</code> → highlighted point &nbsp;|&nbsp;
            <code style="color:var(--b)">:: formula</code> → formula box<br>
            <code style="color:var(--b)">>> Question | Answer</code> → example &nbsp;|&nbsp;
            plain text → body paragraph
          </div>
          <textarea class="fc fc-ta" id="b-notes-raw" style="min-height:180px;font-family:var(--fm);font-size:.82rem" placeholder=">>> This chapter covers real numbers and their properties.

## Euclid's Division Lemma
** For positive integers a and b: a = bq + r where 0 ≤ r < b

:: a = bq + r  →  HCF(a,b) = HCF(b,r)

>> Find HCF of 135 and 225 | 225 = 135×1 + 90, then 135 = 90×1 + 45, then 90 = 45×2 + 0. HCF = 45">${this._getNotesRaw(ov)}</textarea>
          <div style="display:flex;gap:8px;margin-top:6px">
            <button class="btn btn-b btn-sm" onclick="Admin.saveNotesText('${sid}','${cid}')">Save Notes</button>
            <button class="btn btn-gh btn-sm" onclick="Admin.previewNotes('${sid}','${cid}')">👁 Preview</button>
          </div>
          <div id="notes-preview" style="display:none;margin-top:10px;padding:14px;background:var(--bg3);border-radius:10px;border:1px solid var(--bdr);font-size:.84rem;line-height:1.75;color:var(--t2)"></div>
        </div>

        <div style="margin-bottom:18px">
          <div class="admin-sec-title" style="font-size:.88rem">🧠 Quiz Questions (Paste Text Format)</div>
          <div style="font-size:.74rem;color:var(--t3);margin-bottom:8px;background:var(--bg3);border-radius:8px;padding:10px;line-height:1.8">
            <strong style="color:var(--bl)">Format (one question):</strong><br>
            <code style="color:var(--b)">Q: Question text</code><br>
            <code style="color:var(--b)">A: Option A &nbsp; B: Option B &nbsp; C: Option C &nbsp; D: Option D</code><br>
            <code style="color:var(--b)">ANS: B</code> (correct option letter) &nbsp;|&nbsp;
            <code style="color:var(--b)">DIFF: easy</code> (optional) &nbsp;|&nbsp;
            <code style="color:var(--b)">---</code> (separator between questions)
          </div>
          <textarea class="fc fc-ta" id="b-quiz-raw" style="min-height:200px;font-family:var(--fm);font-size:.81rem" placeholder="Q: Euclid's Division Lemma states a = bq + r where:
A: 0 ≤ r < b
B: r > b
C: r = 0
D: r ≥ b
ANS: A
DIFF: medium
MARKS: 2
---
Q: Which of these is irrational?
A: √4
B: 0.125
C: √2
D: 22/7
ANS: C
DIFF: easy">${this._getQuizRaw(ov)}</textarea>
          <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
            <button class="btn btn-b btn-sm" onclick="Admin.saveQuizText('${sid}','${cid}','add')">➕ Add to Existing</button>
            <button class="btn btn-ac btn-sm" onclick="Admin.saveQuizText('${sid}','${cid}','replace')">🔄 Replace All Quiz</button>
            <button class="btn btn-gh btn-sm" onclick="Admin.previewQuiz('${sid}','${cid}')">👁 Preview</button>
          </div>
          <div id="quiz-preview" style="display:none;margin-top:10px"></div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="chapter.html?subject=${sid}&chapter=${cid}" target="_blank" class="btn btn-tl btn-sm">▶ Preview Chapter</a>
          <button class="btn btn-gh btn-sm" onclick="Admin.clearChapterOverrides('${sid}','${cid}')">🗑 Clear All Overrides</button>
        </div>`;
    });
  },

  /* Lesson management */
  editLesson(sid,cid,idx){
    App._data=null;
    App.loadData().then(()=>{
      const ch=App.getChapter(sid,cid);
      const l=ch?.lessons?.[idx]; if(!l) return;
      this._editingLesson={sid,cid,idx};
      document.getElementById('l-url').value=l.videoId||'';
      document.getElementById('l-title').value=l.title||'';
      document.getElementById('l-dur').value=l.duration||'';
      document.getElementById('l-id').value=l.id||'';
      document.getElementById('lesson-form-title').textContent=`✏️ Editing Lesson ${idx+1}`;
    });
  },
  cancelEditLesson(){ this._editingLesson=null; if(document.getElementById('lesson-form-title'))document.getElementById('lesson-form-title').textContent='➕ Add New Lesson'; ['l-url','l-title','l-dur','l-id'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';}); },

  saveLesson(sid,cid){
    const rawUrl=document.getElementById('l-url')?.value.trim()||'';
    const title=VidyaSec.clampStr(document.getElementById('l-title')?.value.trim());
    const dur=VidyaSec.clampStr(document.getElementById('l-dur')?.value.trim()||'',10);
    const lid=VidyaSec.clampStr(document.getElementById('l-id')?.value.trim()||'',10);
    const videoId=Parsers.ytId(rawUrl);
    if(!videoId){App.toast('Invalid YouTube URL or ID','⚠️');return;}
    if(!title){App.toast('Title required','⚠️');return;}

    App._data=null;
    App.loadData().then(()=>{
      const ch=App.getChapter(sid,cid);
      const lessons=JSON.parse(JSON.stringify(ch?.lessons||[])); // deep copy
      const newLesson={id:lid||`l${lessons.length+1}`,title,videoId,duration:dur};

      if(this._editingLesson && this._editingLesson.sid===sid && this._editingLesson.cid===cid){
        lessons[this._editingLesson.idx]=newLesson;
        this._editingLesson=null;
        App.toast('Lesson updated ✅');
      } else {
        lessons.push(newLesson);
        App.toast('Lesson added ✅');
      }
      App.saveOverride(sid,cid,{lessons});
      this.cancelEditLesson();
      this._refreshBuiltinEditor();
    });
  },

  deleteLesson(sid,cid,idx){
    if(!confirm('Delete this lesson?'))return;
    App._data=null;
    App.loadData().then(()=>{
      const ch=App.getChapter(sid,cid);
      const lessons=JSON.parse(JSON.stringify(ch?.lessons||[]));
      lessons.splice(idx,1);
      App.saveOverride(sid,cid,{lessons});
      App.toast('Lesson deleted 🗑️');
      this._refreshBuiltinEditor();
    });
  },

  /* Notes text format */
  _getNotesRaw(ov){
    if(ov.notesRaw) return VidyaSec.sanitize(ov.notesRaw);
    return '';
  },
  saveNotesText(sid,cid){
    const raw=document.getElementById('b-notes-raw')?.value||'';
    const blocks=Parsers.notes(raw);
    if(!blocks.length){App.toast('Nothing to save','⚠️');return;}
    App.saveOverride(sid,cid,{adminNotes:blocks,notesRaw:raw});
    App.toast(`Notes saved — ${blocks.length} blocks ✅`);
    this._refreshBuiltinEditor();
  },
  previewNotes(sid,cid){
    const raw=document.getElementById('b-notes-raw')?.value||'';
    const blocks=Parsers.notes(raw);
    const wrap=document.getElementById('notes-preview');
    if(!wrap)return;
    const html=blocks.map(b=>{
      switch(b.type){
        case'intro':   return`<div style="border-left:3px solid var(--b);padding:8px 12px;background:rgba(var(--br),.07);border-radius:8px;font-style:italic;margin-bottom:8px">${VidyaSec.sanitize(b.text)}</div>`;
        case'heading': return`<div style="font-family:var(--fd);font-size:.97rem;font-weight:700;color:var(--bl);margin:14px 0 6px">⬥ ${VidyaSec.sanitize(b.text)}</div>`;
        case'text':    return`<p style="margin-bottom:8px;white-space:pre-line">${VidyaSec.sanitize(b.text)}</p>`;
        case'keypoint':return`<div style="display:flex;gap:8px;background:rgba(var(--br),.07);border:1px solid var(--bdr2);border-radius:8px;padding:8px 11px;margin-bottom:7px"><span style="color:var(--b);flex-shrink:0">✦</span>${VidyaSec.sanitize(b.text)}</div>`;
        case'formula': return`<div style="font-family:monospace;background:rgba(var(--br),.08);border:1px solid var(--bdr2);border-radius:7px;padding:8px 12px;margin-bottom:8px;color:var(--bl)">📐 ${VidyaSec.sanitize(b.text)}</div>`;
        case'example': return`<div style="background:var(--bg3);border-radius:8px;padding:11px;margin-bottom:8px"><div style="font-weight:700;margin-bottom:5px;font-size:.82rem">💡 ${VidyaSec.sanitize(b.question)}</div><div style="font-family:monospace;font-size:.79rem;color:var(--tll)">→ ${VidyaSec.sanitize(b.answer)}</div></div>`;
        default:return'';
      }
    }).join('');
    wrap.innerHTML=html||'<em style="color:var(--t3)">No content parsed</em>';
    wrap.style.display='block';
  },

  /* Quiz text format */
  _getQuizRaw(ov){ return ov.quizRaw?VidyaSec.sanitize(ov.quizRaw):''; },
  saveQuizText(sid,cid,mode){
    const raw=document.getElementById('b-quiz-raw')?.value||'';
    const questions=Parsers.quiz(raw);
    if(!questions.length){App.toast('No valid questions found. Check the format.','⚠️');return;}
    if(mode==='replace'){
      App.saveOverride(sid,cid,{replaceQuiz:questions,extraQuiz:[],quizRaw:raw});
      App.toast(`Quiz replaced — ${questions.length} questions ✅`);
    } else {
      App.saveOverride(sid,cid,{extraQuiz:questions,quizRaw:raw});
      App.toast(`${questions.length} question${questions.length!==1?'s':''} added ✅`);
    }
    this._refreshBuiltinEditor();
  },
  previewQuiz(sid,cid){
    const raw=document.getElementById('b-quiz-raw')?.value||'';
    const questions=Parsers.quiz(raw);
    const wrap=document.getElementById('quiz-preview');if(!wrap)return;
    if(!questions.length){wrap.innerHTML='<em style="color:var(--t3);font-size:.82rem">No valid questions parsed yet</em>';wrap.style.display='block';return;}
    const L=['A','B','C','D','E'];
    wrap.innerHTML=questions.map((q,i)=>`<div style="background:var(--bg3);border-radius:9px;padding:12px;margin-bottom:8px;border:1px solid var(--bdr)">
      <div style="font-size:.82rem;font-weight:700;margin-bottom:8px">${i+1}. ${VidyaSec.sanitize(q.q)}</div>
      ${q.options.map((o,j)=>`<div style="font-size:.78rem;padding:4px 0;${j===q.answer?'color:var(--tll);font-weight:700':''}">${j===q.answer?'✓ ':'   '}${L[j]}) ${VidyaSec.sanitize(o)}</div>`).join('')}
      <div style="font-size:.69rem;color:var(--t3);margin-top:5px">${q.difficulty} · ${q.marks} mark${q.marks!=='1'?'s':''}</div>
    </div>`).join('');
    wrap.style.display='block';
  },

  _saveOv(sid,cid,field,rawVal){
    const val=VidyaSec.clampStr(rawVal,2000);
    App.saveOverride(sid,cid,{[field]:val});
    App.toast('Saved ✓','💾');
  },
  clearChapterOverrides(sid,cid){
    if(!confirm('Clear all overrides for this chapter?'))return;
    const ov=App._parseLS('vm_overrides',{});
    delete ov[`${sid}::${cid}`];
    App._saveLS('vm_overrides',ov);
    App._data=null;
    App.toast('Overrides cleared');
    this._refreshBuiltinEditor();
  },

  /* ── Custom Subjects ── */
  _rSubj(){
    const d=this.getData();const el=document.getElementById('subj-tbody');if(!el)return;
    const bi=[['Mathematics','📐','mathematics'],['Science','🔬','science'],['Social Science','🌍','social-science'],['English','📚','english']];
    el.innerHTML=bi.map(([n,i,id])=>`<tr><td>${i} <strong>${n}</strong></td><td><span class="chip chip-b">Built-in</span></td><td><a href="subject.html?id=${id}" target="_blank" class="btn btn-gh btn-sm">View →</a></td></tr>`).join('')
      +(d.subjects||[]).map((s,i)=>`<tr><td>${VidyaSec.sanitize(s.icon||'📖')} <strong>${VidyaSec.sanitize(s.name)}</strong></td><td><span class="chip chip-tl">Custom</span></td><td><button class="btn btn-dn btn-sm" onclick="Admin._dSubj(${i})">Delete</button></td></tr>`).join('');
  },
  addSubject(){
    const name=VidyaSec.clampStr(document.getElementById('ns-name')?.value.trim());const icon=VidyaSec.clampStr(document.getElementById('ns-icon')?.value.trim()||'📖',4);const desc=VidyaSec.clampStr(document.getElementById('ns-desc')?.value.trim());const color=document.getElementById('ns-color')?.value||'#C8822A';
    if(!name){App.toast('Name required','⚠️');return;}
    const d=this.getData();d.subjects=[...(d.subjects||[])];d.subjects.push({name,icon,desc,color,id:App._slug(name),date:Date.now()});this.saveData(d);App.toast(`"${name}" added ✅`);document.getElementById('ns-name').value='';this.refresh();
  },
  _dSubj(i){if(!confirm('Delete?'))return;const d=this.getData();d.subjects.splice(i,1);this.saveData(d);this.refresh();App.toast('Deleted 🗑️');},

  /* ── Custom Chapters ── */
  _rCh(){
    const d=this.getData();const el=document.getElementById('ch-tbody');if(!el)return;
    el.innerHTML=!(d.chapters||[]).length?'<tr><td colspan="5" style="text-align:center;color:var(--t3)">No custom chapters yet</td></tr>'
      :(d.chapters||[]).map((c,i)=>`<tr><td><strong>${VidyaSec.sanitize(c.title)}</strong></td><td>${VidyaSec.sanitize(c.subject)}</td><td>${c.videoId?'<span class="chip chip-tl">✓ Video</span>':'—'}</td><td>${c.notes?'<span class="chip chip-b">✓ Notes</span>':'—'}</td><td><button class="btn btn-dn btn-sm" onclick="Admin._dCh(${i})">Delete</button></td></tr>`).join('');
  },
  addChapter(){
    const title=VidyaSec.clampStr(document.getElementById('nc-title')?.value.trim());const subject=VidyaSec.clampStr(document.getElementById('nc-subj')?.value);const rawUrl=document.getElementById('nc-vid')?.value.trim()||'';const notes=VidyaSec.clampStr(document.getElementById('nc-notes')?.value.trim(),5000);const duration=VidyaSec.clampStr(document.getElementById('nc-dur')?.value.trim()||'40 min',20);
    if(!title||!subject){App.toast('Title & subject required','⚠️');return;}
    const videoId=rawUrl?Parsers.ytId(rawUrl):null;
    if(rawUrl&&!videoId){App.toast('Invalid YouTube URL or ID','⚠️');return;}
    const d=this.getData();d.chapters=[...(d.chapters||[])];d.chapters.push({title,subject,videoId:videoId||'',notes,duration,date:Date.now()});this.saveData(d);App.toast(`"${title}" added ✅`);['nc-title','nc-vid','nc-notes','nc-dur'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});this.refresh();
  },
  _dCh(i){if(!confirm('Delete?'))return;const d=this.getData();d.chapters.splice(i,1);this.saveData(d);this.refresh();App.toast('Deleted 🗑️');},

  /* ── PDFs ── */
  _rPDF(){
    const d=this.getData();const el=document.getElementById('pdf-tbody');if(!el)return;
    el.innerHTML=!(d.pdfs||[]).length?'<tr><td colspan="5" style="text-align:center;color:var(--t3)">No PDFs yet</td></tr>'
      :(d.pdfs||[]).map((p,i)=>`<tr><td>📄 <strong>${VidyaSec.sanitize(p.name)}</strong></td><td>${VidyaSec.sanitize(p.subject)}</td><td>${VidyaSec.sanitize(p.chapter||'General')}</td><td><span class="chip chip-tl">${VidyaSec.sanitize(p.type||'Notes')}</span></td><td style="display:flex;gap:5px"><a href="${p.url}" target="_blank" rel="noopener" class="btn btn-gh btn-sm">View</a><button class="btn btn-dn btn-sm" onclick="Admin._dPDF(${i})">Del</button></td></tr>`).join('');
  },
  addPDF(){
    const file=document.getElementById('pdf-file')?.files[0];const name=VidyaSec.clampStr(document.getElementById('pdf-name')?.value.trim());const subject=VidyaSec.clampStr(document.getElementById('pdf-subj')?.value);const chapter=VidyaSec.clampStr(document.getElementById('pdf-ch')?.value.trim());const type=VidyaSec.clampStr(document.getElementById('pdf-type')?.value);const urlField=VidyaSec.clampStr(document.getElementById('pdf-url')?.value.trim(),1000);
    if(!name||!subject){App.toast('Name and subject required','⚠️');return;}
    const save=(url,size)=>{const d=this.getData();d.pdfs=[...(d.pdfs||[])];d.pdfs.push({name,subject,chapter:chapter||'',type:type||'Notes',url,size:size||'—',date:Date.now()});this.saveData(d);App.toast(`PDF "${name}" saved 📁`);['pdf-name','pdf-ch','pdf-url'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});const fi=document.getElementById('pdf-file');if(fi)fi.value='';this.refresh();};
    if(file){if(file.size>10*1024*1024){App.toast('Max 10MB','⚠️');return;}const reader=new FileReader();reader.onload=e=>save(e.target.result,Math.round(file.size/1024)+'KB');reader.readAsDataURL(file);}
    else if(urlField)save(urlField,'—');
    else App.toast('Upload a file or enter a URL','⚠️');
  },
  _dPDF(i){if(!confirm('Delete?'))return;const d=this.getData();d.pdfs.splice(i,1);this.saveData(d);this.refresh();App.toast('Deleted 🗑️');},

  /* ── NCERT Topics ── */
  _rNCERT(){
    const d=this.getData();const el=document.getElementById('ncert-tbody');if(!el)return;
    const nh=document.getElementById('ncert-count-head');if(nh)nh.textContent=`All NCERT Topics (${(d.ncertTopics||[]).length})`;
    el.innerHTML=!(d.ncertTopics||[]).length?'<tr><td colspan="6" style="text-align:center;color:var(--t3)">No topics yet</td></tr>'
      :(d.ncertTopics||[]).map((t,i)=>`<tr><td style="max-width:200px">${VidyaSec.sanitize(t.text.slice(0,70))}${t.text.length>70?'…':''}</td><td>${VidyaSec.sanitize(t.subject)}</td><td>${VidyaSec.sanitize(t.chapter||'—')}</td><td>${t.marks?`<span class="chip chip-a">${VidyaSec.sanitize(t.marks)}M</span>`:'—'}</td><td>${t.important?'⭐':'—'}</td><td><button class="btn btn-dn btn-sm" onclick="Admin._dNCERT(${i})">Del</button></td></tr>`).join('');
  },
  addNCERT(){
    const text=VidyaSec.clampStr(document.getElementById('nt-text')?.value.trim(),500);const subject=VidyaSec.clampStr(document.getElementById('nt-subj')?.value);const chapter=VidyaSec.clampStr(document.getElementById('nt-ch')?.value.trim());const marks=VidyaSec.clampStr(document.getElementById('nt-marks')?.value.trim(),3);const important=document.getElementById('nt-imp')?.checked||false;const type=VidyaSec.clampStr(document.getElementById('nt-type')?.value);
    if(!text||!subject){App.toast('Text and subject required','⚠️');return;}
    const d=this.getData();d.ncertTopics=[...(d.ncertTopics||[])];d.ncertTopics.push({text,subject,chapter:chapter||'',marks,important,type,date:Date.now()});this.saveData(d);App.toast('Topic added ⭐');['nt-text','nt-ch','nt-marks'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});const imp=document.getElementById('nt-imp');if(imp)imp.checked=false;this.refresh();
  },
  _dNCERT(i){if(!confirm('Delete?'))return;const d=this.getData();d.ncertTopics.splice(i,1);this.saveData(d);this.refresh();App.toast('Deleted 🗑️');},

  /* ── NCERT Highlights ── */
  _rHighlights(){
    const d=this.getData();const el=document.getElementById('hl-tbody');if(!el)return;
    el.innerHTML=!(d.ncertHighlights||[]).length?'<tr><td colspan="4" style="text-align:center;color:var(--t3)">No highlights yet</td></tr>'
      :(d.ncertHighlights||[]).map((h,i)=>`<tr><td style="max-width:200px">${VidyaSec.sanitize(h.text.slice(0,60))}…</td><td>${VidyaSec.sanitize(h.subject)}</td><td>${VidyaSec.sanitize(h.chapter||'—')}</td><td><button class="btn btn-dn btn-sm" onclick="Admin._dHL(${i})">Del</button></td></tr>`).join('');
  },
  addHighlight(){
    const text=VidyaSec.clampStr(document.getElementById('hl-text')?.value.trim(),1000);const subject=VidyaSec.clampStr(document.getElementById('hl-subj')?.value);const chapter=VidyaSec.clampStr(document.getElementById('hl-ch')?.value.trim());const color=document.getElementById('hl-color')?.value||'#FFD700';const note=VidyaSec.clampStr(document.getElementById('hl-note')?.value.trim(),200);
    if(!text||!subject){App.toast('Text and subject required','⚠️');return;}
    const d=this.getData();d.ncertHighlights=[...(d.ncertHighlights||[])];d.ncertHighlights.push({text,subject,chapter:chapter||'',color,note,date:Date.now()});this.saveData(d);App.toast('Highlight added 🖊️');['hl-text','hl-ch','hl-note'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});this.refresh();
  },
  _dHL(i){if(!confirm('Delete?'))return;const d=this.getData();d.ncertHighlights.splice(i,1);this.saveData(d);this.refresh();App.toast('Deleted 🗑️');},

  /* ── Quiz Questions ── */
  _rQuiz(){
    const d=this.getData();const el=document.getElementById('quiz-tbody');if(!el)return;
    el.innerHTML=!(d.quiz||[]).length?'<tr><td colspan="4" style="text-align:center;color:var(--t3)">No questions yet</td></tr>'
      :(d.quiz||[]).map((q,i)=>`<tr><td style="max-width:180px">${VidyaSec.sanitize(q.q.slice(0,55))}…</td><td>${VidyaSec.sanitize(q.subject)}</td><td>${VidyaSec.sanitize(q.chapter||'—')}</td><td><button class="btn btn-dn btn-sm" onclick="Admin._dQuiz(${i})">Del</button></td></tr>`).join('');
  },
  addQuiz(){
    const q=VidyaSec.clampStr(document.getElementById('nq-q')?.value.trim(),300);const subject=VidyaSec.clampStr(document.getElementById('nq-subj')?.value);const chapter=VidyaSec.clampStr(document.getElementById('nq-ch')?.value.trim());const opts=[1,2,3,4].map(i=>VidyaSec.clampStr(document.getElementById('nq-o'+i)?.value.trim(),200)).filter(Boolean);const correct=parseInt(document.getElementById('nq-ans')?.value||'0');const marks=document.getElementById('nq-marks')?.value||'1';const difficulty=document.getElementById('nq-diff')?.value||'medium';
    if(!q||opts.length<2){App.toast('Question and 2+ options required','⚠️');return;}
    if(correct>=opts.length){App.toast('Answer index out of range','⚠️');return;}
    const d=this.getData();d.quiz=[...(d.quiz||[])];d.quiz.push({q,subject,chapter:chapter||'',options:opts,answer:correct,marks,difficulty,date:Date.now()});this.saveData(d);App.toast('Question added 🧠');['nq-q','nq-ch','nq-o1','nq-o2','nq-o3','nq-o4'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});this.refresh();
  },
  _dQuiz(i){if(!confirm('Delete?'))return;const d=this.getData();d.quiz.splice(i,1);this.saveData(d);this.refresh();App.toast('Deleted 🗑️');},

  /* ── Teachers ── */
  _rTeachers(){
    const d=this.getData();const el=document.getElementById('teacher-tbody');if(!el)return;
    el.innerHTML=!(d.teachers||[]).length?'<tr><td colspan="4" style="text-align:center;color:var(--t3)">No teachers added</td></tr>'
      :(d.teachers||[]).map((t,i)=>`<tr><td>${VidyaSec.sanitize(t.avatar||'T')} <strong>${VidyaSec.sanitize(t.name)}</strong></td><td>${VidyaSec.sanitize(t.channel)}</td><td>${VidyaSec.sanitize(t.subject||'—')}</td><td><button class="btn btn-dn btn-sm" onclick="Admin._dTeacher(${i})">Del</button></td></tr>`).join('');
  },
  addTeacher(){
    const name=VidyaSec.clampStr(document.getElementById('nt2-name')?.value.trim());const channel=VidyaSec.clampStr(document.getElementById('nt2-channel')?.value.trim());const subject=VidyaSec.clampStr(document.getElementById('nt2-subj')?.value);const color=document.getElementById('nt2-color')?.value||'#C8822A';const avatar=VidyaSec.clampStr(document.getElementById('nt2-avatar')?.value.trim()||name[0]||'T',4);
    if(!name||!channel){App.toast('Name and channel required','⚠️');return;}
    const d=this.getData();d.teachers=[...(d.teachers||[])];d.teachers.push({name,channel,subject:subject||'',color,avatar,date:Date.now()});this.saveData(d);App.toast(`"${name}" added ✅`);['nt2-name','nt2-channel','nt2-avatar'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});this.refresh();
  },
  _dTeacher(i){if(!confirm('Delete?'))return;const d=this.getData();d.teachers.splice(i,1);this.saveData(d);this.refresh();App.toast('Deleted 🗑️');},

  /* ── Announcements ── */
  _rAnn(){
    const d=this.getData();const el=document.getElementById('ann-tbody');if(!el)return;
    el.innerHTML=!(d.announcements||[]).length?'<tr><td colspan="4" style="text-align:center;color:var(--t3)">No announcements</td></tr>'
      :(d.announcements||[]).map((a,i)=>`<tr><td><strong>${VidyaSec.sanitize(a.title)}</strong></td><td>${VidyaSec.sanitize(a.text.slice(0,60))}</td><td><span class="chip chip-${a.type==='exam'?'a':a.type==='info'?'tl':'b'}">${VidyaSec.sanitize(a.type)}</span></td><td><button class="btn btn-dn btn-sm" onclick="Admin._dAnn(${i})">Del</button></td></tr>`).join('');
  },
  addAnnouncement(){
    const title=VidyaSec.clampStr(document.getElementById('na-title')?.value.trim(),150);const text=VidyaSec.clampStr(document.getElementById('na-text')?.value.trim(),500);const type=VidyaSec.clampStr(document.getElementById('na-type')?.value);
    if(!title||!text){App.toast('Title and message required','⚠️');return;}
    const d=this.getData();d.announcements=[...(d.announcements||[])];d.announcements.unshift({title,text,type,date:new Date().toLocaleDateString('en-IN')});this.saveData(d);App.toast('Posted 📢');['na-title','na-text'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});this.refresh();
  },
  _dAnn(i){if(!confirm('Delete?'))return;const d=this.getData();d.announcements.splice(i,1);this.saveData(d);this.refresh();App.toast('Deleted 🗑️');},

  /* ── Progress ── */
  _rProgress(){
    const p=App.getProgress();const el=document.getElementById('prog-tbody');if(!el)return;
    const subs=[{id:'mathematics',n:'Mathematics',t:5},{id:'science',n:'Science',t:5},{id:'social-science',n:'Social Science',t:4},{id:'english',n:'English',t:4}];
    el.innerHTML=subs.map(s=>{const sp=p[s.id]||{};const done=(sp.done||[]).length,pct=Math.round(done/s.t*100),qz=Object.keys(sp.scores||{}).length;return`<tr><td><strong>${s.n}</strong></td><td>${done}/${s.t}</td><td><div class="pbar" style="width:80px"><div class="pfill" style="width:${pct}%"></div></div></td><td>${qz}</td><td><button class="btn btn-gh btn-sm" onclick="Admin._cSubj('${s.id}')">Clear</button></td></tr>`;}).join('');
  },
  _cSubj(id){if(!confirm('Clear progress?'))return;const p=App.getProgress();delete p[id];App.saveProgress(p);this.refresh();App.toast('Cleared 🗑️');},
  clearAll(){if(!confirm('Clear ALL student progress?'))return;App.saveProgress({});this.refresh();App.toast('All cleared 🗑️');},
  clearAllOverrides(){if(!confirm('Clear all chapter overrides?'))return;localStorage.removeItem('vm_overrides');App._data=null;this.refresh();App.toast('Overrides cleared 🗑️');},

  /* ── Todos ── */
  _rTodos(){
    const todos=TodoPanel.getData();const el=document.getElementById('todos-tbody');if(!el)return;
    el.innerHTML=!todos.length?'<tr><td colspan="6" style="text-align:center;color:var(--t3)">No tasks</td></tr>'
      :todos.map(t=>`<tr><td>${VidyaSec.sanitize(t.text.slice(0,55))}</td><td>${VidyaSec.sanitize(t.subject||'—')}</td><td>${t.priority==='high'?'<span class="chip chip-a">High</span>':'Normal'}</td><td>${t.due?new Date(t.due).toLocaleDateString('en-IN'):'—'}</td><td>${t.marks||'—'}</td><td>${t.done?'<span class="chip chip-tl">Done</span>':'<span class="chip chip-b">Pending</span>'}</td></tr>`).join('');
  },

  /* ── Settings ── */
  _rSettings(){
    const el=document.getElementById('settings-info');if(!el)return;
    const d=this.getData();
    el.innerHTML=`Built-in subjects: <strong>4</strong><br>Custom subjects: <strong>${(d.subjects||[]).length}</strong><br>Custom chapters: <strong>${(d.chapters||[]).length}</strong><br>PDFs: <strong>${(d.pdfs||[]).length}</strong><br>NCERT topics: <strong>${(d.ncertTopics||[]).length}</strong><br>Highlights: <strong>${(d.ncertHighlights||[]).length}</strong><br>Quiz questions: <strong>${(d.quiz||[]).length}</strong><br>Teachers: <strong>${(d.teachers||[]).length}</strong><br>Announcements: <strong>${(d.announcements||[]).length}</strong>`;
    const sn=localStorage.getItem('vm_site_name');const mo=localStorage.getItem('vm_motd');
    if(sn){const el2=document.getElementById('s-name');if(el2)el2.value=sn;}
    if(mo){const el2=document.getElementById('s-motd');if(el2)el2.value=mo;}
  },
  saveSiteSettings(){
    const name=VidyaSec.clampStr(document.getElementById('s-name')?.value.trim(),60);const motd=VidyaSec.clampStr(document.getElementById('s-motd')?.value.trim(),200);
    if(name)localStorage.setItem('vm_site_name',name);if(motd)localStorage.setItem('vm_motd',motd);App.toast('Settings saved ✅');
  },
  exportData(){
    const all={adminData:this.getData(),progress:App.getProgress(),todos:TodoPanel.getData(),overrides:App._parseLS('vm_overrides',{})};
    const blob=new Blob([JSON.stringify(all,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`vidyamandir-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();App.toast('Backup exported 💾');
  },
  importData(e){
    const file=e.target.files[0];if(!file)return;const reader=new FileReader();
    reader.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.adminData)this.saveData(d.adminData);if(d.progress)App.saveProgress(d.progress);if(d.todos)TodoPanel.saveData(d.todos);if(d.overrides)App._saveLS('vm_overrides',d.overrides);App.toast('Imported 🎉');this.refresh();}catch{App.toast('Invalid file','❌');}};
    reader.readAsText(file);
  },
};

document.addEventListener('DOMContentLoaded',()=>{App.initPage('admin');Admin.init();});
