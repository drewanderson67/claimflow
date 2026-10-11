// ---------- Commit / processing ----------
const FINAL=['PAID','PARTIAL','DENIED'];
function worst(arr){const o=['fail','pend','warn','pass','info','skip'];for(const s of o)if(arr.includes(s))return s;return'skip'}
function commit(c,res,by){
  const st=S.stats,m=mem(c.mid),first=!c.res;
  const oldPaid=c.res&&c.finalized?c.res.tot.paid:0;
  c.res=res;c.status=res.status;c.hist.push({t:Date.now(),s:res.status,by:by||'Auto-adjudication engine',q:res.queue||''});
  if(first){
    const byStage={};res.trace.forEach(t=>(byStage[t.k]=byStage[t.k]||[]).push(t.s));
    for(const k in byStage){const w=worst(byStage[k]);const o=st.stg[k]=st.stg[k]||{p:0,f:0,w:0};if(w==='fail')o.f++;else if(w==='pend')o.w++;else if(w!=='skip')o.p++}
    flashPipe(byStage);
  }
  if(res.status==='REJECTED'){st.rej++;st.carc['999']=(st.carc['999']||0)+1;c.q=null;return}
  if(res.status==='PENDED'){if(!c.q||c.q.key!==res.pend.key)c.q={key:res.pend.key,since:Date.now(),sub:'READY'};return}
  c.q=null;
  if(FINAL.includes(res.status)){
    if(m){if(c.applied){m.acc.ded=r2(m.acc.ded-c.applied.ded);m.acc.oop=r2(m.acc.oop-c.applied.mr)}
      m.acc.ded=r2(m.acc.ded+res.tot.ded);m.acc.oop=r2(m.acc.oop+res.tot.mr);c.applied={ded:res.tot.ded,mr:res.tot.mr}}
    if(!c.finalized){c.finalized=Date.now();st.fin++;
      if(c.touched)st.touched++;else st.auto++;
      if(c.touched){st.tat+=(c.finalized-c.rcv)/1000;st.tatN++}
      st.paid+=res.tot.paid;st.allowed+=res.tot.alw;st.mresp+=res.tot.mr;
      if(res.status==='DENIED')st.denied++;else if(res.status==='PARTIAL')st.partial++;else st.paidCnt++;
      if(res.status==='PAID'&&!c.touched)st.clean++;
      const seen=new Set();res.lines.forEach(l=>{if(l.deny&&!seen.has(l.deny)){seen.add(l.deny);st.carc[l.deny]=(st.carc[l.deny]||0)+1}if(l.payU<l.units&&!seen.has('151')){seen.add('151');st.carc['151']=(st.carc['151']||0)+1}});
      if(S.rules.autoAppeal&&res.status!=='PAID'&&!res.denyKeys.every(k=>['dup','medicare'].includes(k))&&R()<.14)c.appealAt=Date.now()+ri(8,25)*1000;
    }else{const delta=r2(res.tot.paid-oldPaid);if(delta){c.adj.push({t:Date.now(),delta,why:by});st.paid+=delta;st.adjN++}}
  }
}
function trimClaims(){
  if(S.claims.length<=450)return;
  const keepIds=new Set(S.appeals.filter(a=>a.status==='OPEN').map(a=>a.cid));
  for(let i=S.claims.length-1;i>=0&&S.claims.length>400;i--){const c=S.claims[i];if(c.status!=='PENDED'&&!keepIds.has(c.id))S.claims.splice(i,1)}
}
function process(c,src){
  S.stats.rcv++;S.stats.billed+=c.lines.reduce((s,l)=>s+l.chg,0);
  if(S.ui.poc){const r=pocCheck(c,true);if(r==='blocked'){c.status='INTERCEPTED';c.hist=[{t:Date.now(),s:'INTERCEPTED',by:'Optum Real (point of care)'}];S.claims.unshift(c);trimClaims();flashPipe({poc:['fail']});addFeed(c);return c}}
  const res=adjudicate(c);S.stats.lat+=res.ms;S.stats.latN++;
  S.claims.unshift(c);commit(c,res);
  if(c.status==='PENDED')aiTriage(c);
  if(c.status==='REJECTED'&&src!=='user'&&R()<.5)c.resubAt=Date.now()+ri(6,20)*1000;
  trimClaims();addFeed(c);return c;
}
function aiTriage(c){
  const k=c.q&&c.q.key;if(!k)return;
  if(k==='auth'&&!c.ai){const l=c.res.lines.find(x=>x.pendKey==='auth');const pf=l&&MEDNEC[l.cpt];const ok=!pf||c.dx.some(d=>pf.some(x=>d.startsWith(x)));
    c.ai={rec:ok?'approve':'deny',conf:r2(ok?.84+c.seed*.15:.8+c.seed*.15),why:ok?'Clinical criteria met: diagnosis '+c.dx.join(', ')+' supports '+(l?l.cpt:'service')+'; conservative therapy documented.':'Diagnosis does not meet medical-policy criteria for '+(l?l.cpt:'service')+'.'}}
  if(k==='fraud'&&!c.ai){const p=prov(c.npi);c.ai={rec:p.watch?'records':'release',conf:r2(.6+c.seed*.3),why:(c.res.fraudWhy||[]).join('; ')||'Low-risk pattern'}}
  if(S.rules.aiAssist&&['auth','mednec'].includes(k)&&c.ai&&c.ai.conf>=S.rules.aiConf&&!c.aiDone){
    c.aiDone=1;S.stats.aiAuto++;
    if(c.ai.rec==='approve')c.ov[k]=1;else c.forceDeny={key:k};
    const res=adjudicate(c);commit(c,res,'Optum Claim Review AI ('+Math.round(c.ai.conf*100)+'% conf.)');
    log('AI auto-'+(c.ai.rec==='approve'?'approved':'denied')+' '+c.id+' ('+QUEUES[k]+', '+Math.round(c.ai.conf*100)+'%)','ai');
    if(c.status==='PENDED')aiTriage(c);
  }
}
// ---------- Examiner actions ----------
function act(c,action,who,extra){
  if(!c||c.status!=='PENDED')return;
  const k=c.q.key;c.touched=true;who=who||'You (examiner)';
  if(action==='request'){c.q.sub='AWAITING';c.q.until=Date.now()+ri(12,30)*1000;c.hist.push({t:Date.now(),s:'PENDED',by:who,q:'Requested '+(k==='cob'?'primary EOB':k==='fraud'?'medical records':'additional information')+' (277 P3)'});log(who+' requested info on '+c.id+' ('+QUEUES[k]+')');return}
  if(action==='approve'){c.ov[k]=1;if(k==='cob')c.ov.cobAmt=extra!=null?extra:-1}
  if(action==='deny')c.forceDeny={key:k};
  const res=adjudicate(c);commit(c,res,who+' · '+action+' ('+QUEUES[k]+')');
  log(who+' '+(action==='approve'?'approved':'denied')+' '+c.id+' → '+c.status+' '+money(c.res.tot.paid),action==='approve'?'ok':'bad');
  if(c.status==='PENDED')aiTriage(c);
}
function simExaminers(){
  const now=Date.now();
  S.claims.forEach(c=>{if(c.status==='PENDED'&&c.q.sub==='AWAITING'&&now>=c.q.until){
    c.q.sub='READY';c.q.recv=1;const k=c.q.key;
    if(k==='cob'){c.cob=-1;const res=adjudicate(c);commit(c,res,'Primary EOB received (COB)');log('Primary EOB received for '+c.id+' → '+c.status)}
    else if(k==='auth'&&R()<.6){const a='A'+ri(10000000,99999999);S.auth[c.mid+'|'+c.dos]=a;c.auth=a;const res=adjudicate(c);commit(c,res,'Retro-auth '+a+' approved');log('Retro-auth received for '+c.id+' → '+c.status)}
    else c.hist.push({t:now,s:'PENDED',by:'Provider',q:'Records received'});
  }});
  const ready=S.claims.filter(c=>c.status==='PENDED'&&c.q.sub==='READY'&&now-c.q.since>5000).sort((a,b)=>a.q.since-b.q.since);
  for(let i=0;i<S.rules.examiners&&ready.length;i++){if(R()>.3)continue;const c=ready.shift(),k=c.q.key,who='Examiner EX-'+(101+i),p=prov(c.npi);let a;
    if(k==='mednec')a=c.ai&&R()<.85?c.ai.rec:(R()<.5?'approve':'deny');
    else if(k==='auth')a=c.ai&&c.ai.rec==='approve'?(R()<.85?'approve':'request'):(c.q.recv?'deny':R()<.5?'request':'deny');
    else if(k==='cob')a=c.q.recv?'approve':R()<.6?'request':'approve';
    else if(k==='fraud')a=p.watch?(c.q.recv?(R()<.6?'deny':'approve'):R()<.6?'request':'deny'):'approve';
    else a=R()<.9||c.q.recv?'approve':'request';
    act(c,a,who.replace('Examiner',k==='fraud'?'SIU':k==='mednec'||k==='auth'?'RN reviewer':'Examiner'));
  }
}
// ---------- Appeals ----------
const APPEAL_REASONS={elig:'Member had coverage on DOS per employer retro-enrollment',tf:'Original claim was submitted timely; clearinghouse 999 attached',oon:'Continuity of care / no in-network specialist available',
 auth:'Urgent service; authorization requested same day',bundle:'Distinct procedural service — modifier 59 documented',mue:'Medical record supports additional units',mednec:'Clinical notes document failed conservative therapy',
 sex:'Diagnosis coding corrected',cob:'Primary payer EOB attached',fraud:'Records support level of service billed',hd:'Itemized bill and op note attached',medicare:'Requesting benefit exception',dup:'Distinct service on same day'};
