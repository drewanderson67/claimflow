// ---------- UI ----------
const LAYST={PAID:'Paid',PARTIAL:'Partly paid',DENIED:'Not paid',PENDED:'Under review',REJECTED:'Sent back',INTERCEPTED:'Fixed before sending',OPEN:'Open',OVERTURNED:'Overturned',UPHELD:'Upheld',AWAITING:'Waiting on info'};
const STT={PAID:'Finalized and paid in full (per contract)',PARTIAL:'Finalized; some lines denied or reduced',DENIED:'Finalized; no payment',PENDED:'Held for manual review in a work queue',REJECTED:'Front-end rejection (999/277CA) — never entered adjudication',INTERCEPTED:'Caught and resolved at point of care by Optum Real'};
const plain=()=>S.ui.plain;
const stB=s=>'<span class="st '+s+'" title="'+esc(STT[s]||'')+'">'+(plain()?LAYST[s]||s:s)+'</span>';
const carcT=c=>CARC[c]?(plain()?CARC[c][1]:CARC[c][0]):c;
const stgName=k=>{const s=STAGES.find(x=>x[0]===k);return s?(plain()?s[2]:s[1]):k};
let feedNew=new Set(),dirty=true,openId=null,dTab='trace',qFilter='all',F=null,preview=null,lastR=0;
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2200)}
function addFeed(c){feedNew.add(c.id);dirty=true}
const flashT={};
function flashPipe(by){if(S.ui.view!=='live')return;for(const k in by){const el=document.getElementById('stg-'+k);if(!el)continue;const w=worst(by[k]);const cls=w==='fail'?'ff':w==='pend'?'fw':w==='skip'?'':'fp';if(!cls)continue;
  el.classList.remove('fp','ff','fw');el.classList.add(cls);clearTimeout(flashT[k]);flashT[k]=setTimeout(()=>el.classList.remove('fp','ff','fw'),320)}}
const pendList=()=>S.claims.filter(c=>c.status==='PENDED');
// ----- Live -----
function kpi(l,v,s,bar){return'<div class="kpi"><div class="l">'+l+'</div><div class="v">'+v+'</div><div class="s">'+(s||'')+'</div>'+(bar!=null?'<div class="bar"><i style="width:'+Math.min(100,bar)+'%"></i></div>':'')+'</div>'}
function renderLive(){
  const st=S.stats,v=$('#v-live'),done=st.fin+st.rej,pend=pendList().length,last10=st.tput.slice(-10).reduce((s,x)=>s+x.n,0)/10;
  const openAp=S.appeals.filter(a=>a.status==='OPEN').length,closed=S.appeals.filter(a=>a.status!=='OPEN'),ovr=closed.filter(a=>a.status==='OVERTURNED').length;
  if(!v.dataset.init){v.dataset.init=1;v.innerHTML='<div class="kpis" id="kpis"></div><div class="card" style="margin-bottom:14px"><h2>Adjudication pipeline <span class="mut" style="text-transform:none;letter-spacing:0">— hover a stage for detail · counts = pass / fail / pend</span><span class="sp"></span><a class="btn sm" id="csvA" download="claims.csv" href="#">Export CSV</a> <button class="btn sm" data-act="reset" id="resetBtn">Reset</button></h2><div class="pipe" id="pipe"></div></div>'+
   '<div class="grid g2"><div class="card"><h2>Live claim stream <span class="sp mut" id="feedN" style="text-transform:none"></span></h2><div class="feed tw" id="feed"></div></div>'+
   '<div class="grid"><div class="card"><h2>Throughput (claims / sec, last 60 s)</h2><canvas id="tp" height="120"></canvas><div class="legend"><span><b style="background:var(--ok)"></b>auto-finalized</span><span><b style="background:var(--pend)"></b>pended</span><span><b style="background:var(--bad)"></b>denied/rejected</span><span><b style="background:var(--acc2)"></b>intercepted</span></div></div>'+
   '<div class="card"><h2>Outcome mix</h2><div id="mix"></div></div><div class="card"><h2>Top denial / rejection reasons (CARC)</h2><div class="bars" id="carcB"></div></div>'+
   '<div class="card"><h2>Work queues</h2><div class="bars" id="qB"></div></div><div class="card"><h2>Activity</h2><div class="log" id="actLog"></div></div></div></div>';}
  $('#kpis').innerHTML=[
    kpi(plain()?'Bills received':'Claims received',st.rcv.toLocaleString(),last10.toFixed(1)+' / sec now'),
    kpi(plain()?'Decided automatically':'Auto-adjudication rate',pct(st.auto,st.fin).toFixed(1)+'%',st.auto+' of '+st.fin+' finalized · target 85%+',pct(st.auto,st.fin)),
    kpi(plain()?'Clean first-pass':'Clean-claim rate',pct(st.clean,done).toFixed(1)+'%','paid in full, untouched'+(st.aiAuto?' · '+st.aiAuto+' AI-resolved':''),pct(st.clean,done)),
    kpi(plain()?'Paid to doctors':'Plan paid',money0(st.paid),'allowed '+money0(st.allowed)+' · billed '+money0(st.billed)),
    kpi(plain()?'Patients owe':'Member responsibility',money0(st.mresp),'deductible + copay + coinsurance'),
    kpi(plain()?'Not paid / sent back':'Denial + rejection rate',pct(st.denied+st.rej,done).toFixed(1)+'%',st.denied+' denied · '+st.rej+' rejected · '+st.partial+' partial'),
    kpi(plain()?'Waiting on a person':'In review queues',pend,st.tatN?'avg touched TAT '+(st.tat/st.tatN).toFixed(0)+' s (sim)':'—'),
    kpi(plain()?'Decision speed':'Engine latency',(st.latN?(st.lat/st.latN).toFixed(2):'0')+' ms','avg per claim, measured in-browser'),
    kpi('Optum Real intercepts',st.poc,S.ui.poc?(st.pocFixed+' fixed · '+st.pocBlocked+' stopped · ~'+money0(st.pocSaved)+' rework avoided'):'off — toggle in header'),
    kpi('Appeals',openAp+' open',closed.length?Math.round(100*ovr/closed.length)+'% overturned · '+closed.length+' closed':'none closed yet')].join('');
  const n=S.ui.poc?STAGES:STAGES.slice(1);const pp=$('#pipe');pp.style.gridTemplateColumns='repeat('+(innerWidth<700?2:innerWidth<1100?Math.ceil(n.length/2):n.length)+',minmax(0,1fr))';
  pp.innerHTML=n.map((s,i)=>{const o=st.stg[s[0]]||{p:0,f:0,w:0};return'<div class="stg'+(s[0]==='poc'?' poc':'')+'" id="stg-'+s[0]+'" title="'+esc(s[2]+' — '+s[3])+'"><div class="n">'+(S.ui.poc?i:i+1)+'</div><div class="t">'+esc(plain()?s[2]:s[1])+'</div><div class="c"><span class="p">'+(s[0]==='poc'?st.pocFixed:o.p)+'</span><span class="f">'+(s[0]==='poc'?st.pocBlocked:o.f)+'</span>'+(s[0]==='poc'?'':'<span class="w">'+o.w+'</span>')+'</div></div>'}).join('');
  const rows=S.claims.slice(0,40);
  $('#feedN').textContent=S.claims.length+' in memory';
  $('#feed').innerHTML='<table><thead><tr><th>Claim</th><th class="hide-m">Received</th><th>Provider</th><th class="hide-m">Member</th><th class="num">Billed</th><th class="num">Paid</th><th>Status</th></tr></thead><tbody>'+
    rows.map(c=>{const p=prov(c.npi),m=mem(c.mid),r=c.res;return'<tr class="click'+(feedNew.has(c.id)?' new':'')+'" data-act="open" data-id="'+c.id+'"><td class="mono">'+c.id.slice(-8)+'<div class="mut" style="font-size:10px">'+esc(c.channel)+'</div></td><td class="hide-m mono">'+tms(c.rcv)+'</td><td>'+esc(p?p.name:'NPI '+c.npi)+'<div class="mut" style="font-size:11px">'+(c.type==='I'?'837I · DRG '+c.drg+' · '+c.los+'d':c.lines.map(l=>l.cpt).join(' '))+'</div></td><td class="hide-m">'+esc(m?m.fn+' '+m.ln[0]+'.':'?')+'<div class="mut" style="font-size:11px">'+(m?m.plan:'')+'</div></td><td class="num">'+money(c.lines.reduce((s,l)=>s+l.chg,0))+'</td><td class="num">'+(r&&FINAL.includes(c.status)?money(r.tot.paid):'—')+'</td><td>'+stB(c.status)+(c.res&&c.res.queue&&c.status==='PENDED'?'<div class="mut" style="font-size:10px">'+esc(c.res.queue)+'</div>':c.res&&c.res.claimDeny?'<div class="mut" style="font-size:10px">CARC '+c.res.claimDeny.carc+'</div>':c.status==='INTERCEPTED'?'<div class="mut" style="font-size:10px">point of care</div>':'')+'</td></tr>'}).join('')+'</tbody></table>'+(rows.length?'':'<div class="empty">Waiting for claims…</div>');
  feedNew.clear();
  // mix
  const cnt={PAID:0,PARTIAL:0,DENIED:0,PENDED:0,REJECTED:0,INTERCEPTED:0};S.claims.forEach(c=>{if(cnt[c.status]!=null)cnt[c.status]++});
  const tot=Object.values(cnt).reduce((a,b)=>a+b,0)||1,col={PAID:'var(--ok)',PARTIAL:'var(--warn)',DENIED:'var(--bad)',PENDED:'var(--pend)',REJECTED:'var(--rej)',INTERCEPTED:'var(--acc2)'};
  $('#mix').innerHTML='<div class="stack">'+Object.keys(cnt).map(k=>'<i style="width:'+(100*cnt[k]/tot)+'%;background:'+col[k]+'" title="'+k+' '+cnt[k]+'"></i>').join('')+'</div><div class="legend">'+Object.keys(cnt).map(k=>'<span><b style="background:'+col[k]+'"></b>'+(plain()?LAYST[k]:k)+' '+cnt[k]+' ('+(100*cnt[k]/tot).toFixed(0)+'%)</span>').join('')+'</div><div class="hint" style="margin-top:6px">Of claims currently in memory (last ~400).</div>';
  const cs=Object.entries(st.carc).sort((a,b)=>b[1]-a[1]).slice(0,8),mx=cs.length?cs[0][1]:1;
  $('#carcB').innerHTML=cs.length?cs.map(([k,n])=>'<div class="row"><div class="lb" title="'+esc(k==='999'?'999/277CA front-end rejection':carcT(k))+'"><b>'+(k==='999'?'999':'CO-'+k)+'</b> '+esc(k==='999'?(plain()?'Sent back as incomplete':'Front-end rejection'):carcT(k))+'</div><div class="tr"><i style="width:'+(100*n/mx)+'%;background:'+(k==='999'?'var(--rej)':'var(--bad)')+'"></i></div><div class="num">'+n+'</div></div>').join(''):'<div class="hint">None yet</div>';
  const qc={};pendList().forEach(c=>{qc[c.q.key]=(qc[c.q.key]||0)+1});const qm=Math.max(1,...Object.values(qc));
  $('#qB').innerHTML=Object.keys(QUEUES).map(k=>'<div class="row"><div class="lb">'+QUEUES[k]+'</div><div class="tr"><i style="width:'+(100*(qc[k]||0)/qm)+'%;background:var(--pend)"></i></div><div class="num">'+(qc[k]||0)+'</div></div>').join('')+'<div class="hint">'+S.rules.examiners+' simulated examiners working · <a href="#" data-act="go" data-v="queue">open queues</a></div>';
  $('#actLog').innerHTML=S.log.slice(0,40).map(l=>'<div class="'+(l.c==='ok'?'ok':l.c==='bad'?'bad':l.c==='poc'?'':l.c==='ai'?'pend':'')+'"><time>'+tms(l.t)+'</time>'+esc(l.m)+'</div>').join('')||'<div class="hint">Examiner, AI, appeal and Optum Real activity appears here.</div>';
  drawTP();
}
function drawTP(){const cv=$('#tp');if(!cv)return;const dpr=devicePixelRatio||1,w=cv.clientWidth,h=120;cv.width=w*dpr;cv.height=h*dpr;const g=cv.getContext('2d');g.scale(dpr,dpr);g.clearRect(0,0,w,h);
  const d=S.stats.tput.slice(-60),mx=Math.max(4,...d.map(x=>x.n));const bw=w/60;
  g.strokeStyle='rgba(130,160,220,.12)';g.lineWidth=1;for(let i=1;i<4;i++){const y=h*i/4;g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}
  d.forEach((x,i)=>{let y=h;const X=(60-d.length+i)*bw+1;[['a','#22c55e'],['p','#a78bfa'],['d','#ef4444'],['i','#22d3ee']].forEach(([k,c])=>{const hh=(x[k]||0)/mx*(h-14);g.fillStyle=c;g.fillRect(X,y-hh,bw-2,hh);y-=hh})});
  g.fillStyle='#8b9abb';g.font='10px sans-serif';g.fillText('max '+mx+'/s',4,11)}
