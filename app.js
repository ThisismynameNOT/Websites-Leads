(function () {
'use strict';
var REPO = 'https://github.com/ThisismynameNOT/Websites-Leads';
var STORE_KEY = 'fieldnotes-crm-v1';
var state = { leads: [], topTen: [], threePicks: [], researchReports: {}, researchGeneratedAt: null, tab: 'all', search: '', industry: 'all', source: 'all', website: 'all', age: 'all', qualification: {}, sort: 'score', selected: null, generatedAt: null, loading: false };
var $ = function(id) { return document.getElementById(id); };
var safe = function(s) { return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
var text = function(v, empty) { return v == null || v === '' ? (empty || 'Not verified') : String(v); };
var fmt = function(n){ return new Intl.NumberFormat('en-US').format(n || 0); };
var money = function(n){ return new Intl.NumberFormat('en-US').format(Math.round(Number(n)||0)); };
var formatDate = function(s) { if(!s)return 'Not verified'; var d=new Date(s);return isNaN(d.getTime())?'Not verified':d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); };
var url = function(v){try{var p=new URL(String(v));return (p.protocol==='https:'||p.protocol==='http:')?p.href:null;}catch(e){return null;}};
var feedbackTimer;
function toast(message){var node=$('toast');node.textContent=message;node.classList.add('visible');clearTimeout(feedbackTimer);feedbackTimer=setTimeout(function(){node.classList.remove('visible');},3000);}
function storage(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}');}catch(e){return {};}}
function updateStorage(id, patch){try{var a=storage();a[id]=Object.assign({},a[id]||{},patch);localStorage.setItem(STORE_KEY,JSON.stringify(a));}catch(e){toast('Local storage is unavailable.');}}
function local(id){return storage()[id]||{};}
function normalize(l){return Object.assign({id:'',name:'Unknown company',industry:'Other',district:'Prague',address:'',ico:'',website:'',website_status:'unknown',email:'',phone:'',instagram:'',opened_at:null,registered_at:null,website_score:null,score:0,score_reason:'',reason:'',buying_signals:[],verification:'candidate',demo_potential:'Unknown',offer:'Professional business website',deal_min_czk:15000,deal_max_czk:35000,source_urls:[],first_seen:'',last_seen:''},l);}
function priority(n){return n>=80?'hot':n>=60?'possible':'low';}
function priorityName(n){return n>=80?'HIGH PRIORITY':n>=60?'FURTHER RESEARCH':'LOW PRIORITY';}
function countStats(){
 var t=state.topTen||[],n=t.filter(x=>x.type==='new').length;
 $('stat-total').textContent=t.length+' / 10';$('stat-hot').textContent=n;
 $('stat-unlisted').textContent=t.length-n;$('stat-value').textContent=String(10-t.length).padStart(2,'0');
 $('nav-count').textContent=t.length;
}
function industryChart(){
 var c={};(state.topTen||[]).forEach(x=>{var k=x.lead.industry||'Other';c[k]=(c[k]||0)+1;});
 var entries=Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5);
 $('industry-chart').innerHTML=entries.length?entries.map(e=>'<div class="bar-row"><span class="bar-label">'+safe(e[0])+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(100*e[1]/entries[0][1])+'%"></div></div><span class="bar-number">'+e[1]+'</span></div>').join(''):'<div class="muted-empty">No evidence-qualified businesses yet. Completed website research is required before appearing here.</div>';
}
function focus(){
 var x=(state.topTen||[])[0],l=x&&x.lead;
 if(!l){$('focus-content').innerHTML='<div class="focus-placeholder">The leading prospect appears after evidence-based website research qualifies an opportunity.</div>';return;}
 $('focus-content').innerHTML='<div class="focus-signal">'+safe(x.label)+'</div><h4 class="focus-company">'+safe(l.name)+'</h4><p class="focus-summary">'+safe(x.reason)+'</p><div class="focus-footer"><span class="focus-score">'+Number(l.score||0)+'/100 · research candidate</span><button type="button" id="focus-open" class="focus-button">Open dossier ↗</button></div>';
 $('focus-open').addEventListener('click',()=>openLead(l.id));
}
function todayPrague(){try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(e){return new Date().toISOString().slice(0,10);}}
function threePicks(){
 var first=(state.topTen||[]).slice(0,3);state.threePicks=first;
 $('top-three').innerHTML=[0,1,2].map(i=>{
  var x=first[i];if(!x)return '<article class="pick-card pick-empty"><div class="pick-rank">0'+(i+1)+' / OPEN SLOT</div><h3>Evidence pending</h3><p>No additional company has passed the independent website checks. We do not invent missing websites or technical problems.</p></article>';
  var l=x.lead,e=x.evidence&&url(x.evidence)?'<a href="'+safe(url(x.evidence))+'" target="_blank" rel="noopener noreferrer">Source ↗</a>':'';
  return '<article class="pick-card radar-pick"><div class="pick-card-top"><span class="pick-rank">0'+(i+1)+' / WEBSITE OPPORTUNITY</span><span class="pick-state pending">◌ REVIEW FIRST</span></div>'+
   '<h3 class="radar-pick-name">'+safe(l.name)+'</h3><div class="pick-detail"><div class="pick-label">'+safe(x.label)+'</div><p>'+safe(x.reason)+'</p></div><div class="pick-contact">'+safe(l.industry||'')+' · '+safe(l.registered_at||'Date pending')+'</div><div class="pick-actions"><button type="button" class="pick-dossier" data-radar-pick="'+safe(l.id)+'">View dossier ↗</button><div class="pick-sources">'+e+'</div></div></article>';
 }).join('');
 document.querySelectorAll('[data-radar-pick]').forEach(b=>b.addEventListener('click',()=>openLead(b.dataset.radarPick)));
 var node=$('criteria-list');if(node&&window.FieldnotesPicks)node.innerHTML=window.FieldnotesPicks.constraints.map(c=>'<div class="criterion"><strong>'+safe(c[0])+'</strong><p>'+safe(c[1])+'</p></div>').join('');
}
function researchDesk(){}
function filtered(){return (state.topTen||[]).map(x=>x.lead);}
function websiteLabel(l){
 var x=(state.topTen||[]).find(x=>x.lead.id===l.id);
 return !x?'<span class="website-pill unknown">Not checked</span>':x.type==='new'?'<span class="website-pill no">● No verified site</span>':'<span class="website-pill yes">● Audited</span>';
}
function list(){
 var arr=state.topTen||[];
 $('result-count').textContent=arr.length+' / 10 opportunities';
 $('table-summary').textContent=arr.length+' evidence-backed leads · '+(10-arr.length)+' open slots';
 $('leads-body').innerHTML=[0,1,2,3,4,5,6,7,8,9].map(i=>{
  var x=arr[i];if(!x)return '<tr class="radar-pending-row"><td><span class="rank-number">'+String(i+1).padStart(2,'0')+'</span><span class="company-name">Awaiting research</span></td><td colspan="4"><span class="pending-copy">No additional company has verified website opportunity evidence yet.</span></td><td>—</td></tr>';
  var l=x.lead,score=Number(l.score||0);
  var site=x.verifiedSite&&url(x.verifiedSite)?'<a class="radar-site" href="'+safe(url(x.verifiedSite))+'" target="_blank" rel="noopener noreferrer">View site ↗</a>':'<span class="website-pill no">No company website verified</span>';
  return '<tr class="radar-live-row" role="button" tabindex="0" data-id="'+safe(l.id)+'" aria-label="Open dossier for '+safe(l.name)+'"><td><span class="rank-number">'+String(i+1).padStart(2,'0')+'</span><span class="company-name">'+safe(l.name)+'</span><span class="company-meta">'+safe(l.industry||'')+' · '+safe(l.ico?'IČO '+l.ico:'Identity pending')+'</span></td>'+
   '<td><span class="radar-type '+safe(x.type)+'">'+safe(x.label)+'</span></td><td><span class="radar-why">'+safe(x.reason)+'</span><span class="radar-meta">Checked '+safe(x.checked_at||'date unknown')+'</span></td><td>'+site+'</td>'+
   '<td><div class="score-group"><span class="score-number">'+score+'</span><div class="score-track"><div class="score-progress" style="width:'+Math.max(0,Math.min(100,score))+'%"></div></div><span class="radar-meta">/ 100 · budget unknown</span></div></td><td class="row-arrow">↗</td></tr>';
 }).join('');
 $('empty-state').hidden=true;
 document.querySelectorAll('tr[data-id]').forEach(row=>{row.addEventListener('click',e=>{if(!e.target.closest('a'))openLead(row.dataset.id);});row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openLead(row.dataset.id);}});});
}
function setTab(tab){state.tab=tab;document.querySelectorAll('[data-tab]').forEach(function(el){el.classList.toggle('active',el.dataset.tab===tab);});list();}
function link(label, href){var href2=url(href);return href2?'<a href="'+safe(href2)+'" rel="noopener noreferrer" target="_blank">'+safe(label)+' ↗</a>':'<span>'+safe(text(href))+'</span>';}
function opening(l){return l.opened_at?'Opened '+formatDate(l.opened_at):l.premises_registered_at?'Premises registered '+formatDate(l.premises_registered_at):l.registered_at?'Registered '+formatDate(l.registered_at):'Date not verified';}
function qualificationDetails(l){
 var score=l.score_breakdown||{},fin=l.financial||{status:'not_verified',facts:[]};
 var names={website_opportunity:'Verified website opportunity',financial_capacity:'Financial capacity',
 business_activity:'Active business credibility',lead_generation_value:'Lead-generation value',
 accessible_contact:'Accessible contact',cms_suitability:'CMS suitability'};
 var maxima={website_opportunity:25,financial_capacity:25,business_activity:20,lead_generation_value:15,accessible_contact:10,cms_suitability:5};
 var rows=Object.keys(maxima).map(function(k){return '<div class="score-breakdown-row"><span>'+safe(names[k])+'</span><strong>'+Number(score[k]||0)+'/'+maxima[k]+'</strong></div>';}).join('');
 var facts=(fin.facts||[]).map(function(x){return '<p>'+safe(x.kind)+' · '+money(x.value_czk)+' Kč · '+safe(x.period_end)+' '+(x.source_url?link('Official evidence',x.source_url):'')+'</p>';}).join('');
 var blockers=(l.outstanding_checks||[]).map(function(x){return '<li>'+safe(x)+'</li>';}).join('');
 return '<div class="dossier-section score-dossier"><h3>Commercial qualification — '+Number(l.score||0)+'/100</h3>'+
  '<p>Status: '+safe(String(l.qualification_status||'research_required').replace(/_/g,' '))+' · '+safe(l.discovery_pipeline||'unknown cohort')+' company · tier '+Number(l.tier||3)+'</p>'+
  rows+'<h4>Financial capacity</h4><p>'+safe(fin.status||'not_verified')+' · confirmed buyer budget: not verified</p>'+
  (facts||'<p>Financial capacity not verified. Proposed website price is not a financial fact.</p>')+
  '<h4>Outstanding validation</h4><ul>'+blockers+'</ul></div>';
}
function researchDetails(l){
 var r=l.research;
 if(!r)return '<div class="dossier-section"><h3>Automated independent research</h3><p>Not researched yet. The daily evidence pass processes a limited set of leads and will not claim unverified facts.</p></div>';
 var d=r.discovery||{},audit=r.audit||{},reg=r.registry||{},report=r.dossier||{},proof=d.identity||[];
 var searchLine=(d.state==='VERIFIED_WEBSITE'||d.state==='verified_website')&&window.FieldnotesRadar&&window.FieldnotesRadar.isIndependent(d.website)?'Verified company website (identity matched)':d.state==='SEARCH_UNAVAILABLE'||d.state==='search_unavailable'?'Website search unavailable / incomplete':d.state==='THIRD_PARTY_PRESENCE_ONLY'?'Only third-party business presence found':d.state==='AMBIGUOUS'?'Potential site identity ambiguous':'Independent search did not confirm a website (not proof none exists)';
 var evidence=proof.length?proof.map(safe).join(' · '):'No identity-matched website evidence';
 var measurements=(audit.objective_issues||[]);
 var renderedIssues=measurements.length?measurements.map(function(x){return '<p class="research-issue"><strong>'+safe(x.issue)+'</strong> — '+safe(x.detail)+' <a href="'+safe(url(x.url)||'#')+'" target="_blank" rel="noopener noreferrer">Source ↗</a></p>';}).join(''):'<p>No browser-measured website problem confirmed.</p>';
 var signals=(r.buying_signals||[]);
 var signalsText=signals.length?signals.map(function(x){return '<p><strong>'+safe(x.claim)+'</strong> — '+safe(x.date)+' · '+(url(x.url)?link('Registry evidence',x.url):'Source unavailable')+'</p>';}).join(''):'No new business-growth signals independently verified.';
 var person=reg.decision_maker;
 var personText=person?'<strong>'+safe(person.name)+'</strong> — '+safe(person.role)+'. '+safe(person.verified_scope||'Published register record')+' · '+(url(person.source)?link('ARES record',person.source):''):'No currently verifiable statutory representative. Never guess who makes purchasing decisions.';
 var factual=(report.facts||[]).map(function(x){return '<p>• '+safe(x)+'</p>';}).join('');
 var sources=(report.sources||[]).filter(url).slice(0,9).map(function(u,i){return link('Evidence '+(i+1),u);}).join(' ');
 return '<div class="dossier-section research-dossier"><div class="research-heading"><h3>Independent research & evidence</h3><span class="research-tag">'+safe(r.state||'research')+' · '+safe(r.checked_at||'date unknown')+'</span></div>'+
  '<div class="research-field"><span class="fact-label">WEBSITE IDENTIFICATION</span><p>'+safe(searchLine)+'</p><p class="research-small">'+safe(evidence)+'</p></div>'+
  '<div class="research-field"><span class="fact-label">DESKTOP & MOBILE AUDIT</span><p>'+safe(audit.state==='observed'?'Browser checks executed, desktop 1365px and mobile 390px.':'Not run: '+(audit.reason||'Site identity not confirmed.'))+'</p>'+renderedIssues+'<p class="research-small">Aesthetic design quality requires reviewing the saved screenshots; DOM metrics are not a complete visual design audit.</p></div>'+
  '<div class="research-field"><span class="fact-label">PUBLIC CONTACT CROSS-CHECK</span><p>'+safe((r.contact_evidence||[]).length?'Public listing contact matched on the identity-verified business site.':'No official-site contact match available; verify phone/email before outreach.')+'</p></div>'+ '<div class="research-field"><span class="fact-label">REGISTERED DIRECTOR / OWNER</span><p>'+personText+'</p></div>'+
  '<div class="research-field"><span class="fact-label">VERIFIED BUYING SIGNALS</span>'+signalsText+'</div>'+
  '<div class="research-field"><span class="fact-label">PERSONALIZED SALES DOSSIER</span>'+factual+'<p><strong>Offer:</strong> '+safe(report.offer||l.offer)+'</p><p><strong>Approach:</strong> '+safe(report.outreach_angle||l.outreach_angle||'Confirm needs directly.')+'</p></div>'+
  '<div class="research-field"><span class="fact-label">SOURCE DOCUMENTS</span><div class="source-list">'+(sources||'No approved sources recorded')+'</div></div>'+
  '<div class="research-field"><span class="fact-label">OUTSTANDING CHECKS</span><p>'+safe((report.limitations||[]).join(' · ')||'Business interest and project budget must be confirmed.')+'</p></div>'+
  '<p class="local-warning">Website search and technical checks are automatic. Buyer willingness, absent websites and subjective aesthetic quality cannot be guaranteed; no outreach is sent automatically.</p></div>';
}
function openLead(id){
 var l=state.leads.find(function(x){return x.id===id;});if(!l)return;state.selected=id;var crm=local(id);
 $('drawer-id').textContent=id.slice(0,20);
 var facts=[
 ['INDUSTRY',l.industry],['LOCATION',l.district||'Prague'],['ADDRESS',l.address||'Not verified'],['FIRST SEEN',formatDate(l.first_seen)],
 ['BUSINESS DATE',opening(l)],['IČO',l.ico||'Not verified'],['WEBSITE',window.FieldnotesRadar&&window.FieldnotesRadar.isIndependent(l.website)?link(l.website,l.website):'No independent site verified'],
 ['WEBSITE AUDIT',l.website_score==null?'Not audited':l.website_score+'/10'],
 ['EMAIL',l.email?'<a href="mailto:'+encodeURIComponent(l.email)+'">'+safe(l.email)+'</a>':'Not found'],['PHONE',l.phone||'Not found'],
 ['EST. PROJECT',money(l.deal_min_czk)+'–'+money(l.deal_max_czk)+' Kč'],['VALIDATION',l.verification||'Candidate']
 ];
 var items=facts.map(function(f,i){return '<div><div class="fact-label">'+safe(f[0])+'</div><div class="fact-value">'+([6,8].includes(i)?f[1]:safe(f[1]))+'</div></div>';}).join('');
 var signals=(l.buying_signals||[]).map(function(t){return '<span class="source-tag">'+safe(t)+'</span>';}).join(' · ')||'No buying signals verified';
 var sources=(l.source_urls||[]).filter(url).slice(0,8).map(function(s,i){return link('Source '+(i+1),s);}).join(' ');
 $('drawer-body').innerHTML='<div class="dossier-top"><div><span class="kicker">PROSPECT PROFILE / '+safe(priorityName(l.score))+'</span><h2 class="dossier-name">'+safe(l.name)+'</h2><p class="dossier-description">'+safe(l.industry)+' · '+safe(l.district)+'</p></div><span class="dossier-score">'+Number(l.score||0)+'<small>/100</small></span></div>'+
 '<div class="fact-grid">'+items+'</div>'+
 '<div class="dossier-section"><h3>Why this opportunity?</h3><p>'+safe(l.reason||'Potential fit to verify before outreach. Source listing may be incomplete.')+'</p></div>'+
 '<div class="dossier-section"><h3>Buying signals</h3><p>'+signals+'</p></div>'+
 '<div class="dossier-section"><h3>Suggested approach</h3><p>'+safe(l.offer||'Professional business website')+'. '+safe(l.outreach_angle||'Confirm the business has no independent website before pitching a conversion-focused web presence.')+'</p></div>'+
 '<div class="dossier-section"><h3>Research notes</h3><p>'+safe(l.score_reason||'Scores are preliminary; not a verified UX audit.')+'</p></div>'+
 qualificationDetails(l)+
 researchDetails(l)+
 '<div class="dossier-section"><h3>Evidence and source links</h3><div class="source-list">'+(sources||'No source links available')+'</div></div>'+
 '<div class="dossier-section"><h3>Your pipeline</h3><div class="crm-row"><label><span class="crm-label">Sales stage</span><select id="crm-stage"><option value="new">New</option><option value="researching">Researching</option><option value="contacted">Contacted</option><option value="meeting">Meeting booked</option><option value="proposal">Proposal sent</option><option value="won">Won</option><option value="lost">Lost</option></select></label><button class="bookmark '+(crm.saved?'saved':'')+'" id="bookmark">'+(crm.saved?'★ Saved':'☆ Save')+'</button></div><div style="margin-top:15px"><label class="crm-label" for="crm-notes">Private notes</label><textarea id="crm-notes" class="notes-textarea" placeholder="Outreach notes, conversation details, next steps..."></textarea></div><p class="local-warning">Sales stages and notes are stored only in this browser. Export a backup before clearing browser data.</p></div>';
 $('crm-stage').value=crm.stage||'new';$('crm-notes').value=crm.notes||'';
 $('crm-stage').addEventListener('change',function(e){updateStorage(id,{stage:e.target.value});toast('Sales stage saved locally');});
 $('crm-notes').addEventListener('input',function(e){updateStorage(id,{notes:e.target.value});});
 $('bookmark').addEventListener('click',function(){var next=!local(id).saved;updateStorage(id,{saved:next});$('bookmark').classList.toggle('saved',next);$('bookmark').textContent=next?'★ Saved':'☆ Save';if(state.tab==='saved')list();});
 $('drawer-backdrop').hidden=false;$('lead-drawer').classList.add('open');$('lead-drawer').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('drawer-close').focus();
}
function closeLead(){state.selected=null;$('drawer-backdrop').hidden=true;$('lead-drawer').classList.remove('open');$('lead-drawer').setAttribute('aria-hidden','true');document.body.style.overflow='';}
async function load(){
 if(state.loading)return;state.loading=true;var btn=$('refresh-btn');btn.disabled=true;$('data-status').textContent='Fetching the latest lead snapshot…';
 try{
 var res=await fetch('./data/leads.json?t='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);
 var data=await res.json();var raw=Array.isArray(data)?data:data.leads;if(!Array.isArray(raw))throw Error('Invalid leads.json format');
 var manual=[];try{var mr=await fetch('./data/manual-leads.json?t='+Date.now(),{cache:'no-store'});if(mr.ok){var md=await mr.json();if(Array.isArray(md.leads))manual=md.leads;}}catch(e){console.warn('Manual lead research temporarily unavailable',e);}
 var byId=new Map();raw.concat(manual).filter(function(x){return x&&x.id&&x.name;}).map(normalize).forEach(function(l){byId.set(l.id,l);});
 var byBusiness=new Map();byId.forEach(function(l){
  var key=l.ico&&/^\d{8}$/.test(String(l.ico))?'ico:'+l.ico:'company:'+String(l.name).toLowerCase().replace(/\W/g,'')+'|'+String(l.address).toLowerCase().replace(/\W/g,'');
  var old=byBusiness.get(key);
  if(!old||l.manual===true&&old.manual!==true)byBusiness.set(key,l);
 });
 state.leads=Array.from(byBusiness.values());state.generatedAt=data.generated_at||null;
 try{
  var rr=await fetch('./data/research.json?t='+Date.now(),{cache:'no-store'});
  if(rr.ok){
   var research=await rr.json();state.researchReports=research.reports||{};state.researchGeneratedAt=research.generated_at||null;
  }
 }catch(researchError){console.warn('Research reports temporarily unavailable',researchError);}
 try{
  var qr=await fetch('./data/qualification.json?t='+Date.now(),{cache:'no-store'});
  if(qr.ok){var qs=await qr.json();state.qualification=qs.companies||{};}
 }catch(qe){console.warn('Qualified scores not ready',qe);}
 try{
  var sr=await fetch('./data/sources.json?t='+Date.now(),{cache:'no-store'});
  if(sr.ok){var status=await sr.json();$('source-status-list').innerHTML=(status.sources||[]).map(function(x){
   return '<div class="source-status-row"><strong>'+safe(x.name)+'</strong><span>'+safe(x.status.replace(/_/g,' '))+'</span></div>';}).join('');}
 }catch(se){$('source-status-list').textContent='Source status manifest unavailable';}
 state.leads.forEach(function(lead){
  var rep=state.researchReports[lead.id];
  if(!rep)return;
  lead.research=rep;
  lead.website_classification=rep.discovery&&rep.discovery.state||'SEARCH_UNAVAILABLE';
  var officialContacts=rep.verified_site_public_contacts||{};
  if(rep.discovery&&rep.discovery.state==='VERIFIED_WEBSITE'){
   if(!lead.email&&Array.isArray(officialContacts.emails)&&officialContacts.emails.length)lead.email=officialContacts.emails[0];
   if(!lead.phone&&Array.isArray(officialContacts.phones)&&officialContacts.phones.length)lead.phone=officialContacts.phones[0];
  }
  if(rep.discovery&&rep.discovery.state==='verified_website'&&url(rep.discovery.website)){
   lead.website=rep.discovery.website;lead.website_status='listed';
  }
  if(rep.registry&&rep.registry.state==='inactive')lead.verification='inactive_registry';
  if(rep.registry&&rep.registry.state==='registry_found'&&/^\d{4}-\d{2}-\d{2}$/.test(rep.registry.registered_at||'')&&!lead.registered_at)lead.registered_at=rep.registry.registered_at;
  var signals=(rep.buying_signals||[]).filter(function(x){return x.evidence_type==='verified_registry';});
  if(signals.length)lead.buying_signals=(lead.buying_signals||[]).concat(signals.map(function(x){return x.claim+' ('+x.date+')';}));
 });
 state.leads.forEach(function(lead){
   var q=state.qualification[lead.id];
   if(q){Object.assign(lead,q);}
   else{lead.score=0;lead.qualification_status='research_required';lead.financial={status:'not_verified',facts:[]};
    lead.score_breakdown={website_opportunity:0,financial_capacity:0,business_activity:0,lead_generation_value:0,accessible_contact:0,cms_suitability:0};
    lead.website_classification=lead.website_classification||'SEARCH_UNAVAILABLE';
    lead.discovery_pipeline=lead.discovery_pipeline||'unknown';
   }
 });
 state.topTen=window.FieldnotesRadar?window.FieldnotesRadar.select(state.leads,todayPrague(),10):[];
 $('data-banner').classList.remove('is-error');$('data-status').textContent='Ten-place evidence radar · '+state.topTen.length+' candidates · website absence is not presumed';
 $('last-updated').textContent='LAST SYNC — '+(state.generatedAt?formatDate(state.generatedAt)+' '+new Date(state.generatedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'NOT YET RUN');
 countStats();industryChart();threePicks();focus();list();
 }catch(e){$('data-banner').classList.add('is-error');$('data-status').textContent='Failed to load leads: '+e.message;$('last-updated').textContent='CHECK WORKFLOW / DATA FILE';if(!state.leads.length){countStats();industryChart();threePicks();focus();list();}}
 finally{state.loading=false;btn.disabled=false;}
}
function exportCsv(){
 var rows=[['Company','Industry','Prague location','IČO','Website status','Website','Email','Phone','Opportunity score','Deal min CZK','Deal max CZK','Research reason','Source','Sales stage','Saved','Private notes']];
 filtered().forEach(function(l){var c=local(l.id);rows.push([l.name,l.industry,l.address||l.district,l.ico,l.website_status,l.website,l.email,l.phone,l.score,l.deal_min_czk,l.deal_max_czk,l.reason,(l.source_urls||[]).join(' '),c.stage||'new',c.saved?'Yes':'No',c.notes||'']);});
 var csv=rows.map(function(r){return r.map(function(v){var s=String(v==null?'':v);if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',');}).join('\r\n');
 var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='prague-top-ten-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1000);toast('Exported '+(rows.length-1)+' leads');
}
$('export-btn').addEventListener('click',exportCsv);$('refresh-btn').addEventListener('click',load);
$('drawer-close').addEventListener('click',closeLead);$('drawer-backdrop').addEventListener('click',closeLead);
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeLead();});
load();setInterval(function(){if(!document.hidden)load();},15*60*1000);
})();