function canAppeal(c){return c&&['DENIED','PARTIAL'].includes(c.status)&&!S.appeals.some(a=>a.cid===c.id&&a.status==='OPEN')}
function fileAppeal(c,by,reason){
  if(!canAppeal(c))return null;const lvl=S.appeals.filter(a=>a.cid===c.id).length+1;
  const a={id:'APL-'+String(S.apSeq++).padStart(5,'0'),cid:c.id,by,lvl,reason:reason||APPEAL_REASONS[c.res.denyKeys[0]]||'Request reconsideration',filed:Date.now(),status:'OPEN',keys:[...c.res.denyKeys],paidBefore:c.res.tot.paid,due:addDays(iso(today()),lvl===1?30:60)};
  S.appeals.unshift(a);c.hist.push({t:Date.now(),s:c.status,by,q:'Appeal '+a.id+' filed (level '+lvl+')'});log(by+' filed appeal '+a.id+' on '+c.id+': '+a.reason);return a;
}
function resolveAppeal(a,outcome,who,note){
  const c=S.claims.find(x=>x.id===a.cid);if(!c||a.status!=='OPEN')return;
  a.status=outcome;a.closed=Date.now();a.who=who;
  if(outcome==='OVERTURNED'){a.keys.forEach(k=>c.ov[k]=1);c.ov.fraud=1;c.ov.hd=1;if(c.forceDeny)c.forceDeny=null;c.touched=true;
    const before=c.res.tot.paid;const res=adjudicate(c);commit(c,res,'Appeal '+a.id+' overturned by '+who);a.delta=r2(c.res.tot.paid-before);
    a.note=note||'Overturned: '+a.reason;log(who+' overturned '+a.id+' → '+c.id+' '+c.status+' (+'+money(a.delta)+')','ok')}
  else{a.note=note||'Original determination upheld; '+(a.keys.map(k=>KEY_LABEL[k]||k).join(', '))+' edit supported by policy';a.delta=0;c.hist.push({t:Date.now(),s:c.status,by:who,q:'Appeal '+a.id+' upheld'});log(who+' upheld '+a.id+' on '+c.id,'bad')}
}
function simAppeals(){
  const now=Date.now();
  S.claims.forEach(c=>{if(c.appealAt&&now>=c.appealAt){c.appealAt=null;fileAppeal(c,'Provider ('+(prov(c.npi)||{}).name+')')}
    if(c.resubAt&&now>=c.resubAt){c.resubAt=null;if(c.orig&&['badnpi','nodx','baddx'].includes(c.defect)){const n={...JSON.parse(JSON.stringify(c)),...newClaimId(),...JSON.parse(JSON.stringify(c.orig)),rcv:Date.now(),hist:[],adj:[],res:null,status:null,q:null,finalized:null,applied:null,defect:null,orig:null,ov:{},resubOf:c.id,channel:c.channel};log('Provider corrected & resubmitted '+c.id+' as '+n.id);process(n)}}});
  if(!S.rules.examiners)return;
  S.appeals.forEach(a=>{if(a.status==='OPEN'&&now-a.filed>20000&&R()<.12){const odds={tf:.4,auth:.55,mednec:.45,bundle:.3,mue:.35,elig:.15,oon:.25,cob:.7,fraud:.3,hd:.5,sex:.6}[a.keys[0]]??.25;
    resolveAppeal(a,R()<odds?'OVERTURNED':'UPHELD','Appeals analyst AP-'+ri(201,209))}});
}
// ---------- Payment integrity: post-pay mining ----------
function runMining(){
  let n=0;
  S.claims.forEach(c=>{if(!['PAID','PARTIAL'].includes(c.status)||S.recov.some(r=>r.cid===c.id))return;const p=prov(c.npi),m=mem(c.mid);
    let r=null;const l5=c.res.lines.find(l=>l.cpt==='99215'&&l.paid>0);
    if(p.watch&&l5)r={type:'Upcoding (E&M 99215 → 99214)',amt:r2(Math.min(l5.paid,(185-131)*p.mult*.8)),why:'Provider bills level-5 E&M at '+provStats(p).e5+'% vs. peer norm ~6%'};
    else if(m.other&&c.cob==null&&!c.ov.cobAmt&&!S.rules.cobPend)r={type:'COB – other primary payer',amt:r2(c.res.tot.paid*.65),why:m.other+' was primary on DOS'};
    else if(c.defect==='dup'&&c.dupOf)r={type:'Duplicate payment',amt:c.res.tot.paid,why:'Same services paid on '+c.dupOf};
    else if(c.res.lines.some(l=>l.payU<l.units)&&false)r=null;
    if(r&&r.amt>0){S.recov.unshift({id:'REC-'+String(S.recov.length+1).padStart(4,'0'),cid:c.id,npi:c.npi,...r,status:'IDENTIFIED',t:Date.now()});n++}});
  log('Post-pay data mining scanned '+S.claims.length+' claims → '+n+' new overpayment opportunities');return n;
}
function recover(r,ok){const c=S.claims.find(x=>x.id===r.cid);r.status=ok?'RECOVERED':'DISMISSED';
  if(ok){S.stats.recovered+=r.amt;if(c){c.adj.push({t:Date.now(),delta:-r.amt,why:'Overpayment recovery '+r.id+' ('+r.type+')'});c.hist.push({t:Date.now(),s:c.status,by:'Payment Integrity',q:'Recovery '+money(r.amt)+' — offset on future 835 (PLB*WO)'})}
    log('Recovered '+money(r.amt)+' on '+r.cid+' ('+r.type+')','ok')}}
