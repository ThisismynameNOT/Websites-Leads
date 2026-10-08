/* Verified-first Prague lead selection policy; used in browser and Node tests. */
(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.FieldnotesPicks=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
var CHAIN=/\b(mcdonald.?s|starbucks|kfc|burger king|subway|domino.?s|pizza hut|tesco|lidl|billa|albert|penny market|ikea|dm drogerie|rossmann|costa coffee|dhaba beas|bageterie boulevard)\b/i;
var EXCLUDED=/^(rejected|excluded|closed|inactive_registry|do_not_contact)$/i;
var CONSTRAINTS=[
["01 · Geography","Operating business inside the administrative boundary of Prague. Exclude suburban Central Bohemia, virtual-only or 'serves Prague' listings with no Prague operation."],
["02 · New or exceptional","Prefer opening, premises launch or incorporation in the last 24 months. Older firms need independently documented serious website deficiencies and a defensible redesign case."],
["03 · Real and active","Public evidence that the business exists, is active and has the correct location. No defunct companies, shells or placeholder map entries."],
["04 · Suitable industry","Prioritize construction and renovation, architecture and interiors, beauty/wellness, independent hospitality, professional services and automotive."],
["05 · Independent buyer","Avoid large corporations, national chains, franchises, banks, public agencies and already professionally represented brands."],
["06 · Genuine website gap","Independent website/online-journey investigation. 'No website link in OSM or a directory' is not proof of no site. Check parent brands and existing booking sites."],
["07 · Verified problems only","Do not invent low website scores, performance defects, mobile issues, missing CTAs, SEO penalties or broken pages. Attach real evidence before asserting them."],
["08 · Accessible contact","At least one real public business contact channel. Prefer a verified direct owner/manager or official business email/phone; never guess addresses."],
["09 · Commercial potential","Favor a company with plausible willingness and ability to pay 15k–90k+ CZK for an appropriately scoped website. Price is a proposal estimate, not revenue fact."],
["10 · Buying signals","Look for opening, expansion, hiring, rebranding, active marketing and strong customer demand, but count only sourced signals."],
["11 · Demonstrable demo","Prefer a strong visual before/after or conversion improvement: mobile navigation, services, galleries, appointments, reservations and quotes. Do not reuse copyrighted photos without permission."],
["12 · Ranking and verification","Use 0–100 scores for ordering, not as proof of qualification; HOT 80+, STRONG 65–79, POSSIBLE 50–64. Mark incomplete research clearly."],
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
function isQualified(l,today){
 if(banned(l))return false;
 var q=l.qualification||{},old=recent(l,today),src=(l.source_urls||[]).filter(x=>/^https:\/\//i.test(x));
 var evidence=src.length>=2&&new Set(src).size>=2;
 var exception=!!(q.exception_site_audit_verified&&l.website_score!==null&&Number(l.website_score)<=4);
 var fresh=old===true||(exception&&q.recent_or_exception_verified===true);
 return evidence&&fresh&&l.verification==="qualified"&&q.city_verified===true&&q.active_verified===true&&q.contact_verified===true&&q.website_need_verified===true&&q.commercial_fit_verified===true&&q.independent_owner_check===true&&q.not_franchise_verified===true&&!!validDate(q.last_checked)&&((new Date(today+"T00:00:00Z")-validDate(q.last_checked))/86400000<=90)&&((new Date(today+"T00:00:00Z")-validDate(q.last_checked))/86400000>=0);
}
function blockers(l,today){
 var out=[],date=recent(l,today),q=l.qualification||{};
 if(date===null)out.push("Opening or registration date needs independent confirmation");
 else if(date===false&&!q.exception_site_audit_verified)out.push("Outside 24-month window; documented exceptional site need required");
 if(!q.website_need_verified)out.push("Independent site/booking search and evidence still required");
 if(!q.active_verified)out.push("Confirm current trading activity and exact Prague operation");
 if(!q.contact_verified)out.push("Confirm public contact reaches the business");
 if(!q.commercial_fit_verified)out.push("Confirm need and commercial fit with the buyer");
 if(!q.independent_owner_check)out.push("Confirm buyer or responsible decision-maker");
 if(Array.isArray(l.verification_gaps))out=out.concat(l.verification_gaps);
 return [...new Set(out)].slice(0,8);
}
function signature(l){
 if(l.ico&&/^\d{8}$/.test(String(l.ico)))return "ico:"+l.ico;
 var cleaned=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
 return cleaned(l.name)+"|"+cleaned(l.address);
}
function rank(l,today){
 var manual=l.manual===true||l.data_origin==="Manual web research";
 var reviewed=!!(l.research_reviewed_at&&(l.source_urls||[]).length>=2);
 var within=recent(l,today);
 var score=Number(l.score)||0;
 return score+ (manual&&reviewed?35:0)+(within===true?15:0)+(l.email?7:0)+(l.phone?5:0)+(l.website_status==="not_listed"?5:0)+(l.demo_potential==="High"?4:0);
}
function choose(leads,today){
 today=today||new Date().toISOString().slice(0,10);
 var seen=new Set(), candidates=[];
 (leads||[]).filter(l=>!banned(l)).sort((a,b)=>rank(b,today)-rank(a,today)).forEach(l=>{var k=signature(l);if(!seen.has(k)){seen.add(k);candidates.push(l);}});
 var reviewed=candidates.filter(l=>isQualified(l,today)),other=candidates.filter(l=>!isQualified(l,today));
 return reviewed.concat(other).slice(0,3).map((l,index)=>({
   rank:index+1,lead:l,
   status:isQualified(l,today)?"qualified":"research",
   qualification:isQualified(l,today)?"Approved for a personalized outreach review":"Research required before pitching",
   blockers:isQualified(l,today)?[]:blockers(l,today)
 }));
}
return {choose:choose,banned:banned,isQualified:isQualified,blockers:blockers,recent:recent,constraints:CONSTRAINTS,signature:signature};
});