function csvHref(){const h=['claim_id','icn','received','channel','member_id','plan','npi','provider','dos','cpts','dx','billed','allowed','paid','member_resp','status','queue','carc'];
  const rows=S.claims.map(c=>{const m=mem(c.mid),p=prov(c.npi),r=c.res||{tot:{}};return[c.id,c.icn,new Date(c.rcv).toISOString(),c.channel,c.mid,m?m.plan:'',c.npi,p?p.name:'',c.dos,(c.type==='I'?'DRG '+c.drg+' ':'')+c.lines.map(l=>l.cpt).join(' '),c.dx.join(' '),r.tot.chg||0,r.tot.alw||0,r.tot.paid||0,r.tot.mr||0,c.status,r.queue||'',r.claimDeny?r.claimDeny.carc:(r.lines||[]).filter(l=>l.deny).map(l=>l.deny).join(' ')]});
  return'data:text/csv;charset=utf-8,'+encodeURIComponent([h,...rows].map(r=>r.map(x=>/[",]/.test(String(x))?'"'+String(x).replace(/"/g,'""')+'"':x).join(',')).join('\n'))}
// ----- Queue -----
function renderQueue(){
  const all=pendList().sort((a,b)=>a.q.since-b.q.since),qc={};all.forEach(c=>qc[c.q.key]=(qc[c.q.key]||0)+1);
  const list=qFilter==='all'?all:all.filter(c=>c.q.key===qFilter);
  $('#v-queue').innerHTML='<div class="card" style="margin-bottom:12px"><h2>Examiner work queues <span class="sp mut" style="text-transform:none">'+all.length+' pended · '+S.rules.examiners+' simulated examiners · AI auto-resolve '+(S.rules.aiAssist?'≥'+Math.round(S.rules.aiConf*100)+'%':'off')+'</span></h2><div class="row">'+
   '<button class="chip'+(qFilter==='all'?' on':'')+'" data-act="qf" data-k="all">All '+all.length+'</button>'+Object.keys(QUEUES).map(k=>'<button class="chip'+(qFilter===k?' on':'')+'" data-act="qf" data-k="'+k+'">'+QUEUES[k]+' '+(qc[k]||0)+'</button>').join('')+'</div>'+
   '<p class="hint" style="margin:8px 0 0">'+(plain()?'These bills need a person to look at them. You can approve, deny or ask the doctor\'s office for more information.':'Pended claims route by reason. Approve releases the edit and re-adjudicates (the claim may pend again for another reason); Deny finalizes with the queue\'s CARC; Request info issues a 277 P3 and waits for records.')+'</p></div>'+
   (list.length?'<div class="qgrid">'+list.slice(0,60).map(qCard).join('')+'</div>':'<div class="card empty">Queue is empty. '+(S.ui.running?'Claims will arrive shortly.':'Press Play to stream claims.')+'</div>');
}
function qCard(c){const p=prov(c.npi),m=mem(c.mid),k=c.q.key,age=Math.round((Date.now()-c.q.since)/1000);
  return'<div class="qcard"><div class="hd"><b class="mono" style="cursor:pointer" data-act="open" data-id="'+c.id+'">'+c.id+'</b>'+stB(c.q.sub==='AWAITING'?'AWAITING':'PENDED')+'<span class="chip">'+QUEUES[k]+'</span><span class="mut" style="margin-left:auto;font-size:11px">'+age+'s in queue</span></div>'+
  '<div style="font-size:13px">'+esc(p.name)+' · '+esc(m.fn+' '+m.ln)+' ('+m.plan+')</div><div class="mut" style="font-size:12px">'+c.lines.map(l=>l.cpt+(l.units>1?'×'+l.units:'')).join(', ')+' · Dx '+c.dx.join(', ')+' · billed '+money(c.res.tot.chg)+' · est. pay '+money(c.res.tot.paid)+'</div>'+
  '<div style="font-size:12px"><b>Reason:</b> '+esc(c.res.pend.msg)+'</div>'+(c.ai?'<div class="ai"><b>AI recommendation:</b> '+esc(c.ai.rec)+' ('+Math.round(c.ai.conf*100)+'%) — '+esc(c.ai.why)+'</div>':'')+
  (c.q.sub==='AWAITING'?'<div class="hint">Waiting on provider… returns in ~'+Math.max(0,Math.round((c.q.until-Date.now())/1000))+'s</div>':
  '<div class="acts"><button class="btn sm ok" data-act="approve" data-id="'+c.id+'">'+(k==='cob'?'Record primary EOB & pay':k==='fraud'?'Release':'Approve')+'</button><button class="btn sm bad" data-act="deny" data-id="'+c.id+'">Deny (CO-'+PEND_DENY[k]+')</button><button class="btn sm" data-act="request" data-id="'+c.id+'">Request '+(k==='cob'?'EOB':k==='fraud'?'records':'info')+'</button><button class="btn sm" data-act="open" data-id="'+c.id+'">Details</button></div>')+'</div>'}
// ----- Submit -----
function blankForm(){const m=S.members.find(x=>x.end>iso(today())&&x.plan==='PPO')||S.members[0],p=S.providers[0];return{mid:m.id,npi:p.npi,dos:addDays(iso(today()),-1),pos:'11',auth:'',cob:'',type:'P',freq:'1',dx:['E11.9','I10'],lines:[{cpt:'99214',mods:'',units:1,chg:220}]}}
function ipForm(drg){const f=blankForm(),h=S.providers.find(p=>p.spec==='HOSP'&&p.net==='IN');f.type='I';if(h)f.npi=h.npi;f.pos='21';f.dx=['J18.9'];f.drg=drg;f.admit=addDays(f.dos,-3);
  f.lines=[{cpt:'0120',mods:'',units:3,chg:9600},{cpt:'0250',mods:'',units:1,chg:3400},{cpt:'0300',mods:'',units:1,chg:2200},{cpt:'0320',mods:'',units:1,chg:1500}];return f}
function ipFields(){return'<div class="form" style="margin-top:10px"><label>MS-DRG<select data-f="drg">'+Object.keys(DRG).map(k=>'<option value="'+k+'"'+(F.drg===k?' selected':'')+'>'+k+' · '+esc(DRG[k].d)+'</option>').join('')+'</select></label><label>Admission date<input type="date" data-f="admit" value="'+(F.admit||'')+'"></label><label>Type of bill<input value="111 · inpatient admit-through-discharge" disabled></label></div>'}
const PRESETS={
 clean:()=>({...blankForm()}),
 mri:()=>{const f=blankForm();f.npi=S.providers.find(p=>p.spec==='RAD').npi;f.pos='22';f.dx=['M54.50'];f.lines=[{cpt:'72148',mods:'',units:1,chg:1450}];return f},
 bundle:()=>{const f=blankForm();f.npi=S.providers.find(p=>p.spec==='GI').npi;f.pos='24';f.dx=['Z12.11'];f.lines=[{cpt:'45380',mods:'',units:1,chg:1900},{cpt:'45378',mods:'',units:1,chg:1600}];return f},
 termed:()=>{const f=blankForm();const m=S.members.find(x=>x.end<iso(today()));if(m){f.mid=m.id;f.dos=addDays(m.end,5)}return f},
 tka:()=>{const f=blankForm();f.npi=S.providers.find(p=>p.spec==='ORTH'&&p.net==='IN').npi;f.pos='22';f.dx=['M17.12'];f.lines=[{cpt:'27447',mods:'',units:1,chg:7800}];const a='A'+ri(10000000,99999999);S.auth[f.mid+'|'+f.dos]=a;f.auth=a;return f},
 inpt:()=>ipForm('194'),
 drgup:()=>ipForm('871'),
 oon:()=>{const f=blankForm();const m=S.members.find(x=>x.plan==='HMO'&&x.end>iso(today()));if(m)f.mid=m.id;f.npi=S.providers.find(p=>p.net==='OON').npi;return f}};
function formClaim(){const c={...newClaimId(),rcv:Date.now(),rcvDate:iso(today()),channel:F.type==='I'?'Portal (837I)':'Portal',type:F.type||'P',drg:F.type==='I'?F.drg:null,admit:F.type==='I'?F.admit:null,los:F.type==='I'?Math.max(1,daysBetween(F.admit,F.dos)):0,tob:F.type==='I'?'111':null,mid:F.mid,npi:F.npi.trim(),dos:F.dos,pos:F.pos,dx:F.dx.filter(Boolean),freq:F.freq,
  lines:F.lines.filter(l=>l.cpt).map(l=>({cpt:l.cpt.trim().toUpperCase(),mods:String(l.mods||'').split(/[ ,]+/).filter(Boolean),units:+l.units||1,chg:+l.chg||0})),auth:F.auth||null,cob:F.cob!==''?+F.cob:null,ov:{},seed:Math.random(),hist:[],adj:[]};
  if(c.auth&&!S.auth[c.mid+'|'+c.dos])S.auth[c.mid+'|'+c.dos]=c.auth;return c}
function renderSubmit(){
  if(!F)F=PRESETS.clean();const mo=S.members.map(m=>'<option value="'+m.id+'"'+(m.id===F.mid?' selected':'')+'>'+esc(m.fn+' '+m.ln)+' · '+m.id+' · '+m.plan+(m.end<iso(today())?' (termed '+m.end+')':'')+(m.other?' · COB':'')+'</option>').join('');
  const po=S.providers.map(p=>'<option value="'+p.npi+'"'+(p.npi===F.npi?' selected':'')+'>'+esc(p.name)+' · '+p.net+'</option>').join('');
  $('#v-submit').innerHTML='<div class="grid g2"><div class="card"><h2>New claim ('+(F.type==='I'?'837I':'837P')+') <span class="sp"></span>'+Object.entries({clean:'Clean visit',mri:'MRI no auth',bundle:'Bundling',termed:'Termed member',tka:'High-dollar TKA',oon:'HMO out-of-network',inpt:'Hospital stay (837I)',drgup:'DRG upcode (837I)'}).map(([k,v])=>'<button class="chip" data-act="preset" data-k="'+k+'">'+v+'</button>').join('')+'</h2>'+
   '<div class="form"><label>Member (subscriber)<select data-f="mid">'+mo+'</select></label><label>Billing provider<select data-f="npi">'+po+'</select></label>'+
   '<label>'+(F.type==='I'?'Discharge date':'Date of service')+'<input type="date" data-f="dos" value="'+F.dos+'"></label><label>Place of service<select data-f="pos">'+[['11','11 Office'],['21','21 Inpatient hospital'],['22','22 Outpatient hospital'],['23','23 Emergency room'],['24','24 Ambulatory surgery'],['02','02 Telehealth']].map(([v,t])=>'<option value="'+v+'"'+(v===F.pos?' selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
   '<label>Prior auth # (REF*G1)<input type="text" data-f="auth" value="'+esc(F.auth)+'" placeholder="optional"></label><label>Primary payer paid (COB)<input type="number" step="0.01" data-f="cob" value="'+esc(F.cob)+'" placeholder="if secondary"></label>'+
   '<label>Diagnoses (ICD-10, comma sep)<input type="text" data-f="dx" list="icdl" value="'+esc(F.dx.join(', '))+'"></label><label>Frequency<select data-f="freq"><option value="1">1 Original</option><option value="7"'+(F.freq==='7'?' selected':'')+'>7 Replacement</option></select></label></div>'+
   (F.type==='I'?ipFields():'')+'<datalist id="icdl">'+Object.keys(ICD).map(k=>'<option value="'+k+'">'+esc(ICD[k])+'</option>').join('')+'</datalist><datalist id="cptl">'+Object.keys(CPT).map(k=>'<option value="'+k+'">'+esc(CPT[k].d)+'</option>').join('')+'</datalist>'+
   '<div class="tw" style="margin-top:10px"><table class="lines"><thead><tr><th>#</th><th>'+(F.type==='I'?'Revenue code':'CPT/HCPCS')+'</th><th>Modifiers</th><th>Units</th><th>Charge</th><th></th></tr></thead><tbody>'+
   F.lines.map((l,i)=>'<tr><td>'+(i+1)+'</td><td><input list="cptl" data-l="'+i+'" data-k="cpt" value="'+esc(l.cpt)+'"><div class="hint">'+esc((CPT[l.cpt]||{}).d||'')+'</div></td><td><input data-l="'+i+'" data-k="mods" value="'+esc(l.mods)+'" placeholder="25, 59"></td><td><input type="number" min="1" data-l="'+i+'" data-k="units" value="'+l.units+'"></td><td><input type="number" step="0.01" data-l="'+i+'" data-k="chg" value="'+l.chg+'"></td><td><button class="btn sm" data-act="rmline" data-i="'+i+'">✕</button></td></tr>').join('')+
   '</tbody></table></div><div class="row" style="margin-top:10px"><button class="btn sm" data-act="addline">+ Line</button><span style="flex:1"></span><button class="btn" data-act="precheck">⚡ Real-time check (Optum Real)</button><button class="btn pri" data-act="submit">Submit claim</button></div></div>'+
   '<div class="grid"><div class="card"><h2>Real-time pre-adjudication</h2><div id="pre">'+(preview||'<div class="hint">Run a real-time check to see the predicted outcome, patient cost estimate and any issues — before the claim is submitted. This is the “shift-left” idea behind Optum Real.</div>')+'</div></div>'+
   '<div class="card"><h2>Or paste raw X12 837P / 837I</h2><textarea id="raw837" class="mono" placeholder="ISA*00*...~"></textarea><div class="row" style="margin-top:8px"><button class="btn sm" data-act="sample837">Load sample</button><button class="btn sm pri" data-act="parse837">Parse & submit</button></div><div class="hint" style="margin-top:6px">Parses NM1*85 (NPI), NM1*IL (member), CLM, REF*G1, HI (incl. HI*DR MS-DRG), SV1/SV2, DTP*472 and DTP*434.</div></div></div></div>';
}
const SUGGEST={intake:['Correct the NPI / codes flagged above',null],elig:['Coverage inactive — verify via 270/271, collect new insurance or offer self-pay estimate',null],tf:['Past filing limit — provide proof of timely filing',null],
 auth:['Request prior authorization (278) in real time','fixauth'],bundle:['Remove the bundled component code, or add modifier 59/XS if truly distinct','fixbundle'],mue:['Reduce units to the MUE limit','fixmue'],
 mednec:['Add a diagnosis that supports the service, or attach clinical notes',null],sex:['Correct the diagnosis — it conflicts with the patient\'s sex on file',null],cob:['Enter what the primary payer paid (COB)',null],
 oon:['Refer to an in-network provider (HMO has no out-of-network benefit)',null],medicare:['Not a plan benefit — give the patient a cost estimate',null],dup:['Already on file — check status with a 276/277 instead',null],
 fraud:['Will route to pre-pay review — attach medical records',null],hd:['Will be reviewed as high-dollar — attach itemized bill / op note',null]};
function doPrecheck(){const c=formClaim(),r=adjudicate(c);const iss=pocIssues(r,c);if(r.pend&&!iss.some(i=>i.k===r.pend.key))iss.push({k:r.pend.key,m:r.pend.msg});
  const m=mem(c.mid);const P=m&&PLANS[m.plan];
  preview='<div class="res"><div class="row"><b>Predicted outcome:</b> '+stB(r.status)+(r.queue?' <span class="chip">'+r.queue+'</span>':'')+'<span style="margin-left:auto" class="mut">'+r.ms.toFixed(2)+' ms</span></div>'+
   (r.status!=='REJECTED'?'<div class="kv" style="margin-top:8px"><div><label>Billed</label>'+money(r.tot.chg)+'</div><div><label>Allowed</label>'+money(r.tot.alw)+'</div><div><label>Plan pays</label>'+money(r.tot.paid)+'</div><div><label>Patient pays (estimate)</label><b>'+money(r.tot.mr)+'</b></div></div>'+(P?'<div class="hint" style="margin-top:6px">'+esc(P.n)+' · deductible met '+money(m.acc.ded)+' / '+money(P.ded)+' · OOP '+money(m.acc.oop)+' / '+money(P.oop)+'</div>':''):'')+
   '<div style="margin-top:8px">'+(iss.length?iss.map(i=>{const s=SUGGEST[i.k]||[i.m,null];return'<div class="issue"><span class="bad">●</span><div style="flex:1"><b>'+esc(KEY_LABEL[i.k]||'Intake')+':</b> '+esc(i.m)+'<div class="hint">→ '+esc(s[0])+'</div></div>'+(s[1]?'<button class="btn sm ok" data-act="'+s[1]+'">Fix</button>':'')+'</div>'}).join(''):'<div class="issue"><span class="ok">●</span>No issues — expected to auto-adjudicate.</div>')+'</div>'+
   '<details style="margin-top:8px"><summary class="hint">Engine trace</summary>'+traceHTML(r)+'</details></div>';
  $('#pre').innerHTML=preview}
// ----- Appeals -----
function renderAppeals(){
  const elig=S.claims.filter(canAppeal).slice(0,25);
  $('#v-appeals').innerHTML='<div class="grid g2"><div class="card"><h2>Appeals & reconsiderations <span class="sp mut" style="text-transform:none">'+S.appeals.filter(a=>a.status==='OPEN').length+' open</span></h2><div class="tw"><table><thead><tr><th>Appeal</th><th>Claim</th><th>Filed by</th><th>Reason</th><th>Status</th><th class="num">Δ paid</th><th></th></tr></thead><tbody>'+
   S.appeals.slice(0,80).map(a=>'<tr><td class="mono">'+a.id+'<div class="mut" style="font-size:10px">L'+a.lvl+' · due '+a.due+'</div></td><td class="mono"><a href="#" data-act="open" data-id="'+a.cid+'">'+a.cid.slice(-8)+'</a><div class="mut" style="font-size:10px">'+a.keys.map(k=>KEY_LABEL[k]||k).join(', ')+'</div></td><td style="font-size:12px">'+esc(a.by)+'</td><td style="font-size:12px">'+esc(a.reason)+(a.note?'<div class="mut">'+esc(a.note)+'</div>':'')+'</td><td>'+stB(a.status)+'</td><td class="num">'+(a.status==='OVERTURNED'?money(a.delta):'—')+'</td><td>'+(a.status==='OPEN'?'<div class="row"><button class="btn sm ok" data-act="overturn" data-id="'+a.id+'">Overturn</button><button class="btn sm bad" data-act="uphold" data-id="'+a.id+'">Uphold</button></div>':'')+'</td></tr>').join('')+'</tbody></table></div>'+(S.appeals.length?'':'<div class="empty">No appeals yet. Providers file appeals on some denials automatically, or file one from the list →</div>')+'</div>'+
   '<div class="card"><h2>Denied / partially paid — eligible to appeal</h2><div class="tw"><table><thead><tr><th>Claim</th><th>Reason</th><th></th></tr></thead><tbody>'+elig.map(c=>'<tr><td class="mono"><a href="#" data-act="open" data-id="'+c.id+'">'+c.id.slice(-8)+'</a> '+stB(c.status)+'</td><td style="font-size:12px">'+c.res.denyKeys.map(k=>KEY_LABEL[k]||k).join(', ')+'</td><td><button class="btn sm" data-act="appeal" data-id="'+c.id+'">File appeal</button></td></tr>').join('')+'</tbody></table></div>'+(elig.length?'':'<div class="hint">Nothing to appeal right now.</div>')+'</div></div>';
}
// ----- Integrity -----
function renderIntegrity(){
  const pre=pendList().filter(c=>c.q.key==='fraud'),ps=S.providers.map(p=>({p,...provStats(p)})).sort((a,b)=>b.fr-a.fr);
  const idf=S.recov.filter(r=>r.status==='IDENTIFIED').reduce((s,r)=>s+r.amt,0);
  $('#v-integrity').innerHTML='<div class="kpis">'+kpi('Pre-pay review (OPRS)',pre.length,'claims held in SIU queue')+kpi('Overpayments identified',money0(idf),S.recov.filter(r=>r.status==='IDENTIFIED').length+' open')+kpi('Recovered',money0(S.stats.recovered),S.recov.filter(r=>r.status==='RECOVERED').length+' recoveries (PLB offsets)')+kpi('FWA threshold',S.rules.fraud,'score at/above pends for pre-pay review')+'</div>'+
   '<div class="grid g2"><div class="card"><h2>Provider risk profile <span class="sp mut" style="text-transform:none">E&M level-5 peer norm ≈ 6%</span></h2><div class="tw"><table><thead><tr><th>Provider</th><th>Net</th><th class="num">Claims</th><th class="num">E&M L5 %</th><th class="num">Denial %</th><th class="num">Avg FWA</th><th class="num">Paid</th></tr></thead><tbody>'+
   ps.map(x=>'<tr><td>'+esc(x.p.name)+(x.p.watch?' <span class="chip" style="color:#fca5a5">watch</span>':'')+'<div class="mut mono" style="font-size:10px">NPI '+x.p.npi+'</div></td><td>'+x.p.net+'</td><td class="num">'+x.n+'</td><td class="num '+(x.e5>25?'bad':'')+'">'+(x.em?x.e5+'%':'—')+'</td><td class="num">'+x.den+'%</td><td class="num '+(x.fr>=S.rules.fraud?'bad':x.fr>40?'warn':'')+'">'+x.fr+'</td><td class="num">'+money0(x.paid)+'</td></tr>').join('')+'</tbody></table></div></div>'+
   '<div class="card"><h2>Post-pay data mining <span class="sp"></span><button class="btn sm pri" data-act="mine">Run mining</button></h2><p class="hint" style="margin-top:0">Scans paid claims for upcoding outliers, unbilled COB and duplicate payments, then queues recoveries (offset on a future 835 via PLB*WO).</p><div class="tw"><table><thead><tr><th>ID</th><th>Claim</th><th>Finding</th><th class="num">Amount</th><th></th></tr></thead><tbody>'+
   S.recov.slice(0,50).map(r=>'<tr><td class="mono">'+r.id+'</td><td class="mono"><a href="#" data-act="open" data-id="'+r.cid+'">'+r.cid.slice(-8)+'</a></td><td style="font-size:12px"><b>'+esc(r.type)+'</b><div class="mut">'+esc(r.why)+'</div></td><td class="num">'+money(r.amt)+'</td><td>'+(r.status==='IDENTIFIED'?'<div class="row"><button class="btn sm ok" data-act="recover" data-id="'+r.id+'">Recover</button><button class="btn sm" data-act="dismiss" data-id="'+r.id+'">Dismiss</button></div>':'<span class="chip">'+r.status+'</span>')+'</td></tr>').join('')+'</tbody></table></div>'+(S.recov.length?'':'<div class="empty">Run mining to find overpayments.</div>')+'</div></div>'+
   '<div class="card" style="margin-top:14px"><h2>Pre-pay SIU queue</h2>'+(pre.length?'<div class="qgrid">'+pre.slice(0,12).map(qCard).join('')+'</div>':'<div class="hint">No claims in pre-pay review.</div>')+'</div>';
}
// ----- Rules -----
const RULEDEF=[['drgBase','Inpatient DRG base rate','Hospital base rate: 837I payment = base × MS-DRG weight × plan factor × contract (+ cost outlier).','money',[3000,15000,100]],['hdI','Inpatient high-dollar threshold','837I plan payment at/above this pends for pre-payment review.','money',[10000,200000,1000]],['hd','High-dollar review threshold','Plan payment at/above this amount pends for pre-payment review.','money',[500,10000,100]],['fraud','FWA score threshold','Claims scoring at/above go to SIU / OPRS pre-pay review.','num',[30,99,1]],
 ['ncci','NCCI procedure-to-procedure edits','Deny component codes billed with their comprehensive code (CO-97).','bool'],['mue','Medically Unlikely Edits (MUE)','Cap units per line at the CMS MUE (CO-151).','bool'],['dup','Duplicate detection','Deny exact duplicates (member, NPI, DOS, codes) with CO-18.','bool'],
 ['sexEdit','Sex-specific diagnosis edits','Deny when a diagnosis conflicts with patient sex (CO-10).','bool'],['cobPend','Pend for COB','Pend when other coverage is primary and no primary EOB; off = pay and recover later.','bool'],
 ['paMode','Missing prior auth','Deny (CO-197) or pend to clinical review.','sel',['deny','pend']],['mednecMode','Medical-necessity failure','Pend to clinical review (with AI triage) or auto-deny (CO-50).','sel',['pend','deny']],
 ['aiAssist','AI clinical triage auto-resolve','Let AI resolve clinical pends at/above the confidence threshold (human-in-the-loop otherwise).','bool'],['aiConf','AI confidence threshold','Minimum confidence for AI auto-resolution.','num',[.5,.99,.01]],
 ['examiners','Simulated examiners','Number of examiners/reviewers working queues automatically (0 = you work them).','num',[0,20,1]],['autoAppeal','Simulated provider appeals','Providers appeal some denials automatically.','bool'],['tfOverride','Timely filing override (days)','0 = use plan limit (90 commercial / 365 Medicare Advantage).','num',[0,730,1]]];
function renderRules(){const r=S.rules;
  $('#v-rules').innerHTML='<div class="card" style="margin-bottom:14px"><h2>Rules engine configuration <span class="sp mut" style="text-transform:none">changes apply to the next claim adjudicated</span></h2><div class="rules">'+RULEDEF.map(([k,t,d,ty,o])=>'<div class="rule"><div class="h"><b>'+t+'</b>'+
   (ty==='bool'?'<label class="tog"><input type="checkbox" data-rule="'+k+'"'+(r[k]?' checked':'')+'><span class="sw"></span></label>':ty==='sel'?'<select data-rule="'+k+'">'+o.map(x=>'<option'+(r[k]===x?' selected':'')+'>'+x+'</option>').join('')+'</select>':'<input type="number" style="width:100px" data-rule="'+k+'" min="'+o[0]+'" max="'+o[1]+'" step="'+o[2]+'" value="'+r[k]+'">')+'</div><p>'+d+'</p></div>').join('')+'</div>'+
   '<div class="row" style="margin-top:10px"><button class="btn sm" data-act="rulesdef">Restore defaults</button><span class="hint">'+(S.rulelog.length?'Last change: '+esc(S.rulelog[0].k)+' '+esc(String(S.rulelog[0].o))+' → '+esc(String(S.rulelog[0].n))+' at '+tms(S.rulelog[0].t):'No changes yet')+'</span></div></div>'+
   '<div class="grid g2"><div class="card"><h2>Benefit configuration</h2><div class="tw"><table><thead><tr><th>Plan</th><th class="num">Deductible</th><th class="num">OOP max</th><th class="num">Coins</th><th>Copays</th><th>OON</th><th class="num">TF</th></tr></thead><tbody>'+
   Object.entries(PLANS).map(([k,p])=>'<tr><td><b>'+k+'</b><div class="mut" style="font-size:11px">'+esc(p.n)+'</div></td><td class="num">'+money0(p.ded)+'</td><td class="num">'+money0(p.oop)+'</td><td class="num">'+p.coins*100+'%</td><td style="font-size:11px">'+(Object.entries(p.copay).map(([a,b])=>a+' $'+b).join(', ')||'— (HSA)')+'</td><td style="font-size:11px">'+(p.oon?'ded '+money0(p.oon.ded)+', '+p.oon.coins*100+'%':'none')+'</td><td class="num">'+p.tf+'d</td></tr>').join('')+'</tbody></table></div></div>'+
   '<div class="card"><h2>Fee schedule & code edits</h2><div class="tw" style="max-height:420px;overflow:auto"><table><thead><tr><th>Code</th><th>Description</th><th class="num">Base rate</th><th>Edits</th></tr></thead><tbody>'+
   Object.entries(CPT).map(([k,c])=>'<tr><td class="mono">'+k+'</td><td style="font-size:12px">'+esc(c.d)+'</td><td class="num">'+money(c.r)+'</td><td>'+(c.pa?'<span class="chip">PA</span>':'')+(c.mue?'<span class="chip">MUE '+c.mue+'</span>':'')+(MEDNEC[k]?'<span class="chip" title="'+MEDNEC[k].join(', ')+'">Med policy</span>':'')+(c.medicare?'<span class="chip">Medicare</span>':'')+(NCCI.some(n=>n[1]===k)?'<span class="chip">NCCI col2</span>':'')+'</td></tr>').join('')+'</tbody></table></div></div></div>';
}
// ----- Learn -----
function renderLearn(){const v=$('#v-learn');if(v.dataset.init)return;v.dataset.init=1;
  v.innerHTML='<div class="card" style="margin-bottom:14px"><h2>End-to-end claim lifecycle — layman vs. technical</h2><div class="steps">'+LIFECYCLE.map((s,i)=>'<div class="stp"><div class="no">'+(i+1)+'</div><div><h4>'+esc(s[0])+'</h4><p>'+esc(s[1])+'</p></div><div><p>'+esc(s[2])+'</p><p style="margin-top:4px"><span class="chip">In this app: '+esc(s[3])+'</span></p></div></div>').join('')+'</div></div>'+
  '<div class="grid g3"><div class="card"><h2>People</h2>'+PEOPLE.map(p=>'<div class="issue"><div><b>'+esc(p[0])+'</b><div class="hint">'+esc(p[1])+'</div></div></div>').join('')+'</div>'+
  '<div class="card"><h2>Systems</h2>'+SYSTEMS.map(p=>'<div class="issue"><div><b>'+esc(p[0])+'</b><div class="hint">'+esc(p[1])+'</div></div></div>').join('')+'</div>'+
  '<div class="card"><h2>X12 transactions</h2>'+[['837P / 837I','Professional / institutional claim'],['999','Implementation acknowledgment (syntax accept/reject)'],['277CA','Claim acknowledgment (front-end accept/reject)'],['270 / 271','Eligibility inquiry / response'],['278','Prior authorization request / response'],['276 / 277','Claim status inquiry / response'],['835','Electronic remittance advice (ERA) — payment + adjustments (CAS/CARC)'],['820 / EFT','Payment via ACH (CCD+ with TRN reassociation)']].map(p=>'<div class="issue"><div><b class="mono">'+p[0]+'</b><div class="hint">'+p[1]+'</div></div></div>').join('')+
  '<h2 style="margin-top:14px">CARC groups</h2><div class="hint"><b>CO</b> contractual — provider writes off · <b>PR</b> patient responsibility · <b>OA</b> other adjustment (e.g. COB)</div></div></div>'+
  '<div class="card" style="margin-top:14px"><h2>Claim adjustment reason codes used</h2><div class="tw"><table><thead><tr><th>CARC</th><th>Technical</th><th>Plain English</th></tr></thead><tbody>'+Object.entries(CARC).map(([k,v])=>'<tr><td class="mono">'+k+'</td><td>'+esc(v[0])+'</td><td class="mut">'+esc(v[1])+'</td></tr>').join('')+'</tbody></table></div><p class="hint">All members, providers, NPIs and claims are synthetic. Rates are illustrative, not actual UnitedHealthcare/Optum fee schedules or policies.</p></div>';
}
// ----- Drawer -----
function traceHTML(r){return'<div class="trace">'+STAGES.map(s=>{const its=r.trace.filter(t=>t.k===s[0]);if(!its.length)return'';const w=worst(its.map(i=>i.s));
  return'<div class="tr-i"><div class="ic '+w+'">'+({pass:'✓',fail:'✕',pend:'…',warn:'!',skip:'–',info:'i'})[w]+'</div><div><b>'+esc(stgName(s[0]))+'</b>'+its.map(i=>'<div class="msg">'+esc(i.m)+'</div>').join('')+'</div></div>'}).join('')+'</div>'}
function dl(name,txt,mime){return'<a class="btn sm" download="'+name+'" href="data:'+(mime||'text/plain')+';charset=utf-8,'+encodeURIComponent(txt)+'">⬇ '+name+'</a>'}
function openClaim(id){openId=id;dTab='trace';$('#drawer').classList.add('on');$('#scrim').classList.add('on');renderDrawer()}
function closeDrawer(){openId=null;$('#drawer').classList.remove('on');$('#scrim').classList.remove('on')}
function renderDrawer(){const c=S.claims.find(x=>x.id===openId);if(!c){closeDrawer();return}
  const p=prov(c.npi),m=mem(c.mid),r=c.res,P=m&&PLANS[m.plan];
  $('#dh').innerHTML='<div style="flex:1;min-width:0"><div class="row"><b class="mono" style="font-size:15px">'+c.id+'</b>'+stB(c.status)+(r&&r.queue&&c.status==='PENDED'?'<span class="chip">'+r.queue+'</span>':'')+'</div><div class="mut" style="font-size:12px;margin-top:3px">ICN '+c.icn+' · '+esc(c.channel)+' · received '+new Date(c.rcv).toLocaleString()+'</div></div><button class="btn sm" data-act="close">✕</button>';
  let acts='';
  if(c.status==='PENDED'&&c.q.sub==='READY'){const k=c.q.key;acts='<button class="btn sm ok" data-act="approve" data-id="'+c.id+'">'+(k==='cob'?'Record primary EOB & pay':k==='fraud'?'Release':'Approve')+'</button><button class="btn sm bad" data-act="deny" data-id="'+c.id+'">Deny (CO-'+PEND_DENY[k]+')</button><button class="btn sm" data-act="request" data-id="'+c.id+'">Request info</button>'}
  if(canAppeal(c))acts+='<button class="btn sm" data-act="appeal" data-id="'+c.id+'">File appeal</button>';
  const oa=S.appeals.find(a=>a.cid===c.id&&a.status==='OPEN');if(oa)acts+='<span class="chip">Appeal '+oa.id+' open</span><button class="btn sm ok" data-act="overturn" data-id="'+oa.id+'">Overturn</button><button class="btn sm bad" data-act="uphold" data-id="'+oa.id+'">Uphold</button>';
  const tabs=[['trace','Trace'],['lines','Lines'],['eob','EOB'],['835',c.status==='REJECTED'?'999':'835 ERA'],['837',c.type==='I'?'837I':'837P'],['277','277 status'],['hist','History']];
  let body='';
  if(dTab==='trace')body=(c.status==='INTERCEPTED'?'<div class="ai" style="margin-bottom:8px">'+esc(c.pocNote)+'</div>':'')+(r?traceHTML(r):'<div class="hint">Not adjudicated.</div>')+(r&&r.fraud?'<p class="hint">FWA score '+r.fraud+(r.fraudWhy&&r.fraudWhy.length?' — '+esc(r.fraudWhy.join('; ')):'')+'</p>':'')+(c.ai?'<div class="ai" style="margin-top:8px"><b>AI clinical review:</b> '+esc(c.ai.rec)+' ('+Math.round(c.ai.conf*100)+'%) — '+esc(c.ai.why)+'</div>':'');
  else if(dTab==='lines')body=r&&r.lines.length?'<div class="tw"><table><thead><tr><th>#</th><th>Code</th><th class="num">Units</th><th class="num">Billed</th><th class="num">Allowed</th><th class="num">Ded</th><th class="num">Copay</th><th class="num">Coins</th><th class="num">Paid</th><th>CAS</th></tr></thead><tbody>'+r.lines.map(l=>'<tr><td>'+(l.i+1)+'</td><td class="mono">'+l.cpt+(l.mods.length?'-'+l.mods.join('-'):'')+'<div class="mut" style="font-size:10px;font-family:inherit">'+esc(CPT[l.cpt].d)+'</div></td><td class="num">'+l.units+(l.payU<l.units?' <span class="bad">→'+l.payU+'</span>':'')+'</td><td class="num">'+money(l.chg)+'</td><td class="num">'+money(l.alw)+'</td><td class="num">'+money(l.ded)+'</td><td class="num">'+money(l.copay)+'</td><td class="num">'+money(l.coins)+'</td><td class="num"><b>'+money(l.paid)+'</b></td><td style="font-size:11px">'+l.cas.map(a=>'<span class="chip" title="'+esc(carcT(a[1]))+'">'+a[0]+'-'+a[1]+' '+money(a[2])+'</span>').join('')+'</td></tr>').join('')+'<tr><td colspan="3"><b>Total</b></td><td class="num">'+money(r.tot.chg)+'</td><td class="num">'+money(r.tot.alw)+'</td><td class="num">'+money(r.tot.ded)+'</td><td class="num">'+money(r.tot.copay)+'</td><td class="num">'+money(r.tot.coins)+'</td><td class="num"><b>'+money(r.tot.paid)+'</b></td><td></td></tr></tbody></table></div>'+(r.cobPrimary!=null?'<p class="hint">Primary payer ('+esc(m.other)+') paid '+money(r.cobPrimary)+'.</p>':'')+(c.adj.length?'<h4>Adjustments</h4>'+c.adj.map(a=>'<div class="issue"><span class="'+(a.delta<0?'bad':'ok')+'">'+money(a.delta)+'</span><span class="mut">'+tms(a.t)+' · '+esc(a.why)+'</span></div>').join(''):''):'<div class="hint">No line pricing (claim rejected at intake).</div>';
  else if(dTab==='eob')body=eobHTML(c);
  else if(dTab==='835'){const t=c.status==='REJECTED'?gen999(c):gen835(c);body=(c.status==='REJECTED'?'<p class="hint">Rejected claims never reach adjudication; the submitter receives a 999 (and 277CA) listing the errors.</p>':'')+'<div class="row" style="margin-bottom:6px">'+(FINAL.includes(c.status)||c.status==='REJECTED'?dl(c.id+(c.status==='REJECTED'?'.999':'.835')+'.edi',t):'')+'</div><pre class="edi">'+esc(t)+'</pre>'}
  else if(dTab==='837'){const t=gen837(c);body='<div class="row" style="margin-bottom:6px">'+dl(c.id+'.837.edi',t)+'</div><pre class="edi">'+esc(t)+'</pre>'}
  else if(dTab==='277'){const s=gen277(c);body='<div class="res" style="margin-bottom:8px"><b class="mono">STC '+s.cat+':'+s.code+'</b> — '+esc(s.txt)+'</div><pre class="edi">'+esc(s.edi)+'</pre>'}
  else if(dTab==='hist')body='<div class="trace">'+c.hist.map(h=>'<div class="tr-i"><div class="ic info">•</div><div><b>'+stB(h.s)+' '+esc(h.by)+'</b><div class="msg">'+tms(h.t)+(h.q?' · '+esc(h.q):'')+'</div></div></div>').join('')+'</div>'+(c.pocNote?'<div class="ai" style="margin-top:8px">'+esc(c.pocNote)+'</div>':'')+(c.dupOf?'<p class="hint">Duplicate of '+c.dupOf+'</p>':'')+(c.resubOf?'<p class="hint">Corrected resubmission of '+c.resubOf+'</p>':'');
  $('#db').innerHTML='<div class="kv"><div><label>Member</label>'+esc(m?m.fn+' '+m.ln:'Unknown')+'<div class="mut mono">'+c.mid+'</div></div><div><label>Plan</label>'+(P?esc(P.n):'—')+'</div><div><label>Provider</label>'+esc(p?p.name:'Unknown')+'<div class="mut mono">NPI '+c.npi+'</div></div><div><label>DOS · POS</label>'+c.dos+' · '+c.pos+'</div><div><label>Diagnoses</label>'+(c.dx.map(d=>'<span class="chip" title="'+esc(ICD[d]||'invalid')+'">'+esc(d)+'</span>').join('')||'<span class="bad">none</span>')+'</div><div><label>'+(plain()?'Plan pays / you owe':'Paid / member resp.')+'</label>'+(r&&r.tot?money(r.tot.paid)+' / '+money(r.tot.mr):'—')+'</div></div>'+
   (acts?'<div class="row" style="margin-top:10px">'+acts+'</div>':'')+'<div class="subtabs">'+tabs.map(t=>'<button class="'+(dTab===t[0]?'on':'')+'" data-act="dtab" data-k="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>'+body;
}
function eobHTML(c){const r=c.res,m=mem(c.mid),p=prov(c.npi);if(!m)return'<div class="hint">No member on file.</div>';const P=PLANS[m.plan];
  if(!r||!FINAL.includes(c.status))return'<div class="hint">An Explanation of Benefits is sent once the claim is finalized. Current status: '+stB(c.status)+'</div>';
  const notes=new Set();r.lines.forEach(l=>l.cas.forEach(a=>notes.add(a[1])));
  return'<div class="eob"><div class="row"><h3>Explanation of Benefits</h3><span style="margin-left:auto;font-weight:700;color:#1d4ed8">UnitedHealthcare</span></div><div class="mut" style="font-size:12px">THIS IS NOT A BILL · '+esc(m.fn+' '+m.ln)+' · Member ID '+m.id+' · '+esc(P.n)+'</div>'+
  '<p style="font-size:13px">Claim '+c.id+' · '+esc(p.name)+' · Service date '+c.dos+'</p><div class="tw"><table><thead><tr><th>Service</th><th class="num">Amount billed</th><th class="num">Network discount</th><th class="num">Plan paid</th><th class="num">You may owe</th></tr></thead><tbody>'+
  r.lines.map(l=>'<tr><td style="font-size:12px">'+esc(CPT[l.cpt].d)+(l.deny?'<div style="color:#b91c1c">'+esc(CARC[l.deny]?CARC[l.deny][1]:'')+'</div>':'')+(l.note&&!l.deny?'<div class="mut">'+esc(l.note)+'</div>':'')+'</td><td class="num">'+money(l.chg)+'</td><td class="num">'+money(l.chg-l.alw)+'</td><td class="num">'+money(l.paid)+'</td><td class="num"><b>'+money(l.mr)+'</b></td></tr>').join('')+'</tbody></table></div>'+
  '<div class="tot"><span>Plan paid '+money(r.tot.paid)+'</span><span>You may owe the provider '+money(r.tot.mr)+'</span></div>'+
  '<div style="margin-top:12px;font-size:12px"><b>Deductible</b> '+money(m.acc.ded)+' of '+money(P.ded)+'<div class="pg"><i style="width:'+pct(m.acc.ded,P.ded||1)+'%"></i></div><b>Out-of-pocket maximum</b> '+money(m.acc.oop)+' of '+money(P.oop)+'<div class="pg"><i style="width:'+pct(m.acc.oop,P.oop)+'%"></i></div></div>'+
  '<div style="margin-top:10px;font-size:12px"><b>Notes</b>'+[...notes].map(k=>'<div>'+k+' — '+esc(CARC[k]?CARC[k][1]:'')+'</div>').join('')+'</div><p class="mut" style="font-size:11px">If you disagree with this decision you may appeal within 180 days. '+(p.net!=='IN'?'Out-of-network providers may bill you for amounts above the allowed amount.':'')+'</p></div>'}
// ----- Modal -----
function modal(html){$('#mbox').innerHTML=html;$('#modal').classList.add('on')}
function closeModal(){$('#modal').classList.remove('on')}
// ----- Render loop -----
function render(force){const v=S.ui.view;
  $('#qBadge').textContent=pendList().length;$('#aBadge').textContent=S.appeals.filter(a=>a.status==='OPEN').length;
  const act=document.activeElement,typing=act&&/INPUT|SELECT|TEXTAREA/.test(act.tagName)&&$('#v-'+v).contains(act);
  if(v==='live')renderLive();else if(typing&&!force)return;
  else if(v==='trends')renderTrends();else if(v==='queue')renderQueue();else if(v==='appeals')renderAppeals();else if(v==='integrity')renderIntegrity();
  else if(force){if(v==='submit')renderSubmit();if(v==='rules')renderRules();if(v==='learn')renderLearn()}
  if(openId&&(force||!$('#drawer').contains(document.activeElement)))renderDrawer();
}
function setView(v){S.ui.view=v;$$('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.view===v));$$('.view').forEach(s=>s.classList.toggle('on',s.id==='v-'+v));
  if(v==='live')$('#v-live').dataset.init='';render(true);scrollTo(0,0)}
function setRunning(on){S.ui.running=on;$('#playBtn').textContent=on?'Pause':'Play';$('#live').classList.toggle('running',on);$('#liveTxt').textContent=on?'Live':'Paused'}
// ----- Events -----
document.addEventListener('click',e=>{const t=e.target.closest('[data-act],[data-view]');if(!t)return;
  if(t.dataset.view){setView(t.dataset.view);return}
  const a=t.dataset.act,id=t.dataset.id,c=id&&S.claims.find(x=>x.id===id);
  if(t.tagName==='A'&&!t.hasAttribute('download'))e.preventDefault();
  switch(a){
    case'play':setRunning(!S.ui.running);break;
    case'open':openClaim(id);break;case'close':closeDrawer();break;
    case'dtab':dTab=t.dataset.k;renderDrawer();break;
    case'go':setView(t.dataset.v);break;
    case'qf':qFilter=t.dataset.k;renderQueue();break;
    case'approve':if(c&&c.q&&c.q.key==='cob'){modal('<h3>Record primary payer EOB</h3><p class="hint">'+esc(mem(c.mid).other)+' paid as primary. Enter the primary paid amount (from their 835/EOB).</p><input type="number" step="0.01" id="cobAmt" value="'+r2(c.res.tot.alw*.7)+'" style="width:100%"><div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn" data-act="mclose">Cancel</button><button class="btn pri" data-act="cobok" data-id="'+c.id+'">Apply & re-adjudicate</button></div>');break}
      act(c,'approve');toast(c.id+' → '+c.status);render(true);break;
    case'cobok':act(c,'approve',null,+$('#cobAmt').value||0);closeModal();toast(c.id+' → '+c.status);render(true);break;
    case'deny':act(c,'deny');toast(c.id+' denied');render(true);break;
    case'request':act(c,'request');toast('Request sent (277 P3)');render(true);break;
    case'mclose':closeModal();break;
    case'appeal':modal('<h3>File appeal — '+c.id+'</h3><div class="form" style="grid-template-columns:1fr"><label>Filed by<select id="apBy"><option>Provider ('+esc(prov(c.npi).name)+')</option><option>Member ('+esc(mem(c.mid).fn+' '+mem(c.mid).ln)+')</option></select></label><label>Reason<input type="text" id="apWhy" value="'+esc(APPEAL_REASONS[c.res.denyKeys[0]]||'Request reconsideration')+'"></label></div><p class="hint">Denied for: '+c.res.denyKeys.map(k=>KEY_LABEL[k]||k).join(', ')+'</p><div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn" data-act="mclose">Cancel</button><button class="btn pri" data-act="apok" data-id="'+c.id+'">File appeal</button></div>');break;
    case'apok':fileAppeal(c,$('#apBy').value,$('#apWhy').value);closeModal();toast('Appeal filed');render(true);break;
    case'overturn':case'uphold':{const ap=S.appeals.find(x=>x.id===id);resolveAppeal(ap,a==='overturn'?'OVERTURNED':'UPHELD','You (appeals analyst)');toast(ap.id+' '+ap.status.toLowerCase());render(true);break}
    case'mine':{const n=runMining();toast(n+' new findings');render(true);break}
    case'recover':case'dismiss':{const rr=S.recov.find(x=>x.id===id);recover(rr,a==='recover');render(true);break}
    case'reset':if(t.dataset.armed){localStorage.removeItem(LS);S=seedWorld();openId=null;closeDrawer();setRunning(true);syncHdr();setView('live');toast('Reset')}else{t.dataset.armed=1;t.textContent='Click again to reset';t.classList.add('bad');setTimeout(()=>{if(t.isConnected){delete t.dataset.armed;t.textContent='Reset';t.classList.remove('bad')}},3000)}break;
    case'preset':F=PRESETS[t.dataset.k]();preview=null;renderSubmit();break;
    case'addline':F.lines.push({cpt:'',mods:'',units:1,chg:0});renderSubmit();break;
    case'rmline':F.lines.splice(+t.dataset.i,1);renderSubmit();break;
    case'precheck':doPrecheck();break;
    case'fixauth':{const a='A'+ri(10000000,99999999);S.auth[F.mid+'|'+F.dos]=a;F.auth=a;renderSubmit();doPrecheck();toast('278 approved: '+a);break}
    case'fixmue':F.lines.forEach(l=>{const mx=(CPT[l.cpt]||{}).mue;if(mx&&l.units>mx)l.units=mx});renderSubmit();doPrecheck();break;
    case'fixbundle':{const codes=F.lines.map(l=>l.cpt);NCCI.forEach(([x,y])=>{if(codes.includes(x)&&codes.includes(y))F.lines=F.lines.filter(l=>l.cpt!==y)});renderSubmit();doPrecheck();break}
    case'submit':{const cc=formClaim();if(S.ui.poc&&pocCheck(cc,false)!=='clean')cc.pocNote='Optum Real flagged issues pre-submission';process(cc,'user');preview=null;renderSubmit();openClaim(cc.id);toast('Submitted '+cc.id+' → '+cc.status);break}
    case'sample837':{const g=genClaim();g.defect=null;$('#raw837').value=gen837(g);break}
    case'parse837':{const x=parse837($('#raw837').value);if(!x.lines.length&&!x.npi){toast('Could not parse 837');break}
      const cc={...newClaimId(),rcv:Date.now(),rcvDate:iso(today()),channel:x.type==='I'?'EDI 837I (pasted)':'EDI 837P (pasted)',type:x.type||'P',drg:x.drg||null,pos:x.type==='I'?'21':x.pos,admit:x.admit||null,tob:x.type==='I'?'111':null,los:x.admit&&x.dos?Math.max(1,daysBetween(x.admit,x.dos)):0,mid:x.mid||'',npi:x.npi||'',dos:x.dos||iso(today()),pos:x.pos||'11',dx:x.dx,freq:x.freq||'1',lines:x.lines.map(l=>({...l,cpt:(l.cpt||'').toUpperCase()})),auth:x.auth||null,cob:null,ov:{},seed:Math.random(),hist:[],adj:[]};
      process(cc,'user');openClaim(cc.id);toast('Parsed & submitted → '+cc.status);break}
    case'rulesdef':S.rulelog.unshift({t:Date.now(),k:'all',o:'custom',n:'defaults'});S.rules={...DEFAULT_RULES};renderRules();toast('Defaults restored');break;
  }
});
document.addEventListener('pointerdown',e=>{if(e.target.id==='csvA')e.target.href=csvHref()});
document.addEventListener('focusin',e=>{if(e.target.id==='csvA')e.target.href=csvHref()});
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='speed'){S.ui.speed=+t.value;return}
  if(t.id==='pocTog'){S.ui.poc=t.checked;$('#v-live').dataset.init='';log('Optum Real point-of-care validation '+(t.checked?'ON':'OFF'),'poc');render(true);toast(t.checked?'Optum Real on — claims pre-validated at point of care':'Optum Real off');return}
  if(t.id==='plainTog'){S.ui.plain=t.checked;document.body.classList.toggle('plain',t.checked);$('#v-live').dataset.init='';render(true);return}
  if(t.dataset.rule){const k=t.dataset.rule,o=S.rules[k];let n=t.type==='checkbox'?(t.checked?1:0):t.tagName==='SELECT'?t.value:+t.value;S.rules[k]=n;S.rulelog.unshift({t:Date.now(),k,o,n});log('Rule change: '+k+' '+o+' → '+n);renderRules();return}
  if(t.dataset.f){const k=t.dataset.f;F[k]=k==='dx'?t.value.split(/[ ,]+/).map(x=>x.trim().toUpperCase()).filter(Boolean):t.value;if(k!=='dx'&&k!=='auth'&&k!=='cob')renderSubmit();return}
  if(t.dataset.l!=null){const l=F.lines[+t.dataset.l];l[t.dataset.k]=t.dataset.k==='cpt'?t.value.toUpperCase():t.value;if(t.dataset.k==='cpt'&&CPT[l.cpt]&&!+l.chg)l.chg=r2(CPT[l.cpt].r*2.2*(+l.units||1));renderSubmit()}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeDrawer()}});
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
// ----- Loop -----
let accum=0,lastT=performance.now(),lastSec=0,lastSave=0;
function bucket(){const sec=Math.floor(Date.now()/1000);let b=S.stats.tput[S.stats.tput.length-1];if(!b||b.s!==sec){b={s:sec,n:0,a:0,p:0,d:0,i:0};S.stats.tput.push(b);if(S.stats.tput.length>90)S.stats.tput.shift()}return b}
function tick(){
  const now=performance.now(),dt=Math.min(1,(now-lastT)/1000);lastT=now;
  if(S.ui.running){accum+=S.ui.speed*dt*(.6+Math.random()*.8);let n=0;
    while(accum>=1&&n<60){accum--;n++;const c=process(genClaim());const b=bucket();b.n++;
      if(c.status==='INTERCEPTED')b.i++;else if(c.status==='PENDED')b.p++;else if(['DENIED','REJECTED'].includes(c.status))b.d++;else b.a++}
    bucket();
    if(Date.now()-lastSec>1000){lastSec=Date.now();simExaminers();simAppeals()}
  }
  if(now-lastR>(S.ui.speed>=20?900:500)){lastR=now;render()}
  if(Date.now()-lastSave>5000){lastSave=Date.now();save()}
}
function syncHdr(){$('#speed').value=S.ui.speed;$('#pocTog').checked=S.ui.poc;$('#plainTog').checked=S.ui.plain;document.body.classList.toggle('plain',S.ui.plain)}
function init(){
  S=load()||seedWorld();S.ui.view='live';$('#ver').textContent='v'+VERSION;syncHdr();setRunning(S.ui.running!==false);
  if(!S.claims.length){log('Claims engine online — streaming synthetic 837s from clearinghouses, portal and API');}
  addEventListener('resize',()=>{if(S.ui.view==='live')renderLive()});
  addEventListener('beforeunload',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
  setView('live');setInterval(tick,100);
  if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
}
init();

// ---------- Trends ----------
function renderTrends(){const v=$('#v-trends');
  if(!v.dataset.init){v.dataset.init=1;const k=(c,t)=>'<i style="background:'+c+'"></i>'+t;
    v.innerHTML='<div class="grid g2">'+[['tc1','Claims per 10 s',k('#60a5fa','received')+k('#34d399','finalized')+k('#f87171','rejected (999)')],
      ['tc2','Auto-adjudication & denial rate',k('#34d399','auto-adjudicated')+k('#f87171','denied')+k('#fbbf24','pended on arrival')],
      ['tc3','Dollars per 10 s',k('#a78bfa','plan paid')+k('#f472b6','hospital (837I) paid')+k('#fbbf24','member responsibility')],
      ['tc4','Running auto-adjudication rate',k('#22d3ee','auto ÷ finalized (cumulative)')+k('#94a3b8','85% target')]]
      .map(([id,t,lg])=>'<div class="card"><h2>'+t+'</h2><canvas id="'+id+'" class="tchart"></canvas><div class="lg mut">'+lg+'</div></div>').join('')+
      '</div><div class="grid g2" style="margin-top:14px"><div class="card"><h2>By plan <span class="sp mut" style="text-transform:none">claims in memory</span></h2><div class="tw" id="tbPlan"></div></div><div class="card"><h2>By claim type</h2><div class="tw" id="tbType"></div></div></div>'}
  const T=(S.trend||[]).slice(-60),f=k=>T.map(b=>b[k]),pc=(a,b)=>T.map(x=>x[b]?100*x[a]/x[b]:null);
  let ca=0,cf=0;const cum=T.map(b=>{ca+=b.auto;cf+=b.fin;return cf?100*ca/cf:null});
  tChart('tc1',[[f('rcv'),'#60a5fa'],[f('fin'),'#34d399'],[f('rej'),'#f87171']],T);
  tChart('tc2',[[pc('auto','fin'),'#34d399'],[pc('den','fin'),'#f87171'],[pc('pend','rcv'),'#fbbf24']],T,{pct:1});
  tChart('tc3',[[f('paid'),'#a78bfa'],[f('ipPaid'),'#f472b6'],[f('mr'),'#fbbf24']],T,{money:1});
  tChart('tc4',[[cum,'#22d3ee'],[T.map(()=>85),'#94a3b8']],T,{pct:1});
  const grp=key=>{const g={};S.claims.forEach(c=>{const o=g[key(c)]=g[key(c)]||{n:0,fin:0,auto:0,den:0,pend:0,paid:0,chg:0};o.n++;o.chg+=c.lines.reduce((s,l)=>s+l.chg,0);
    if(c.status==='PENDED')o.pend++;if(c.finalized&&c.res){o.fin++;if(!c.touched)o.auto++;if(c.status==='DENIED')o.den++;o.paid+=c.res.tot.paid}});return g};
  const pct=(a,b)=>b?Math.round(100*a/b)+'%':'–';
  const tbl=(g,lab)=>'<table><thead><tr><th>'+lab+'</th><th>Claims</th><th>Auto</th><th>Denied</th><th>Pended</th><th>Billed</th><th>Plan paid</th><th>Paid ÷ billed</th></tr></thead><tbody>'+
    Object.entries(g).sort((a,b)=>b[1].n-a[1].n).map(([k,o])=>'<tr><td>'+esc(k)+'</td><td>'+o.n+'</td><td>'+pct(o.auto,o.fin)+'</td><td>'+pct(o.den,o.fin)+'</td><td>'+o.pend+'</td><td>'+money(o.chg)+'</td><td>'+money(o.paid)+'</td><td>'+pct(o.paid,o.chg)+'</td></tr>').join('')+'</tbody></table>';
  $('#tbPlan').innerHTML=tbl(grp(c=>{const m=mem(c.mid);return m?m.plan+' · '+PLANS[m.plan].n:'Unknown member'}),'Plan');
  $('#tbType').innerHTML=tbl(grp(c=>c.type==='I'?'837I institutional (DRG)':'837P professional'),'Claim type')}
function tChart(id,series,T,o={}){const cv=$('#'+id);if(!cv)return;const dpr=devicePixelRatio||1,W=cv.clientWidth||300,H=cv.clientHeight||170;cv.width=W*dpr;cv.height=H*dpr;
  const x=cv.getContext('2d');x.scale(dpr,dpr);const pl=o.money?44:32,pb=16,pt=6,w=W-pl-6,h=H-pb-pt;
  const mx=o.pct?100:Math.max(1,...series.flatMap(s=>s[0].filter(v=>v!=null)))*1.1;
  x.font='10px system-ui,sans-serif';x.fillStyle='#8b9bb4';x.strokeStyle='rgba(148,163,184,.15)';x.lineWidth=1;
  const lab=v=>o.pct?Math.round(v)+'%':o.money?'$'+(v>=1000?(v/1000).toFixed(v>=1e4?0:1)+'k':Math.round(v)):String(Math.round(v));
  for(let i=0;i<=4;i++){const y=pt+h*i/4;x.beginPath();x.moveTo(pl,y);x.lineTo(pl+w,y);x.stroke();x.fillText(lab(mx*(1-i/4)),2,y+3)}
  if(!T.length){x.fillText('Waiting for claims…',pl+8,pt+20);return}
  const fm=t=>new Date(t).toTimeString().slice(0,8),e=fm(T[T.length-1].t);x.fillText(fm(T[0].t),pl,H-3);x.fillText(e,pl+w-x.measureText(e).width,H-3);
  const n=Math.max(T.length,2);
  series.forEach(([vals,col])=>{x.strokeStyle=col;x.lineWidth=2;x.beginPath();let on=false;
    vals.forEach((v,i)=>{if(v==null){on=false;return}const px=pl+w*i/(n-1),py=pt+h*(1-Math.min(v,mx)/mx);on?x.lineTo(px,py):x.moveTo(px,py);on=true});x.stroke()})}