function provStats(p){const cs=S.claims.filter(c=>c.npi===p.npi&&c.res);const em=[];cs.forEach(c=>c.lines.forEach(l=>{if(/^992(0|1)\d$/.test(l.cpt))em.push(l.cpt)}));
  const e5=em.length?Math.round(100*em.filter(x=>/5$/.test(x)).length/em.length):0;const paid=cs.reduce((s,c)=>s+(c.res.tot.paid||0),0);
  const den=cs.filter(c=>['DENIED','REJECTED'].includes(c.status)).length;const fr=cs.length?Math.round(cs.reduce((s,c)=>s+(c.res.fraud||0),0)/cs.length):0;
  return{n:cs.length,e5,em:em.length,paid,den:cs.length?Math.round(100*den/cs.length):0,fr}}
// ---------- Optum Real: point-of-care pre-check ----------
function pocIssues(res,c){const out=[];
  if(res.status==='REJECTED')res.errs.forEach(e=>out.push({k:'intake',m:e[0]}));
  res.denyKeys.forEach(k=>out.push({k,m:KEY_LABEL[k]||k}));
  if(res.pend&&['auth','cob'].includes(res.pend.key))out.push({k:res.pend.key,m:res.pend.msg});
  return out}
function pocFix(c,k){const o=c.orig;
  switch(k){
    case'intake':if(o){c.npi=o.npi;c.dx=[...o.dx];return'Corrected NPI / diagnosis coding before submission'}if(!validNPI(c.npi)){const p=S.providers.find(x=>x.npi.slice(0,8)===c.npi.slice(0,8));if(p){c.npi=p.npi;return'Corrected billing NPI'}}return null;
    case'tf':c.rcvDate=addDays(c.dos,1);return'Submitted in real time at point of care (no filing lag)';
    case'auth':{const a='A'+ri(10000000,99999999);S.auth[c.mid+'|'+c.dos]=a;c.auth=a;return'Real-time prior auth (278) approved: '+a}
    case'bundle':case'mue':if(o){c.lines=JSON.parse(JSON.stringify(o.lines));priceCharges(c);return k==='bundle'?'Removed bundled component code (NCCI)':'Reduced units to MUE limit'}return null;
    case'mednec':case'sex':if(o){c.dx=[...o.dx];return'Diagnosis coding corrected to match documentation'}return null;
    case'cob':c.cob=-1;return'Primary payer response retrieved in real time (COB)';
    default:return null}}
