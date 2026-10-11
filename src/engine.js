// ---------- Utilities ----------
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>(n<0?'-':'')+'$'+Math.abs(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const money0=n=>'$'+Math.round(n||0).toLocaleString('en-US');
const r2=n=>Math.round((n+Number.EPSILON)*100)/100;
const pct=(a,b)=>b?(100*a/b):0;
const DAY=864e5,today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const iso=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const addDays=(d,n)=>iso(new Date(new Date(d+'T00:00:00').getTime()+n*DAY));
const daysBetween=(a,b)=>Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/DAY);
const d8=s=>s.replace(/-/g,'');
const tms=t=>new Date(t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let R=Math.random;const ri=(a,b)=>a+Math.floor(R()*(b-a+1)),pick=a=>a[Math.floor(R()*a.length)];
const wpick=(arr,w)=>{let t=arr.reduce((s,x)=>s+w(x),0),r=R()*t;for(const x of arr){r-=w(x);if(r<=0)return x}return arr[arr.length-1]};
function luhnNPI(base9){const s='80840'+base9;let sum=0,alt=true;for(let i=s.length-1;i>=0;i--){let n=+s[i];if(alt){n*=2;if(n>9)n-=9}sum+=n;alt=!alt}return base9+((10-sum%10)%10)}
function validNPI(n){return /^\d{10}$/.test(n)&&luhnNPI(n.slice(0,9))===n}

// ---------- State ----------
const DEFAULT_RULES={hd:2500,fraud:70,ncci:1,mue:1,dup:1,sexEdit:1,mednecMode:'pend',paMode:'deny',cobPend:1,aiAssist:1,aiConf:0.9,examiners:4,autoAppeal:1,tfOverride:0};
let S;
function seedWorld(){
  R=mulberry(87726);
  const providers=PROVSEED.map((p,i)=>({npi:luhnNPI(String(1000000000+ri(1e7,9e7)+i*7919).slice(1,10).replace(/^0/,'1')),name:p[0],spec:p[1],net:p[2],mult:p[3],pos:p[4],watch:!!p[5],tin:'41'+String(ri(1000000,9999999))}));
  const plans=Object.keys(PLANS),members=[];const t=today(),yr=t.getFullYear();
  for(let i=0;i<80;i++){
    const plan=wpick(plans,k=>({PPO:3,HMO:2,HDHP:2,MA:1.5,EPO:1.5})[k]);const sex=R()<.5?'F':'M';
    const age=plan==='MA'?ri(65,88):ri(4,64);const dob=iso(new Date(yr-age,ri(0,11),ri(1,28)));
    const termed=R()<.09;const P=PLANS[plan];
    members.push({id:String(ri(100000000,999999999)),fn:pick(FIRST),ln:pick(LAST),sex,dob,plan,grp:plan==='MA'?'MA-H0543':'GRP'+ri(700000,799999),
      start:(yr-1)+'-01-01',end:termed?iso(new Date(t.getTime()-ri(20,45)*DAY)):yr+'-12-31',
      other:R()<.1?pick(['Aetna Choice POS II','BCBS of Minnesota','Medica','HealthPartners']):null,
      acc:{ded:r2(P.ded*R()*.9),oop:0}});
    members[i].acc.oop=members[i].acc.ded;
  }
  R=Math.random;
  return {v:VERSION,rules:{...DEFAULT_RULES},providers,members,claims:[],appeals:[],recov:[],log:[],rulelog:[],auth:{},seq:1,apSeq:1,
    stats:freshStats(),ui:{plain:false,poc:false,speed:3,running:true}};
}
function freshStats(){return{rcv:0,rej:0,fin:0,auto:0,touched:0,paid:0,billed:0,allowed:0,mresp:0,denied:0,partial:0,paidCnt:0,clean:0,poc:0,pocFixed:0,pocBlocked:0,pocSaved:0,
  carc:{},stg:{},lat:0,latN:0,tat:0,tatN:0,tput:[],recovered:0,adjN:0,aiAuto:0}}
const STAGES=[
 ['poc','Point-of-care (Optum Real)','Real-time check before you leave the office','Real-time eligibility, benefit, PA (278) and edit pre-check at point of care'],
 ['intake','Intake & 999','Is the bill complete and readable?','EDI syntax, required fields, NPI check digit, member ID, ICD/CPT validity → 999/277CA'],
 ['elig','Eligibility & timely filing','Were you covered that day — and was it sent on time?','270/271 coverage on DOS; timely-filing limit'],
 ['prov','Provider & network','Is the doctor in-network?','Provider contract, network status, fee multiplier, delegation'],
 ['ben','Benefits & prior auth','Is it covered, was pre-approval obtained?','Benefit config, Medicare-only codes, prior authorization (278)'],
 ['cob','Coordination of benefits','Does other insurance pay first?','COB order, primary EOB/835 present'],
 ['code','Coding edits','Do the codes make sense together?','NCCI PTP bundling, MUE units, sex/age edits, modifiers'],
 ['mednec','Medical necessity','Was the service justified for the diagnosis?','Medical policy: CPT ↔ ICD-10 support, AI clinical triage'],
 ['integ','Duplicate & integrity','Is it a repeat bill or suspicious?','Duplicate detection, FWA score, OPRS pre-pay rules'],
 ['price','Pricing','What does the contract pay and what do you owe?','Fee schedule × multiplier, CO-45, deductible/copay/coinsurance, OOP max, COB'],
 ['dec','Decision','Pay, deny, or send to a person','Auto-pay / auto-deny / pend to queue → 835, 277, EOB']];
const QUEUES={auth:'Clinical – Prior Auth',mednec:'Clinical – Medical Necessity',cob:'COB',fraud:'SIU / Payment Integrity',hd:'High-Dollar Review',info:'Examiner – Missing Info'};
const PEND_DENY={auth:'197',mednec:'50',cob:'22',fraud:'16',hd:'16',info:'16'};
const KEY_LABEL={elig:'Eligibility',tf:'Timely filing',oon:'Out of network',medicare:'Non-covered benefit',auth:'No prior auth',sex:'Sex edit',bundle:'NCCI bundling',mue:'MUE units',mednec:'Medical necessity',dup:'Duplicate',cob:'COB',fraud:'Integrity/SIU',hd:'High-dollar'};
const prov=npi=>S.providers.find(p=>p.npi===npi),mem=id=>S.members.find(m=>m.id===id);
function log(msg,cls=''){S.log.unshift({t:Date.now(),m:msg,c:cls});if(S.log.length>120)S.log.length=120}

// ---------- Claim generation ----------
function newClaimId(){const n=S.seq++;return{id:'CLM'+String(Date.now()).slice(-6)+String(n).padStart(4,'0'),icn:'87726'+String(26e8+n*37).slice(-9)}}
function genClaim(){
  const provs=S.providers.filter(p=>p.net!=='TERM');
  let p=wpick(provs,x=>x.net==='OON'?.35:x.watch?.9:1);
  const sc=wpick(SCEN[p.spec],x=>x[0]);
  let pool=S.members.filter(m=>m.end>=addDays(iso(today()),-1));
  if(sc[1].some(l=>l[0]==='G0439'))pool=pool.filter(m=>m.plan==='MA');
  const m=pick(pool);
  let dos=addDays(iso(today()),-ri(1,40));
  if(dos>m.end)dos=addDays(m.end,-ri(1,10));
  const lines=sc[1].map(([cpt,u,mods])=>({cpt,units:u||1,mods:mods?[...mods]:[],chg:0}));
  if(p.watch&&lines[0]&&/^9921[34]$/.test(lines[0].cpt)&&R()<.7)lines[0].cpt='99215';
  const c={...newClaimId(),rcv:Date.now(),channel:wpick(['EDI 837P','EDI 837P','EDI 837P','API (FHIR→837)','Portal','Paper (OCR)'],()=>1),
    mid:m.id,npi:p.npi,dos,pos:p.pos,dx:[...sc[2]],lines,auth:null,cob:null,freq:'1',ov:{},seed:R(),hist:[],adj:[],defect:null,orig:null};
  if(lines.some(l=>CPT[l.cpt].pa)&&R()<.78){const a='A'+ri(10000000,99999999);c.auth=a;S.auth[m.id+'|'+dos]=a}
  if(m.other&&R()<.55)c.cob=-1; // primary EOB attached (amount filled at pricing estimate)
  injectDefect(c,m,p);
  c.rcvDate=c.lateDays?addDays(c.dos,c.lateDays):iso(today());
  priceCharges(c);
  return c;
}
function priceCharges(c){const p=prov(c.npi);c.lines.forEach(l=>{if(!l.chg){const r=(CPT[l.cpt]||{r:50}).r;l.chg=r2(r*l.units*(p?p.mult:1)*(1.7+R()*1.1))}})}
const DEFECTS=[['badnpi',.012],['nodx',.01],['baddx',.008],['termed',.025],['late',.018],['bundle',.03],['mue',.02],['mednec',.03],['dup',.03],['sex',.01],['noauth',.02]];
function injectDefect(c,m,p){
  let r=R(),d=null;for(const [k,w] of DEFECTS){if(r<w){d=k;break}r-=w}
  if(!d)return;c.defect=d;
  const keep=()=>({npi:c.npi,dx:[...c.dx],lines:JSON.parse(JSON.stringify(c.lines)),mid:c.mid,dos:c.dos,auth:c.auth});
  c.orig=keep();
  switch(d){
    case'badnpi':c.npi=c.npi.slice(0,9)+((+c.npi[9]+3)%10);break;
    case'nodx':c.dx=[];break;
    case'baddx':c.dx=[c.dx[0].replace('.','').slice(0,3)+'.9X9'];break;
    case'termed':{const t=S.members.filter(x=>x.end<iso(today()));if(t.length){const tm=pick(t);c.mid=tm.id;c.dos=addDays(tm.end,ri(2,15))}else c.defect=null;break}
    case'late':c.dos=addDays(iso(today()),-ri(130,220));c.lateDays=ri(95,125);if(PLANS[m.plan].tf>=365)c.lateDays=ri(370,400);c.dos=addDays(iso(today()),-c.lateDays-ri(0,5));c.lateDays=daysBetween(c.dos,iso(today()));break;
    case'bundle':{const pr=pick([['45380','45378','Z12.11'],['43239','43235','K21.9'],['80053','85025','E11.9']]);
      if(!['GI','FM','IM'].includes(p.spec)){c.defect=null;break}
      c.lines=[{cpt:pr[0],units:1,mods:[],chg:0},{cpt:pr[1],units:1,mods:[],chg:0}];c.dx=[pr[2]];c.orig.lines=[{cpt:pr[0],units:1,mods:[],chg:0}];c.orig.dx=[pr[2]];break}
    case'mue':{const l=c.lines.find(x=>CPT[x.cpt].mue);if(l){c.orig.lines=JSON.parse(JSON.stringify(c.lines));l.units=CPT[l.cpt].mue+ri(1,3)}else c.defect=null;break}
    case'mednec':{const l=c.lines.find(x=>MEDNEC[x.cpt]);if(l){c.dx=[pick(['J06.9','K21.9','I10','F41.1','S93.401A'].filter(x=>!MEDNEC[l.cpt].some(pf=>x.startsWith(pf))))]}else c.defect=null;break}
    case'dup':{const prior=S.claims.find(o=>['PAID','PARTIAL'].includes(o.status)&&o.freq==='1'&&!o.defect);
      if(prior){c.mid=prior.mid;c.npi=prior.npi;c.dos=prior.dos;c.dx=[...prior.dx];c.lines=JSON.parse(JSON.stringify(prior.lines));c.auth=prior.auth;c.cob=prior.cob;c.dupOf=prior.id}else c.defect=null;break}
    case'sex':{const mm=mem(c.mid);c.dx.push(mm.sex==='M'?'O09.90':'N40.0');break}
    case'noauth':{const l=c.lines.find(x=>CPT[x.cpt].pa);if(l&&c.auth){delete S.auth[c.mid+'|'+c.dos];c.auth=null}else if(!l)c.defect=null;break}
  }
}

// ---------- Adjudication engine ----------
function adjudicate(c,opt={}){
  const t0=performance.now(),rl=S.rules,tr=[],ov=c.ov||{};
  const add=(k,s,m)=>tr.push({k,s,m});
  const res={lines:[],status:null,pend:null,denyKeys:[],claimDeny:null,fraud:0,trace:tr,tot:{chg:0,alw:0,paid:0,mr:0,ded:0,copay:0,coins:0,cob:0}};
  const m=mem(c.mid),p=prov(c.npi),P=m&&PLANS[m.plan];
  if(c.pocNote)add('poc','info',c.pocNote);
  // 1 intake
  const errs=[];
  if(!validNPI(c.npi))errs.push(['Billing provider NPI '+c.npi+' fails Luhn check digit','NM1*85 / NPI']);
  else if(!p)errs.push(['NPI '+c.npi+' not found in provider registry','NM1*85']);
  if(!m)errs.push(['Subscriber ID '+c.mid+' not found','NM1*IL']);
  if(!c.dx.length)errs.push(['No principal diagnosis (HI segment missing)','HI*ABK']);
  c.dx.forEach(d=>{if(!ICD[d])errs.push(['Invalid ICD-10-CM code '+d,'HI'])});
  if(!c.lines.length)errs.push(['No service lines','SV1']);
  c.lines.forEach((l,i)=>{if(!CPT[l.cpt])errs.push(['Line '+(i+1)+': invalid CPT/HCPCS '+l.cpt,'SV1'])});
  if(c.dos>iso(today()))errs.push(['Date of service '+c.dos+' is in the future','DTP*472']);
  if(errs.length){errs.forEach(e=>add('intake','fail',e[0]+' ('+e[1]+')'));res.status='REJECTED';res.errs=errs;STAGES.slice(2).forEach(s=>add(s[0],'skip','Not processed — front-end rejection'));res.ms=performance.now()-t0;return res}
  add('intake','pass','999 accepted · 277CA A1:20 · '+c.channel+' · '+c.lines.length+' line(s)');
  const L=c.lines.map((l,i)=>({i,cpt:l.cpt,mods:l.mods||[],units:l.units,chg:l.chg,payU:l.units,deny:null,denyKey:null,pendKey:null,cas:[],alw:0,ded:0,copay:0,coins:0,cob:0,paid:0,mr:0,note:''}));
  res.lines=L;
  const lineDeny=(l,carc,key,msg)=>{if(l.deny)return;l.deny=carc;l.denyKey=key;l.note=msg;if(!res.denyKeys.includes(key))res.denyKeys.push(key)};
  const claimDeny=(carc,key,msg)=>{if(!res.claimDeny){res.claimDeny={carc,key,msg};res.denyKeys.push(key)}};
  const pend=(key,msg,lines)=>{if(!res.pend)res.pend={key,msg};(lines||[]).forEach(l=>l.pendKey=key)};
  const dby=k=>!!ov[k],pby=k=>!!(ov[k]||ov.all);
  // 2 eligibility
  if(c.dos<m.start||c.dos>m.end){if(dby('elig'))add('elig','warn','Coverage exception granted on appeal');else{claimDeny('27','elig','Coverage terminated '+m.end+'; DOS '+c.dos);add('elig','fail','271: coverage inactive on DOS '+c.dos+' (term '+m.end+') → CO-27')}}
  else add('elig','pass','271: active '+P.n+' · '+m.start+' → '+m.end);
  const tf=rl.tfOverride||P.tf,lag=daysBetween(c.dos,c.rcvDate||iso(today()));
  if(!res.claimDeny){if(lag>tf){if(dby('tf'))add('elig','warn','Timely filing waived (proof of timely submission)');else{claimDeny('29','tf','Received '+lag+' days after DOS (limit '+tf+')');add('elig','fail','Timely filing: '+lag+' days > '+tf+'-day limit → CO-29')}}
  else add('elig','pass','Timely filing OK: '+lag+' / '+tf+' days')}
  const stop=()=>!!res.claimDeny;
  // 3 provider
  const er=c.lines.some(l=>CPT[l.cpt].cat==='ER')||c.pos==='23';let oon=p.net!=='IN';
  if(stop())add('prov','skip','Skipped (claim-level denial)');
  else if(oon){
    if(er){add('prov','warn',p.name+' is '+p.net+' — emergency services paid at in-network level (No Surprises Act)');oon=false}
    else if(!P.oon&&!dby('oon')){claimDeny('242','oon',p.name+' not in '+P.n+' network');add('prov','fail',p.name+' '+(p.net==='TERM'?'contract terminated':'out-of-network')+'; '+m.plan+' has no OON benefit → CO-242')}
    else add('prov','warn',p.name+' out-of-network → OON benefits ('+Math.round(P.oon.coins*100)+'% coins, OON deductible)');
  } else add('prov','pass',p.name+' · '+SPEC[p.spec]+' · in-network · contract × '+p.mult.toFixed(2)+(P.delegated?' · delegated to Optum Care Network (87726)':''));
  // 4 benefits + PA
  if(stop())add('ben','skip','Skipped');
  else{
    let any=false;
    L.forEach(l=>{const d=CPT[l.cpt];
      if(d.medicare&&!P.medicare&&!dby('medicare')){lineDeny(l,'204','medicare',l.cpt+' is a Medicare-only benefit');add('ben','fail','Line '+(l.i+1)+' '+l.cpt+': not a benefit of '+m.plan+' → CO-204');any=true}
      if(d.pa){any=true;const a=S.auth[c.mid+'|'+c.dos];
        if(a&&(!c.auth||c.auth===a))add('ben','pass','Line '+(l.i+1)+' '+l.cpt+': prior auth '+a+' approved (278)');
        else if(dby('auth'))add('ben','warn','Line '+(l.i+1)+' '+l.cpt+': retro-authorization approved by clinical review');
        else if(rl.paMode==='pend'&&!pby('auth')){pend('auth','No prior auth on file for '+l.cpt,[l]);add('ben','pend','Line '+(l.i+1)+' '+l.cpt+': no prior auth → pend to Clinical review')}
        else if(!pby('auth')||rl.paMode!=='pend'){lineDeny(l,'197','auth','Prior authorization required and not on file');add('ben','fail','Line '+(l.i+1)+' '+l.cpt+': prior auth required, none on file → CO-197')}
      }});
    if(!any)add('ben','pass','All services are covered benefits; no prior auth required');
  }
  // 5 COB
  let cobAmt=null;
  if(stop())add('cob','skip','Skipped');
  else if(m.other){
    if(ov.cobAmt!=null||c.cob!=null){cobAmt=ov.cobAmt!=null?ov.cobAmt:c.cob;add('cob','pass','UHC secondary to '+m.other+'; primary EOB on file')}
    else if(rl.cobPend&&!pby('cob')){pend('cob','Member has '+m.other+' as primary; primary EOB required');add('cob','pend','Other coverage ('+m.other+') primary — no primary EOB/835 → pend to COB')}
    else add('cob','warn','Other coverage on file but no primary EOB; paying as primary (subject to recovery)');
  } else add('cob','pass','No other coverage — UHC primary');
  // 6 coding
  if(stop())add('code','skip','Skipped');
  else{let issues=0;
    if(rl.sexEdit){const bad=c.dx.find(d=>SEXDX[d]&&SEXDX[d]!==m.sex);if(bad&&!dby('sex')){claimDeny('10','sex','Dx '+bad+' inconsistent with patient sex '+m.sex);add('code','fail','Dx '+bad+' ('+ICD[bad]+') inconsistent with sex '+m.sex+' → CO-10');issues++}}
    if(rl.ncci&&!stop())NCCI.forEach(([a,b,mod])=>{const la=L.find(l=>l.cpt===a&&!l.deny),lb=L.find(l=>l.cpt===b&&!l.deny);
      if(la&&lb){const hasMod=lb.mods.some(x=>['59','XS','XU','25'].includes(x))||la.mods.includes('25');
        if(mod===1&&hasMod)add('code','pass','NCCI '+a+'/'+b+': modifier '+(lb.mods.concat(la.mods).join(','))+' bypasses edit');
        else if(!dby('bundle')){lineDeny(lb,'97','bundle',b+' bundled into '+a);add('code','fail','NCCI PTP: '+b+' is a component of '+a+(mod===1?' (no 59/XS/25 modifier)':' (modifier not allowed)')+' → CO-97');issues++}}});
    if(rl.mue&&!stop())L.forEach(l=>{const mx=CPT[l.cpt].mue;if(mx&&l.units>mx&&!l.deny){if(dby('mue'))add('code','warn','MUE exceeded but override applied');else{l.payU=mx;add('code','fail','MUE: '+l.cpt+' billed '+l.units+' units, max '+mx+' → excess '+(l.units-mx)+' unit(s) CO-151');if(!res.denyKeys.includes('mue'))res.denyKeys.push('mue');issues++}}});
    if(!issues)add('code','pass','CPT/HCPCS + ICD-10 valid; no NCCI, MUE or sex/age conflicts');
  }
  // 7 medical necessity
  if(stop())add('mednec','skip','Skipped');
  else{let chk=0;
    L.forEach(l=>{const pf=MEDNEC[l.cpt];if(!pf||l.deny)return;chk++;
      const ok=c.dx.some(d=>pf.some(x=>d.startsWith(x)));
      if(ok)add('mednec','pass',l.cpt+' supported by '+c.dx.filter(d=>pf.some(x=>d.startsWith(x))).join(', '));
      else if(dby('mednec'))add('mednec','warn',l.cpt+': medical director approved on review/appeal');
      else if(c.forceDeny&&c.forceDeny.key==='mednec'){lineDeny(l,'50','mednec','Clinical reviewer: not medically necessary');add('mednec','fail',l.cpt+': clinical reviewer determined not medically necessary → CO-50')}
      else if(rl.mednecMode==='pend'&&!pby('mednec')){pend('mednec',l.cpt+' not supported by '+c.dx.join(', '),[l]);
        c.ai=c.ai||{rec:'deny',conf:r2(.82+c.seed*.16),why:'Billed diagnosis '+c.dx.join(', ')+' is not a covered indication for '+l.cpt+' under medical policy.'};
        add('mednec','pend',l.cpt+' not supported by '+c.dx.join(', ')+' → pend to Clinical review · AI: '+c.ai.rec+' ('+Math.round(c.ai.conf*100)+'%)')}
      else if(!pby('mednec')){lineDeny(l,'50','mednec','Diagnosis does not support medical necessity');add('mednec','fail',l.cpt+' not supported by '+c.dx.join(', ')+' → CO-50')}
      else add('mednec','warn',l.cpt+' released by reviewer');
    });
    if(!chk)add('mednec','pass','No medical-policy-governed services');
  }
  // 8 duplicate + integrity
  if(stop())add('integ','skip','Skipped');
  else{
    if(S.rules.dup&&c.freq!=='7'){const codes=c.lines.map(l=>l.cpt).sort().join();
      const d=S.claims.find(o=>o!==c&&o.rcv<c.rcv&&o.mid===c.mid&&o.npi===c.npi&&o.dos===c.dos&&['PAID','PARTIAL','PENDED'].includes(o.status)&&o.lines.map(l=>l.cpt).sort().join()===codes);
      if(d&&!dby('dup')){claimDeny('18','dup','Exact duplicate of '+d.id);add('integ','fail','Exact duplicate of '+d.id+' (same member, NPI, DOS, codes) → CO-18')}
      else add('integ','pass','No duplicate found ('+S.claims.length+' claims searched)')}
    let f=Math.round(c.seed*28)+3;const why=[];
    if(p.watch){f+=38;why.push('provider on payment-integrity watch list')}
    if(c.lines.some(l=>l.cpt==='99215')&&p.watch){f+=18;why.push('E&M level 5 outlier vs. peers')}
    if(p.net!=='IN'){f+=8;why.push('out-of-network')}
    if(c.lines.some(l=>CPT[l.cpt].mue&&l.units>CPT[l.cpt].mue)){f+=10;why.push('units above MUE')}
    f=Math.min(99,f);res.fraud=f;res.fraudWhy=why;
    if(!stop()){if(f>=rl.fraud&&!pby('fraud')){pend('fraud','FWA score '+f+' ≥ '+rl.fraud+': '+why.join('; '));add('integ','pend','FWA score '+f+' ('+why.join('; ')+') → OPRS pre-pay review (SIU)')}
      else add('integ',f>=rl.fraud?'warn':'pass','FWA score '+f+(why.length?' · '+why.join('; '):'')+(f>=rl.fraud?' · released by SIU':''))}
  }
  // 9 pricing
  if(stop()){add('price','skip','Skipped');L.forEach(l=>lineDeny(l,res.claimDeny.carc,res.claimDeny.key,res.claimDeny.msg))}
  else{
    const useOON=oon&&P.oon,ded=useOON?P.oon.ded:P.ded,coins=useOON?P.oon.coins:P.coins;
    let remDed=Math.max(0,ded-m.acc.ded),remOop=Math.max(0,P.oop-m.acc.oop),copayUsed=false;
    if(c.forceDeny&&c.forceDeny.key!=='mednec'){const k=c.forceDeny.key;const tl=L.filter(l=>l.pendKey===k);(tl.length?tl:L).forEach(l=>lineDeny(l,PEND_DENY[k],k,'Denied by '+QUEUES[k]))}
    L.forEach(l=>{const d=CPT[l.cpt];
      if(l.deny){l.cas=[['CO',l.deny,l.chg]];return}
      const unitChg=l.chg/l.units,pay=l.payU;
      const base=d.r*pay*(useOON?P.oon.mult:p.mult);
      l.alw=r2(Math.min(unitChg*pay,base));
      const excess=r2(unitChg*(l.units-pay));
      if(excess>0)l.cas.push(['CO','151',excess]);
      const wo=r2(l.chg-excess-l.alw);if(wo>0)l.cas.push(['CO','45',wo]);
      const prev=d.cat==='PREV'||(['45378','45380'].includes(l.cpt)&&c.dx.includes('Z12.11'));
      let share=0;
      if(prev&&!oon){l.note='Preventive — $0 cost share (ACA)'}
      else if(!useOON&&P.copay[d.cat]&&!copayUsed){l.copay=Math.min(P.copay[d.cat],l.alw);copayUsed=true;share=l.copay}
      else{l.ded=r2(Math.min(remDed,l.alw));remDed-=l.ded;l.coins=r2((l.alw-l.ded)*coins);share=l.ded+l.coins}
      if(share>remOop){const cut=share-remOop;let c1=Math.min(cut,l.coins);l.coins=r2(l.coins-c1);let c2=Math.min(cut-c1,l.copay);l.copay=r2(l.copay-c2);l.ded=r2(l.ded-(cut-c1-c2));share=remOop}
      remOop-=share;l.mr=r2(l.ded+l.copay+l.coins);l.paid=r2(l.alw-l.mr);
      if(l.ded)l.cas.push(['PR','1',l.ded]);if(l.copay)l.cas.push(['PR','3',l.copay]);if(l.coins)l.cas.push(['PR','2',l.coins]);
    });
    // COB (secondary)
    const alw=L.reduce((s,l)=>s+l.alw,0);
    if(cobAmt!=null&&alw>0){
      const prim=cobAmt<0?r2(alw*(.55+c.seed*.25)):cobAmt;res.cobPrimary=prim;
      L.forEach(l=>{if(l.deny||!l.alw)return;const share=prim*l.alw/alw;const sec=Math.max(0,Math.min(l.paid,l.alw-share));const red=r2(l.paid-sec);
        l.cob=red;l.paid=r2(sec);const mrNew=r2(Math.max(0,l.alw-share-l.paid));const mrRed=r2(l.mr-mrNew);
        if(red>0)l.cas.push(['OA','23',r2(red+Math.max(0,mrRed))]);
        if(mrRed>0){let x=mrRed;for(const k of['coins','copay','ded']){const t=Math.min(x,l[k]);l[k]=r2(l[k]-t);x-=t}l.cas=l.cas.filter(a=>a[0]!=='PR');if(l.ded)l.cas.push(['PR','1',l.ded]);if(l.copay)l.cas.push(['PR','3',l.copay]);if(l.coins)l.cas.push(['PR','2',l.coins])}
        l.mr=mrNew;});
      add('price','pass','COB: primary paid '+money(prim)+'; UHC pays lesser of normal benefit or remaining balance');
    }
    L.forEach(l=>{if(!l.deny)return;});
    const paidT=L.reduce((s,l)=>s+l.paid,0);
    add('price','pass','Allowed '+money(alw)+' ('+(useOON?'OON '+P.oon.mult+'× fee schedule':'contract × '+p.mult)+') · plan pays '+money(paidT)+' · member '+money(L.reduce((s,l)=>s+l.mr,0))+' · ded remaining '+money(Math.max(0,remDed)));
    // high dollar
    if(!res.pend&&paidT>=rl.hd&&!pby('hd')){pend('hd','Plan payment '+money(paidT)+' ≥ '+money(rl.hd)+' high-dollar threshold');add('price','pend','High-dollar: '+money(paidT)+' ≥ '+money(rl.hd)+' → pend for pre-payment review')}
  }
  // totals
  L.forEach(l=>{res.tot.chg+=l.chg;res.tot.alw+=l.alw;res.tot.paid+=l.paid;res.tot.mr+=l.mr;res.tot.ded+=l.ded;res.tot.copay+=l.copay;res.tot.coins+=l.coins;res.tot.cob+=l.cob});
  for(const k in res.tot)res.tot[k]=r2(res.tot[k]);
  // 10 decision
  if(res.claimDeny){res.status='DENIED';add('dec','fail','Auto-denied: CARC '+res.claimDeny.carc+' — '+CARC[res.claimDeny.carc][0])}
  else if(res.pend&&!c.forceDeny){res.status='PENDED';res.queue=QUEUES[res.pend.key];add('dec','pend','Pended → '+res.queue+': '+res.pend.msg)}
  else{const dn=L.filter(l=>l.deny||l.payU<l.units).length;res.status=L.every(l=>l.deny)?'DENIED':dn?'PARTIAL':'PAID';
    add('dec',res.status==='PAID'?'pass':res.status==='DENIED'?'fail':'warn',(c.touched?'Finalized after review: ':'Auto-adjudicated: ')+res.status+' · pay '+money(res.tot.paid)+' via '+(res.tot.paid>0?'EFT':'$0 835'))}
  res.ms=performance.now()-t0;
  return res;
}
