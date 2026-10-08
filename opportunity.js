/* Evidence-gated top-ten sales radar. No directory omissions masquerade as missing websites. */
(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.FieldnotesRadar=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
var THIRD_PARTY=/(^|\.)(firmy\.cz|en\.firmy\.cz|zivefirmy\.cz|finmag\.cz|penize\.cz|podnikatel\.cz|kurzy\.cz|finance\.cz|infobel\.cz|place123\.net|ladypraha\.cz|restauracevpraze\.net|ifirmy\.cz|facebook\.com|instagram\.com|linkedin\.com|mapy\.com|google\.com|yelp\.com|tripadvisor\.com|firmy\.eu|dostartu\.cz|rejstriky\.finance\.cz|booking\.com|slevomat\.cz|wolt\.com|foodora\.cz|restu\.cz|restaurantguru\.com|restaurace\.cz|treatwell\.cz|reservio\.com|bookio\.com|google\.cz|tripadvisor\.cz|seznam\.cz|zomato\.com|opencorporates\.com|idatabaze\.cz)$/i;
function websiteHost(u){try{var parsed=new URL(u);return /^https?:$/.test(parsed.protocol)?parsed.hostname.toLowerCase().replace(/^www\./,""):"";}catch(e){return "";}}
function isIndependent(u){var h=websiteHost(u);return !!h&&!THIRD_PARTY.test(h);}
function siteState(l){var r=l.research||{},d=r.discovery||{},s=d.state||l.website_classification||"SEARCH_UNAVAILABLE";
  if(s==="verified_website")s="VERIFIED_WEBSITE";
  if(s==="not_found_in_checked_sources")s="NO_VERIFIED_WEBSITE_FOUND";
  return s;
}
function independentSite(l){var d=(l.research||{}).discovery||{};var s=d.website||l.website||"";
  return siteState(l)==="VERIFIED_WEBSITE"&&isIndependent(s)?s:"";
}
function recent(l,today){var d=l.registered_at||((l.research||{}).registry||{}).registered_at;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d||""))return null;
 var delta=(Date.parse(today+"T00:00:00Z")-Date.parse(d+"T00:00:00Z"))/86400000;
 return Number.isFinite(delta)&&delta>=0?delta<=730:null;
}
function severity(issue){var s=String((issue||{}).issue||"").toLowerCase();
 if(/broken internal page/.test(s))return 5;
 if(/horizontal overflow/.test(s))return 3;
 if(/missing viewport/.test(s))return 3;
 if(/broken image/.test(s))return 2;
 if(/no machine-detected direct contact/.test(s))return 1;
 return 0;
}