function pocCheck(c,apply){
  const blockers={elig:'Coverage inactive on DOS — patient informed before service (self-pay / update coverage)',dup:'Duplicate of a claim already on file — not resubmitted',oon:'Out-of-network for HMO — patient redirected to in-network provider',medicare:'Service not a plan benefit — patient informed (ABN/estimate)'};
  let res=adjudicate(c),iss=pocIssues(res,c);const notes=[];
  if(!iss.length){c.pocNote='Optum Real pre-check: clean · est. patient responsibility '+money(res.tot.mr);return'clean'}
  if(!apply)return iss;
  if(R()>.88){c.pocNote='Optum Real flagged '+iss.map(i=>i.m).join('; ')+' — provider submitted without correcting';return'ignored'}
  for(let pass=0;pass<3&&iss.length;pass++){
    const b=iss.find(i=>blockers[i.k]);if(b){S.stats.poc++;S.stats.pocBlocked++;S.stats.pocSaved+=57;c.pocNote='Optum Real intercepted: '+blockers[b.k];log('Optum Real intercepted '+c.id+': '+blockers[b.k],'poc');return'blocked'}
    let fixed=false;iss.forEach(i=>{const m=pocFix(c,i.k);if(m){notes.push(m);fixed=true}});
    if(!fixed)break;res=adjudicate(c);iss=pocIssues(res,c);
  }
  c.ai=null;
  if(notes.length){S.stats.poc++;S.stats.pocFixed++;S.stats.pocSaved+=57;c.pocNote='Optum Real fixed at point of care: '+notes.join('; ');log('Optum Real: '+c.id+' — '+notes.join('; '),'poc');return'fixed'}
  c.pocNote='Optum Real pre-check: '+iss.map(i=>i.m).join('; ');return'ignored';
}
// ---------- EDI renderers ----------
function ediHdr(type,ver,date){const d=d8(date),t='1200';return['ISA*00*          *00*          *ZZ*'+(type==='837'?'CLEARINGHOUSE  ':'87726          ')+'*ZZ*'+(type==='837'?'87726          ':'CLEARINGHOUSE  ')+'*'+d.slice(2)+'*'+t+'*^*00501*'+String(Math.floor(Math.random()*1e9)).padStart(9,'0')+'*0*P*:~','GS*'+({837:'HC',835:'HP',277:'HN',999:'FA'})[type]+'*SENDER*RECEIVER*'+d+'*'+t+'*1*X*'+ver+'~','ST*'+type+'*0001*'+ver+'~']}
function ediTrl(seg){return[...seg,'SE*'+(seg.length+1-2)+'*0001~','GE*1*1~','IEA*1*000000001~']}
function gen837(c){const p=prov(c.npi)||{name:'UNKNOWN',tin:'000000000'},m=mem(c.mid)||{ln:'UNKNOWN',fn:'',dob:'1900-01-01',sex:'U',grp:''};
  const s=ediHdr('837','005010X222A1',iso(c.rcv));
  s.push('BHT*0019*00*'+c.id+'*'+d8(iso(c.rcv))+'*1200*CH~','NM1*41*2*'+p.name.toUpperCase()+'*****46*'+p.tin+'~','NM1*40*2*UNITEDHEALTHCARE*****46*87726~','HL*1**20*1~',
   'NM1*85*2*'+p.name.toUpperCase()+'*****XX*'+c.npi+'~','N3*100 MAIN ST~','N4*MINNEAPOLIS*MN*55401~','REF*EI*'+p.tin+'~','HL*2*1*22*0~','SBR*P*18*'+m.grp+'******CI~',
   'NM1*IL*1*'+m.ln.toUpperCase()+'*'+m.fn.toUpperCase()+'****MI*'+c.mid+'~','DMG*D8*'+d8(m.dob)+'*'+m.sex+'~','NM1*PR*2*UNITEDHEALTHCARE*****PI*87726~',
   'CLM*'+c.id+'*'+c.lines.reduce((a,l)=>a+l.chg,0).toFixed(2)+'***'+c.pos+':B:'+c.freq+'*Y*A*Y*Y~');
  if(c.auth)s.push('REF*G1*'+c.auth+'~');if(c.freq==='7'&&c.resubOf)s.push('REF*F8*'+c.resubOf+'~');
  if(c.dx.length)s.push('HI*'+c.dx.map((d,i)=>(i?'ABF:':'ABK:')+d.replace('.','')).join('*')+'~');
  c.lines.forEach((l,i)=>s.push('LX*'+(i+1)+'~','SV1*HC:'+l.cpt+(l.mods&&l.mods.length?':'+l.mods.join(':'):'')+'*'+l.chg.toFixed(2)+'*UN*'+l.units+'***'+c.dx.slice(0,4).map((_,j)=>j+1).join(':')+'~','DTP*472*D8*'+d8(c.dos)+'~'));
  return ediTrl(s).join('\n')}
