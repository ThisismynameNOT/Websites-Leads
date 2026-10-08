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
 var picks=state.topTen||[],newCount=picks.filter(function(x){return x.type==="new";}).length;
 var oldCount=picks.filter(function(x){return x.type==="established";}).length;
 $('stat-total').textContent=picks.length+' / 10';
 $('stat-hot').textContent=String(newCount);
 $('stat-unlisted').textContent=String(oldCount);
 $('stat-value').textContent=String(Math.max(0,10-picks.length)).padStart(2,'0');
 $('nav-count').textContent=String(picks.length);
}
function industryChart(){
 var c={};(state.topTen||[]).forEach(function(x){var k=x.lead.industry||"Other";c[k]=(c[k]||0)+1;});
 var groups=Object.entries(c).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
 $('industry-chart').innerHTML=groups.length?groups.map(function(e){return '<div class="bar-row"><span class="bar-label" title="'+safe(e[0])+'">'+safe(e[0])+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(e[1]/Math.max.apply(null,groups.map(function(x){return x[1];}))*100)+'%"></div></div><span class="bar-number">'+e[1]+'</span></div>';}).join(''):'<div class="muted-empty">Verified opportunity categories will appear as research completes. Raw registry listings are not sales leads.</div>';
}
function focus(){
 var x=(state.topTen||[])[0],l=x&&x.lead;
 if(!l){$('focus-content').innerHTML='<div class="focus-placeholder">No evidence-qualified lead yet. Check the research workflow; directory omissions cannot prove that a company lacks a website.</div>';return;}
 $('focus-content').innerHTML='<div class="focus-signal">'+safe(x.label)+'</div><h4 class="focus-company">'+safe(l.name)+'</h4><p class="focus-summary">'+safe(x.reason)+'</p><div class="focus-footer"><span class="focus-score">'+Number(l.score||0)+'/100 · research candidate</span><button type="button" id="focus-open" class="focus-button">View evidence ↗</button></div>';
 $('focus-open').addEventListener('click',function(){openLead(l.id);});
}
function todayPrague(){try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(e){return new Date().toISOString().slice(0,10);}}
function threePicks(){
 var top=(state.topTen||[]).slice(0,3);state.threePicks=top;
 $('top-three').innerHTML=[0,1,2].map(function(i){
  var x=top[i];if(!x)return '<article class="pick-card pick-empty"><div class="pick-rank">0'+(i+1)+' / OPEN SLOT</div><h3>Evidence pending</h3><p>No other business has yet passed the website-opportunity checks. We do not promote unverified directory listings.</p></article>';
  var l=x.lead,source=x.evidence&&url(x.evidence)?'<a href="'+safe(url(x.evidence))+'" target="_blank" rel="noopener noreferrer">View evidence ↗</a>':'';
  return '<article class="pick-card radar-pick"><div class="pick-card-top"><span class="pick-rank">0'+(i+1)+' / SIGNAL</span><span class="pick-state pending">◌ REVIEW FIRST</span></div>'+
   '<h3 class="pick-company-name">'+safe(l.name)+'</h3><div class="pick-detail"><div class="pick-label">'+safe(x.label)+'</div><p>'+safe(x.reason)+'</p></div>'+
   '<div class="pick-contact">'+safe(l.industry||'')+' · '+safe(l.registered_at||'Registration date unverified')+'</div>'+
   '<div class="pick-actions"><button class="pick-dossier" data-radar-pick="'+safe(l.id)+'" type="button">Open dossier ↗</button><div class="pick-sources">'+source+'</div></div></article>';
 }).join('');
 document.querySelectorAll('[data-radar-pick]').forEach(function(btn){btn.addEventListener('click',function(){openLead(btn.dataset.radarPick);});});
 var node=$('criteria-list');if(node&&window.FieldnotesPicks)node.innerHTML=window.FieldnotesPicks.constraints.map(function(c){return '<div class="criterion"><strong>'+safe(c[0])+'</strong><p>'+safe(c[1])+'</p></div>';}).join('');
}
function researchDesk(){}
function filtered(){return (state.topTen||[]).map(function(x){return x.lead;});}
function websiteLabel(l){
 var radar=(state.topTen||[]).find(function(x){return x.lead.id===l.id;});
 if(!radar)return '<span class="website-pill unknown">Not reviewed</span>';
 return radar.type==="new"?'<span class="website-pill no">● No verified site</span>':
 '<span class="website-pill yes">● Website audited</span>';
}
function list(){
 var entries=state.topTen||[];
 $('result-count').textContent=entries.length+' / 10 qualified for review';
 $('table-summary').textContent=entries.length+' evidence-backed entries · '+(10-entries.length)+' remaining slots need research';
 $('leads-body').innerHTML=[0,1,2,3,4,5,6,7,8,9].map(function(i){
  var x=entries[i];if(!x)return '<tr class="radar-pending-row"><td><span class="rank-number">'+String(i+1).padStart(2,'0')+'</span><span class="company-name">Research pending</span></td><td colspan="4"><span class="pending-copy">Awaiting a verified company website search or measured technical audit. No unconfirmed opportunity added.</span></td><td>—</td></tr>';
  var l=x.lead,score=Number(l.score||0),site=x.verifiedSite&&url(x.verifiedSite)?'<a class="radar-site" href="'+safe(url(x.verifiedSite))+'" target="_blank" rel="noopener noreferrer">View company site ↗</a>':'<span class="website-pill no">No independent site verified</span>';
  return '<tr role="button" tabindex="0" class="radar-live-row" data-id="'+safe(l.id)+'" aria-label="Open '+safe(l.name)+' dossier">'+
    '<td><span class="rank-number">'+String(i+1).padStart(2,'0')+'</span><span class="company-name">'+safe(l.name)+'</span><span class="company-meta">'+safe(l.industry||'')+' · '+safe(l.ico?'IČO '+l.ico:'Identity review pending')+'</span></td>'+
    '<td><span class="radar-type '+safe(x.type)+'">'+safe(x.label)+'</span></td><td><span class="radar-why">'+safe(x.reason)+'</span><span class="radar-meta">Checked: '+safe(x.checked_at||'date not verified')+'</span></td>'+
    '<td>'+site+'</td><td><div class="score-group"><span class="score-number">'+score+'</span><div class="score-track"><div class="score-progress" style="width:'+Math.max(0,Math.min(100,score))+'%"></div></div><span class="radar-meta">/100 · budget unverified</span></div></td><td class="row-arrow">↗</td></tr>';
 }).join('');
 $('empty-state').hidden=true;
 document.querySelectorAll('tr[data-id]').forEach(function(row){row.addEventListener('click',function(e){if(e.target.closest('a'))return;openLead(row.dataset.id);});row.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openLead(row.dataset.id);}});});
}
function setTab(tab){state.tab=tab;
$('export-btn').addEventListener('click',exportCsv);$('refresh-btn').addEventListener('click',load);
$('drawer-close').addEventListener('click',closeLead);$('drawer-backdrop').addEventListener('click',closeLead);
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeLead();});
load();setInterval(function(){if(!document.hidden)load();},15*60*1000);
})();