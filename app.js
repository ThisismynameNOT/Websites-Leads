(function () {
'use strict';
var REPO = 'https://github.com/ThisismynameNOT/Websites-Leads';
var STORE_KEY = 'fieldnotes-crm-v1';
var state = { leads: [], threePicks: [], researchReports: {}, researchGeneratedAt: null, tab: 'all', search: '', industry: 'all', sort: 'score', selected: null, generatedAt: null, loading: false };
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
function priority(n){return n>=80?'hot':n>=65?'strong':n>=50?'possible':'low';}
function priorityName(n){return n>=80?'HOT':n>=65?'STRONG':n>=50?'POSSIBLE':'REVIEW';}
function countStats(){
 var all=state.leads,hot=all.filter(function(l){return Number(l.score)>=65;}).length,unlisted=all.filter(function(l){return l.website_status==='not_listed';}).length;
 var upper=all.reduce(function(s,l){return s+(Number(l.deal_max_czk)||0);},0);
 $('stat-total').textContent=fmt(all.length);$('stat-hot').textContent=fmt(hot);$('stat-unlisted').textContent=fmt(unlisted);
 $('stat-value').textContent=upper>=1000000?(upper/1000000).toFixed(1)+'M Kč':upper>=1000?Math.round(upper/1000)+'K Kč':fmt(upper)+' Kč';
 $('nav-count').textContent=fmt(all.length);
}
function industryChart(){
 var c={};state.leads.forEach(function(l){c[l.industry]=(c[l.industry]||0)+1;});
 var groups=Object.entries(c).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
 $('industry-chart').innerHTML=groups.length?groups.map(function(e){return '<div class="bar-row"><span class="bar-label" title="'+safe(e[0])+'">'+safe(e[0])+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(e[1]/Math.max(...groups.map(function(x){return x[1];}))*100)+'%"></div></div><span class="bar-number">'+e[1]+'</span></div>';}).join(''):'<div class="muted-empty">No industry data yet. Trigger the collector from GitHub Actions.</div>';
 var sel=$('industry-filter'),prior=sel.value;sel.innerHTML='<option value="all">All industries</option>'+Object.keys(c).sort().map(function(x){return '<option value="'+safe(x)+'">'+safe(x)+'</option>';}).join('');sel.value=c[prior]?prior:'all';state.industry=sel.value;
}
function focus(){
 var selected=window.FieldnotesPicks?window.FieldnotesPicks.choose(state.leads,todayPrague()):[];
 var l=selected.length?selected[0].lead:null;
 if(!l){$('focus-content').innerHTML='<div class="focus-placeholder">The highest-ranked candidate will appear here after lead discovery begins.</div>';return;}
 $('focus-content').innerHTML='<h4 class="focus-company">'+safe(l.name)+'</h4><p class="focus-summary">'+safe(l.reason||'A candidate for further research. Review source evidence before reaching out.')+'</p><div class="focus-footer"><span class="focus-score">'+Number(l.score||0)+'/100 · '+priorityName(Number(l.score||0))+'</span><button type="button" id="focus-open" class="focus-button">Open dossier ↗</button></div>';
 $('focus-open').addEventListener('click',function(){openLead(l.id);});
}
function todayPrague(){try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(e){return new Date().toISOString().slice(0,10);}}
function threePicks(){
 var policy=window.FieldnotesPicks;
 if(!policy){$('top-three').innerHTML='<div class="muted-empty">Selection policy failed to load. Check picks.js.</div>';return;}
 var result=policy.choose(state.leads,todayPrague());
 state.threePicks=result;
 $('top-three').innerHTML=[0,1,2].map(function(i){
  var choice=result[i];
  if(!choice)return '<article class="pick-card pick-empty"><div class="pick-rank">0'+(i+1)+' / NOT FILLED</div><h3>Qualification pending</h3><p>There are not enough acceptable leads. We will not invent a company to fill this slot.</p></article>';
  var l=choice.lead,qual=choice.status==='qualified';
  var contact=l.email?'Public email listed':l.phone?'Public phone listed':l.instagram?'Instagram listed':'Contact needs validation';
  var evidence=l.research||{},discovery=evidence.discovery||{},audit=evidence.audit||{},registry=evidence.registry||{};
  var researchStatus=!l.research?'Research pending':discovery.state==='verified_website'?(audit.state==='observed'?'Site + responsive audit completed':'Site identity independently matched'):'Independent search: '+String(discovery.state||'unavailable').replace(/_/g,' ');
  var nIssues=(audit.objective_issues||[]).length;
  var evidenceLine=nIssues?' · '+nIssues+' measured issue'+(nIssues===1?'':'s'):'';
  var contactEvidence=(evidence.contact_evidence||[]).length>0?'Contact matched on company site':'Public contact not cross-verified';
  var sources=(l.source_urls||[]).filter(url).slice(0,2).map(function(u,k){return '<a href="'+safe(url(u))+'" target="_blank" rel="noopener noreferrer">Evidence '+(k+1)+' ↗</a>';}).join('');
  return '<article class="pick-card'+(qual?' qualified':'')+'">'+
    '<div class="pick-card-top"><span class="pick-rank">0'+(i+1)+' / SELECTED PROSPECT</span><span class="pick-state '+(qual?'verified':'pending')+'">'+(qual?'✓ Qualified':'◌ Research required')+'</span></div>'+
    '<div class="pick-company">'+safe(l.name)+'</div><div class="pick-location">'+safe(l.district)+' · '+safe(l.industry)+'</div>'+
    '<div class="pick-detail"><div class="pick-label">WHY CONSIDER IT</div><p>'+safe(l.reason||'Requires further research.')+'</p></div>'+
    '<div class="pick-detail"><div class="pick-label">WEBSITE TO PROPOSE</div><p>'+safe(l.offer||'Mobile-first professional website')+'</p></div>'+
    '<div class="pick-keyline"><span class="pick-score">'+Number(l.score||0)+'<small>/100</small></span><div><strong>'+Math.round(Number(l.deal_min_czk||15000)/1000)+'–'+Math.round(Number(l.deal_max_czk||35000)/1000)+'K Kč</strong><small>INDICATIVE WEBSITE PITCH</small></div></div>'+
    '<div class="pick-contact">'+safe(researchStatus+evidenceLine)+'</div><div class="pick-research-meta">'+safe(contactEvidence)+(registry.decision_maker?' · Public registry representative found':' · Buyer not verified')+'</div>'+
    '<div class="pick-checks"><div class="pick-label">'+(qual?'VERIFICATION':'MUST CHECK BEFORE PITCH')+'</div><p>'+safe(qual?'Multi-source reviewed; confirm current scope before outreach.':choice.blockers.slice(0,2).join(' · ')||'Website need is unverified.')+'</p></div>'+
    '<div class="pick-actions"><button type="button" class="pick-dossier" data-pick-id="'+safe(l.id)+'">Open dossier ↗</button><div class="pick-sources">'+sources+'</div></div>'+
  '</article>';
 }).join('');
 document.querySelectorAll('[data-pick-id]').forEach(function(btn){btn.addEventListener('click',function(){openLead(btn.dataset.pickId);});});
 var rules=policy.constraints;
 $('criteria-list').innerHTML=rules.map(function(c){return '<div class="criterion"><strong>'+safe(c[0])+'</strong><p>'+safe(c[1])+'</p></div>';}).join('');
}
function researchDesk(){
 var policy=window.FieldnotesPicks;var ranked=state.leads.slice().filter(function(l){return policy?!policy.banned(l):l.verification!=='rejected';}).sort(function(a,b){return Number(b.score)-Number(a.score);});
 var five=ranked.slice(0,5),gems=ranked.filter(function(l){return l.website_status==='not_listed' && (l.email || l.phone);}).slice(0,5);
 $('next-actions').innerHTML=five.length?five.map(function(l,i){
 var approach=l.email?'Public email listed':l.phone?'Public phone listed':'Contact not confirmed';
 return '<button class="next-row" data-next-id="'+safe(l.id)+'" type="button"><span class="next-index">'+String(i+1).padStart(2,'0')+'</span><span class="next-info"><strong>'+safe(l.name)+'</strong><small>'+safe(l.industry)+' · '+safe(approach)+'</small></span><span class="next-score">'+Number(l.score||0)+'<small>/100</small></span><span class="next-arrow">↗</span></button>';
 }).join(''):'<p class="muted-empty">No candidate shortlist yet. Start the collector in GitHub Actions.</p>';
 $('hidden-gems').innerHTML=gems.length?gems.map(function(l){
 return '<button class="gem-row" data-next-id="'+safe(l.id)+'" type="button"><span class="gem-dot"></span><span><strong>'+safe(l.name)+'</strong><small>'+safe(l.district)+'</small></span><span class="gem-arrow">↗</span></button>';
 }).join(''):'<p class="muted-empty">No contactable, website-unlisted candidates yet.</p>';
 document.querySelectorAll('[data-next-id]').forEach(function(btn){btn.addEventListener('click',function(){openLead(btn.dataset.nextId);});});
}
function filtered(){
 var s=state.search.toLowerCase().trim(),a=state.leads.filter(function(l){
 var hit=!s||[l.name,l.industry,l.address,l.district,l.ico,l.reason].join(' ').toLowerCase().includes(s);
 var inGroup=state.industry==='all'||l.industry===state.industry;
 var inTab=state.tab==='all'||(state.tab==='hot'&&Number(l.score)>=65)||(state.tab==='unlisted'&&l.website_status==='not_listed')||(state.tab==='saved'&&local(l.id).saved);
 return hit&&inGroup&&inTab;
 });
 return a.sort(function(a,b){if(state.sort==='name')return a.name.localeCompare(b.name);if(state.sort==='recent')return String(b.first_seen||'').localeCompare(String(a.first_seen||''));return Number(b.score||0)-Number(a.score||0);});
}
function websiteLabel(l){if(l.website_status==='not_listed')return '<span class="website-pill no">● Not listed</span>';if(l.website_status==='listed')return '<span class="website-pill yes">● Website listed</span>';return '<span class="website-pill unknown">● Unknown</span>';}
function list(){
 var leads=filtered();$('result-count').textContent=fmt(leads.length)+' companies';$('table-summary').textContent='Showing '+fmt(leads.length)+' of '+fmt(state.leads.length)+' candidates';
 $('leads-body').innerHTML=leads.slice(0,500).map(function(l){var p=priority(Number(l.score||0));
 return '<tr role="button" tabindex="0" data-id="'+safe(l.id)+'" aria-label="Open '+safe(l.name)+' dossier"><td><span class="company-name">'+safe(l.name)+'</span><span class="company-meta">'+(l.ico?'IČO '+safe(l.ico)+' · ':'')+safe(l.id)+'</span></td><td><span class="industry-text">'+safe(l.industry)+'</span></td><td>'+safe(l.district||'Prague')+'</td><td>'+websiteLabel(l)+'</td><td><div class="score-group"><span class="score-number">'+Number(l.score||0)+'</span><div class="score-track"><div class="score-progress" style="width:'+Math.max(0,Math.min(100,Number(l.score||0)))+'%"></div></div><span class="priority-pill '+p+'">'+priorityName(Number(l.score||0))+'</span></div></td><td><span class="est-deal">'+Math.round(Number(l.deal_min_czk||15000)/1000)+'–'+Math.round(Number(l.deal_max_czk||35000)/1000)+'K Kč</span></td><td class="row-arrow">↗</td></tr>';
 }).join('');
 var blank=leads.length===0;$('empty-state').hidden=!blank;$('empty-title').textContent=state.leads.length?'No matches for this view':'No leads discovered yet';$('empty-copy').textContent=state.leads.length?'Try another filter or reset your search.':'Run the collector from GitHub Actions to discover Prague businesses. Directory gaps are labelled as unverified—not proof that a website does not exist.';
 document.querySelectorAll('tr[data-id]').forEach(function(row){row.addEventListener('click',function(){openLead(row.dataset.id);});row.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openLead(row.dataset.id);}});});
}
function setTab(tab){state.tab=tab;document.querySelectorAll('[data-tab]').forEach(function(el){el.classList.toggle('active',el.dataset.tab===tab);});list();}
function link(label, href){var href2=url(href);return href2?'<a href="'+safe(href2)+'" rel="noopener noreferrer" target="_blank">'+safe(label)+' ↗</a>':'<span>'+safe(text(href))+'</span>';}
function opening(l){return l.opened_at?'Opened '+formatDate(l.opened_at):l.premises_registered_at?'Premises registered '+formatDate(l.premises_registered_at):l.registered_at?'Registered '+formatDate(l.registered_at):'Date not verified';}
function researchDetails(l){
 var r=l.research;
 if(!r)return '<div class="dossier-section"><h3>Automated independent research</h3><p>Not researched yet. The daily evidence pass processes a limited set of leads and will not claim unverified facts.</p></div>';
 var d=r.discovery||{},audit=r.audit||{},reg=r.registry||{},report=r.dossier||{},proof=d.identity||[];
 var searchLine=d.state==='verified_website'?'Verified website identity match':d.state==='search_unavailable'?'Web search unavailable (NOT proof no site exists)':'No business site independently verified (NOT proof none exists)';
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
 ['BUSINESS DATE',opening(l)],['IČO',l.ico||'Not verified'],['WEBSITE',url(l.website)?link(l.website,l.website):'Not listed in source'],
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
 state.leads.forEach(function(lead){
  var rep=state.researchReports[lead.id];
  if(!rep)return;
  lead.research=rep;
  if(rep.discovery&&rep.discovery.state==='verified_website'&&url(rep.discovery.website)){
   lead.website=rep.discovery.website;lead.website_status='listed';
  }
  if(rep.registry&&rep.registry.state==='inactive')lead.verification='inactive_registry';
  if(rep.registry&&rep.registry.state==='registry_found'&&/^\d{4}-\d{2}-\d{2}$/.test(rep.registry.registered_at||'')&&!lead.registered_at)lead.registered_at=rep.registry.registered_at;
  var signals=(rep.buying_signals||[]).filter(function(x){return x.evidence_type==='verified_registry';});
  if(signals.length)lead.buying_signals=(lead.buying_signals||[]).concat(signals.map(function(x){return x.claim+' ('+x.date+')';}));
 });
 $('data-banner').classList.remove('is-error');$('data-status').textContent=state.leads.length?'Loaded '+fmt(state.leads.length)+' prospects · '+fmt(Object.keys(state.researchReports||{}).length)+' independently researched · buyer intent still unverified':'Collector ready · no leads imported yet · run GitHub Action to populate';
 $('last-updated').textContent='LAST SYNC — '+(state.generatedAt?formatDate(state.generatedAt)+' '+new Date(state.generatedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'NOT YET RUN');
 countStats();industryChart();threePicks();focus();list();researchDesk();
 }catch(e){$('data-banner').classList.add('is-error');$('data-status').textContent='Failed to load leads: '+e.message;$('last-updated').textContent='CHECK WORKFLOW / DATA FILE';if(!state.leads.length){countStats();industryChart();threePicks();focus();list();researchDesk();}}
 finally{state.loading=false;btn.disabled=false;}
}
function exportCsv(){
 var rows=[['Company','Industry','Prague location','IČO','Website status','Website','Email','Phone','Opportunity score','Deal min CZK','Deal max CZK','Research reason','Source','Sales stage','Saved','Private notes']];
 filtered().forEach(function(l){var c=local(l.id);rows.push([l.name,l.industry,l.address||l.district,l.ico,l.website_status,l.website,l.email,l.phone,l.score,l.deal_min_czk,l.deal_max_czk,l.reason,(l.source_urls||[]).join(' '),c.stage||'new',c.saved?'Yes':'No',c.notes||'']);});
 var csv=rows.map(function(r){return r.map(function(v){var s=String(v==null?'':v);if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',');}).join('\r\n');
 var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='prague-leads-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1000);toast('Exported '+(rows.length-1)+' leads');
}
document.querySelectorAll('[data-tab]').forEach(function(btn){btn.addEventListener('click',function(){setTab(btn.dataset.tab);});});
$('search').addEventListener('input',function(e){state.search=e.target.value;list();});
$('industry-filter').addEventListener('change',function(e){state.industry=e.target.value;list();});
$('sort-filter').addEventListener('change',function(e){state.sort=e.target.value;list();});
$('export-btn').addEventListener('click',exportCsv);$('refresh-btn').addEventListener('click',load);
$('drawer-close').addEventListener('click',closeLead);$('drawer-backdrop').addEventListener('click',closeLead);
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeLead();});
load();setInterval(function(){if(!document.hidden)load();},15*60*1000);
})();