function parse837(txt){const segs=txt.replace(/\r/g,'').split(/~\s*/).map(x=>x.trim()).filter(Boolean).map(x=>x.split('*'));
  const c={dx:[],lines:[],mods:[]};let lastL=null;
  segs.forEach(s=>{const id=s[0];
    if(id==='NM1'&&s[1]==='85')c.npi=s[9];if(id==='NM1'&&s[1]==='IL')c.mid=s[9];
    if(id==='CLM'){c.pcn=s[1];const p=(s[5]||'').split(':');c.pos=p[0];c.freq=p[2]||'1'}
    if(id==='REF'&&s[1]==='G1')c.auth=s[2];
    if(id==='HI')s.slice(1).forEach(x=>{const v=(x.split(':')[1]||'').toUpperCase();if(v)c.dx.push(v.length>3?v.slice(0,3)+'.'+v.slice(3):v)});
    if(id==='SV1'){const p=s[1].split(':');lastL={cpt:p[1],mods:p.slice(2).filter(Boolean),chg:+s[2]||0,units:+s[4]||1};c.lines.push(lastL)}
    if(id==='DTP'&&s[1]==='472'){const d=s[3];c.dos=d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)}});
  return c}
function clpStatus(c){if(c.status==='DENIED')return'4';if(c.res&&c.res.cobPrimary!=null)return'2';return'1'}
function gen835(c){const r=c.res;if(!r||!FINAL.includes(c.status))return'No 835 yet — claim status is '+c.status+'. An 835 is produced only once the claim is finalized.';
  const p=prov(c.npi),m=mem(c.mid),dt=iso(c.finalized||Date.now()),paid=r.tot.paid;const s=ediHdr('835','005010X221A1',dt);
  s.push(paid>0?'BPR*I*'+paid.toFixed(2)+'*C*ACH*CCP*01*091000019*DA*1234567*1410000000**01*091000022*DA*9876543*'+d8(addDays(dt,2))+'~':'BPR*H*0*C*NON************'+d8(dt)+'~',
   'TRN*1*'+(paid>0?'EFT':'NP')+c.icn.slice(-8)+'*1410000000~','DTM*405*'+d8(dt)+'~','N1*PR*UNITEDHEALTHCARE~','N3*PO BOX 30555~','N4*SALT LAKE CITY*UT*84130~','PER*BL*PROVIDER SERVICES*TE*8778423210~',
   'N1*PE*'+p.name.toUpperCase()+'*XX*'+c.npi+'~','REF*TJ*'+p.tin+'~','LX*1~',
   'CLP*'+c.id+'*'+clpStatus(c)+'*'+r.tot.chg.toFixed(2)+'*'+paid.toFixed(2)+'*'+r.tot.mr.toFixed(2)+'*'+(PLANS[m.plan].medicare?'MB':'12')+'*'+c.icn+'*'+c.pos+'*'+c.freq+'~',
   'NM1*QC*1*'+m.ln.toUpperCase()+'*'+m.fn.toUpperCase()+'****MI*'+c.mid+'~','DTM*232*'+d8(c.dos)+'~');
  r.lines.forEach(l=>{s.push('SVC*HC:'+l.cpt+(l.mods.length?':'+l.mods.join(':'):'')+'*'+l.chg.toFixed(2)+'*'+l.paid.toFixed(2)+'**'+l.payU+'~','DTM*472*'+d8(c.dos)+'~');
    const g={};l.cas.forEach(([gr,cd,a])=>{(g[gr]=g[gr]||[]).push(cd+'*'+a.toFixed(2))});for(const gr in g)s.push('CAS*'+gr+'*'+g[gr].join('**')+'~');
    if(l.alw)s.push('AMT*B6*'+l.alw.toFixed(2)+'~');if(l.deny==='50')s.push('LQ*HE*N115~');if(l.deny==='197')s.push('LQ*HE*N54~')});
  c.adj.forEach(a=>{if(a.delta<0)s.push('PLB*'+c.npi+'*'+d8(iso(a.t))+'-1231*WO:'+c.icn+'*'+(-a.delta).toFixed(2)+'~')});
  return ediTrl(s).join('\n')}