function sectorTier(l){
  var explicit=Number(l.tier);
  if(explicit===1||explicit===2||explicit===3)return explicit;
  var str=String(l.industry||"").toLowerCase();
  if(/construction|property|specialized b2b|staveb|roof|plumb|electri|hvac|renovat|architecture|architect|izolace/.test(str))return 1;
  if(/professional|automotive|industrial|manufactur|creative|interior|landscap|maintenance/.test(str))return 2;
  return 3;
}
function contact(l){return !!(String(l.email||"").includes("@")||String(l.phone||"").replace(/\D/g,"").length>=9);}
function reviewedBusiness(l){
  var e=l.editorial_review||{},sources=(l.source_urls||[]).filter(function(u){return websiteHost(u);});
  return l.manual===true && /^\d{4}-\d{2}-\d{2}$/.test(e.reviewed_at||"") &&
    typeof e.business_case==="string" && e.business_case.length>=35 &&
    sources.length>=2 && /^\d{8}$/.test(String(l.ico||""));
}
function portfolioCase(l){
  if((l.editorial_review||{}).business_case)return l.editorial_review.business_case;
  var t=sectorTier(l);
  if(t===1)return "High-value local services could benefit from a clear project portfolio, trust-building references and a simple request-a-quote journey. Confirm the business need before proposing a redesign.";
  if(t===2)return "A clearer service catalogue, customer case studies or enquiry workflow could be valuable. Check the existing site and commercial goals before pitching.";
  return "Potential local-service website and enquiry improvement. Check operating activity, customer demand and the existing booking journey before outreach.";
}
function assess(l,today){
 if(!l||!l.id||!l.name||l.do_not_contact||l.is_franchise||/^(rejected|closed|inactive_registry|excluded|do_not_contact)$/i.test(l.verification||""))return null;
 if(!/praha|prague/i.test(String(l.address||"")+" "+String(l.district||"")))return null;
 if(typeof window!=="undefined"&&window.FieldnotesPicks&&window.FieldnotesPicks.banned(l))return null;
 var reg=(l.research||{}).registry||{};
 if(reg.state==="inactive"||reg.state==="mismatch")return null;
 var age=recent(l,today),d=(l.research||{}).discovery||{},a=(l.research||{}).audit||{},s=siteState(l);
 var verifiedReg=reg.state==="registry_found" && reg.ico===String(l.ico||"");
 var editorial=reviewedBusiness(l),site=independentSite(l),t=sectorTier(l);
 var score=Math.max(0,Math.min(100,Number(l.score)||0));
 var type="",label="",reason="",evidence="",issues=[],category="",fit=0;
 var sources=(l.source_urls||[]).filter(function(u){return !!websiteHost(u);});
 if(age===true && verifiedReg && d.status==="searched" &&
   (s==="NO_VERIFIED_WEBSITE_FOUND"||s==="THIRD_PARTY_PRESENCE_ONLY") && !site){
   type="new";category="verified_gap";label="New · no company site confirmed";
   reason="Completed independent web research has not confirmed a first-party website. This is an opportunity to investigate, not proof that no website exists.";
   evidence=(d.examined||[]).find(function(x){return !!websiteHost(x.url);});
   evidence=(evidence&&evidence.url)||sources[0]||reg.source||"";
 }else if(age===false && site && a.state==="observed"){
   issues=(a.objective_issues||[]).filter(function(x){return severity(x)>0&&isIndependent(x.url||site);});
   var impact=issues.reduce(function(n,x){return n+severity(x);},0);
   var transport=a.transport||{},insecure=transport.state==="http_only_confirmed" &&
       websiteHost(transport.http_url||site)===websiteHost(site);
   if(insecure || impact>=3){
     type="established";category="verified_gap";
     label=insecure?"Established · HTTP/HTTPS issue":"Established · observed site defects";
     reason=insecure?"HTTP site loaded and a same-host HTTPS upgrade failed during the recorded check; reconfirm before outreach.":issues.slice(0,2).map(function(x){return x.issue;}).join(" · ");
     if(insecure)issues.unshift({issue:"HTTPS upgrade unsuccessful during observed test",url:transport.http_url||site});
     evidence=site;
   }
 }
 // Commercial fit is a prospecting hypothesis, never a verified missing/broken site.
 if(!type && t<=2 && (verifiedReg||editorial) && (contact(l)||site||editorial) &&
    (!l.registered_office_only||site||editorial) &&
    (!age||age===true||age===false)){
   type="fit";category="research_candidate";
   label="Good website client · needs review";
   reason=portfolioCase(l);
   evidence=site||sources[0]||reg.source||"";
 }
 if(!type)return null;
 // Prefer real high-value service operators and evidence; never equate unknown budget with financial capacity.
 fit=(t===1?25:t===2?12:0)+(verifiedReg?9:0)+(editorial?12:0)+
    (contact(l)?10:0)+(site?8:0)+(sources.length>=2?5:0)+
    Math.min(30,score*.3);
 return {lead:l,type:type,category:category,label:label,reason:reason,evidence:evidence,
  issues:issues,score:score,verifiedSite:site,checked_at:(l.research||{}).checked_at||
  ((l.editorial_review||{}).reviewed_at||""),ranking:fit+(category==="verified_gap"?100:0),
  next_action:category==="research_candidate"?"Verify existing website, operations, contact and buyer fit before proposing a project.":"Confirm observed website condition and business need with the company before outreach."};
}
function select(leads,today,limit){
 var seen=new Set(),n=Math.max(0,Math.min(10,limit==null?10:limit));
 var ranked=(leads||[]).map(function(l){return assess(l,today);}).filter(Boolean)
   .sort(function(a,b){return b.ranking-a.ranking||b.score-a.score||String(a.lead.name).localeCompare(String(b.lead.name));})
   .filter(function(x){var l=x.lead,key=l.ico&&/^\d{8}$/.test(String(l.ico))?"ico:"+l.ico:"name:"+l.name.toLowerCase()+"|"+(l.address||"").toLowerCase();
     if(seen.has(key))return false;seen.add(key);return true;});
 var gaps=ranked.filter(function(x){return x.category==="verified_gap";});
 var fits=ranked.filter(function(x){return x.category==="research_candidate";});
 // Reserve up to three slots for plausible website clients, alongside known deficiencies.
 var selected=gaps.slice(0,Math.max(0,n-3)).concat(fits.slice(0,Math.min(n,3)));
 var chosen=new Set(selected.map(function(x){return x.lead.id;}));
 for(var x of ranked){if(selected.length>=n)break;if(!chosen.has(x.lead.id)){selected.push(x);chosen.add(x.lead.id);}}
 return selected.slice(0,n).sort(function(a,b){return b.ranking-a.ranking;});
}

return {select:select,assess:assess,isIndependent:isIndependent,siteState:siteState,severity:severity,sectorTier:sectorTier,reviewedBusiness:reviewedBusiness};
});
