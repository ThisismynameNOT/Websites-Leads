/* Verified-first Prague lead selection policy; used in browser and Node tests. */
(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.FieldnotesPicks=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
var CHAIN=/\b(mcdonald.?s|starbucks|kfc|burger king|subway|domino.?s|pizza hut|tesco|lidl|billa|albert|penny market|ikea|dm drogerie|rossmann|costa coffee|dhaba beas|bageterie boulevard|mama coffee|mamacoffee|vytopna|výtopna|rangoli)\b/i;
var EXCLUDED=/^(rejected|excluded|closed|inactive_registry|do_not_contact)$/i;
var CONSTRAINTS=[
["01 · Geography","Operating business inside the administrative boundary of Prague. Exclude suburban Central Bohemia, virtual-only or 'serves Prague' listings with no Prague operation."],
["02 · New OR established","New within 7/30/90/365/730 days OR active established company with a verified redesign opportunity. Age alone must not disqualify."],
["03 · Real and active","Public evidence that the business exists, is active and has the correct location. No defunct companies, shells or placeholder map entries."],
["04 · Suitable industry","Prioritize construction and renovation, architecture and interiors, beauty/wellness, independent hospitality, professional services and automotive."],
["05 · Independent buyer","Avoid large corporations, national chains, franchises, banks, public agencies and already professionally represented brands."],
["06 · Genuine website gap","Independent website/online-journey investigation. 'No website link in OSM or a directory' is not proof of no site. Check parent brands and existing booking sites."],
["07 · Verified problems only","Do not invent low website scores, performance defects, mobile issues, missing CTAs, SEO penalties or broken pages. Attach real evidence before asserting them."],
["08 · Accessible contact","At least one real public business contact channel. Prefer a verified direct owner/manager or official business email/phone; never guess addresses."],
["09 · Financial evidence","Financial capacity is a distinct 25-point criterion. Prefer sourced annual accounts, employee categories, business activity and contracts; unknown finances remain unknown."],
["10 · Buying signals","Look for opening, expansion, hiring, rebranding, active marketing and strong customer demand, but count only sourced signals."],
["11 · Demonstrable demo","Prefer a strong visual before/after or conversion improvement: mobile navigation, services, galleries, appointments, reservations and quotes. Do not reuse copyrighted photos without permission."],
["12 · Unified commercial ranking","Exactly 25 website need + 25 financial capacity + 20 activity + 15 lead-generation value + 10 contact + 5 CMS. 80+ high, 60–79 further research, below 60 low."],
["13 · Deduplicate and verify","Cross-reference business name, IČO, location and websites across sources, avoiding duplicate branches and false links to unrelated firms."],
["14 · Evidence and recency","Use multiple attributable links for reviewed findings. Dates must be labelled as registration, premises or actual opening; unknown is unknown."],
["15 · Three actionable slots","Show exactly three highest-quality nonexcluded prospects when available. If none passes complete verification, show three clearly marked research candidates—not invented approved opportunities."],
["16 · Privacy and outreach","Public business contacts only. No guessed data, deceptive demos or mass unsolicited messaging. Follow Czech/EU marketing and data-protection requirements."]
];
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||"")))return null;var d=new Date(s+"T00:00:00Z");return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s?d:null;}
function recent(l,today){
 var todayDate=validDate(today),start=validDate(l.opened_at)||validDate(l.premises_registered_at)||validDate(l.registered_at);
 if(!todayDate||!start)return null;
 var days=(todayDate.getTime()-start.getTime())/86400000;
 return days>=0&&days<=730;
}
function contactable(l){return !!((l.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email))||(l.phone&&String(l.phone).replace(/\D/g,"").length>=9&&String(l.phone).replace(/\D/g,"").length<=15)||(l.instagram&&/^https:\/\/(www\.)?instagram\.com\//.test(l.instagram)));}
function banned(l){
 if(!l||!l.id||!l.name||!l.address)return true;
 if(EXCLUDED.test(l.verification||"")||l.do_not_contact===true||l.is_franchise===true||l.is_closed===true)return true;
 if(CHAIN.test(l.name))return true;
 if(!/praha|prague/i.test(l.address+" "+l.district))return true;
 if(!contactable(l))return true;
 // Known older firms cannot be selected just because a directory omitted their web URL.
 // Only a reviewed, evidenced <=4/10 redesign exception may override >24 months.
 return false;
}
function isQualified(l){
 return !banned(l)&&l.qualification_status==="qualified_for_personalized_outreach_review";
}
function blockers(l){
 var fromEngine=l.outstanding_checks;
 if(Array.isArray(fromEngine)&&fromEngine.length)return fromEngine.slice(0,12);
 var x=[];
 if(!l.ico)x.push("Official IČO / ARES identity verification missing");
 if(!l.research)x.push("Independent website and business research has not completed");
 if(!l.email&&!l.phone&&!l.instagram)x.push("No public business contact verified");
 x.push("Financial capacity, website need or buyer authority still require evidence");
 return x;
}
function signature(l){
 if(l.ico&&/^\d{8}$/.test(String(l.ico)))return "ico:"+l.ico;
 var cleaned=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
 return cleaned(l.name)+"|"+cleaned(l.address);
}
function rank(l){return Number.isFinite(Number(l.score))?Number(l.score):0;}
function choose(leads,today){
 var seen=new Set(),candidates=[];
 (leads||[]).filter(l=>!banned(l)).sort(function(a,b){
  var diff=rank(b)-rank(a);
  if(diff)return diff;
  var tierA=Number(a.tier)||3,tierB=Number(b.tier)||3;
  return tierA-tierB||String(a.name).localeCompare(String(b.name));
 }).forEach(function(l){
  var key=signature(l);
  if(!seen.has(key)){seen.add(key);candidates.push(l);}
 });
 var approved=candidates.filter(isQualified),needsResearch=candidates.filter(l=>!isQualified(l));
 return approved.concat(needsResearch).slice(0,3).map(function(l,i){
  var qualified=isQualified(l);
  return {rank:i+1,lead:l,status:qualified?"qualified":"research",
   qualification:qualified?"Approved for personalized outreach review":"Research required before pitching",
   blockers:qualified?[]:blockers(l)};
 });
}
return {choose:choose,banned:banned,isQualified:isQualified,blockers:blockers,recent:recent,constraints:CONSTRAINTS,signature:signature};
});