function status277(c){const q=c.q;switch(c.status){case'PAID':case'PARTIAL':return['F1','65','Finalized/Payment — claim paid'];case'DENIED':return['F2','65','Finalized/Denial'];
  case'PENDED':return q&&q.sub==='AWAITING'?['P3','21','Pending/Provider requested information — missing/invalid information']:['P2','20','Pending/Payer review — accepted for processing, '+(QUEUES[q?q.key:'info'])];
  case'REJECTED':return['A3','21','Acknowledgement/Returned as unprocessable — missing or invalid information'];case'INTERCEPTED':return['A8','—','Not submitted — resolved at point of care (Optum Real)'];default:return['A1','20','Received']}}
function gen277(c){const [cat,code,txt]=status277(c);const s=ediHdr('277','005010X212',iso(Date.now()));
  s.push('BHT*0010*08*'+c.id+'*'+d8(iso(Date.now()))+'*1200*DG~','HL*1**20*1~','NM1*PR*2*UNITEDHEALTHCARE*****PI*87726~','HL*2*1*21*1~','NM1*41*2*CLEARINGHOUSE*****46*CH001~',
   'HL*3*2*19*1~','NM1*1P*2*'+(prov(c.npi)||{name:'UNKNOWN'}).name.toUpperCase()+'*****XX*'+c.npi+'~','HL*4*3*22*0~','NM1*IL*1*'+((mem(c.mid)||{}).ln||'').toUpperCase()+'****MI*'+c.mid+'~',
   'TRN*2*'+c.id+'~','STC*'+cat+':'+code+'*'+d8(iso(Date.now()))+'**'+(c.res?c.res.tot.chg.toFixed(2):'0')+'*'+(c.res&&FINAL.includes(c.status)?c.res.tot.paid.toFixed(2):'0')+'~','REF*1K*'+c.icn+'~','DTP*472*D8*'+d8(c.dos)+'~');
  return{edi:ediTrl(s).join('\n'),cat,code,txt}}
function gen999(c){const s=ediHdr('999','005010X231A1',iso(c.rcv));s.push('AK1*HC*1*005010X222A1~','AK2*837*0001*005010X222A1~');
  (c.res.errs||[]).forEach(e=>{const seg=e[1].split(/[ *\/]/)[0];s.push('IK3*'+seg+'*1**8~','IK4*'+(seg==='NM1'?'9':'1')+'**7*'+(e[0].match(/[\w.]+$/)||[''])[0]+'~','CTX*'+e[0].slice(0,60).toUpperCase()+'~')});
  s.push('IK5*R*5~','AK9*R*1*1*0~');return ediTrl(s).join('\n')}
// ---------- Persistence ----------
const LS='claimsAdj.v1';
function save(){try{const keep=S.claims.slice(0,260);localStorage.setItem(LS,JSON.stringify({...S,claims:keep,log:S.log.slice(0,60)}))}catch(e){try{localStorage.setItem(LS,JSON.stringify({...S,claims:S.claims.slice(0,60),log:[]}))}catch(_){}}}
function load(){try{const j=JSON.parse(localStorage.getItem(LS));if(j&&j.v===VERSION&&j.members){j.rules={...DEFAULT_RULES,...j.rules};j.stats={...freshStats(),...j.stats};return j}}catch(e){}return null}
