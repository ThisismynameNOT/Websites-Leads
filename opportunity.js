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
function assess(l,today){
 if(!l||!l.id||!l.name||l.do_not_contact||l.is_franchise||/^(rejected|closed|inactive_registry|excluded|do_not_contact)$/i.test(l.verification||""))return null;
 if(!/praha|prague/i.test(String(l.address||"")+" "+String(l.district||"")))return null;
 // Use the shared policy to reject large chains and other unsuited companies.
 if(typeof window!=="undefined"&&window.FieldnotesPicks&&window.FieldnotesPicks.banned(l))return null;
 var reg=(l.research||{}).registry||{};
 if(reg.state==="inactive"||reg.state==="mismatch")return null;
 var age=recent(l,today);if(age===null)return null;
 var d=(l.research||{}).discovery||{},a=(l.research||{}).audit||{},s=siteState(l);
 var score=Math.max(0,Math.min(100,Number(l.score)||0));
 var type="",label="",reason="",evidence="",issues=[];
 if(age===true){
   // Only independently completed search outcomes qualify. Unknown, unsearched and directory-tag gaps do not.
   if(d.status!=="searched"||!(s==="NO_VERIFIED_WEBSITE_FOUND"||s==="THIRD_PARTY_PRESENCE_ONLY"))return null;
   if(independentSite(l))return null;
   type="new";label="New · no independent site verified";
   reason="No independent company website confirmed in the documented search. Recheck before presenting this as a no-website lead.";
   evidence=(d.examined||[]).filter(function(x){return x&&x.url;}).map(function(x){return x.url;})[0]||((l.source_urls||[])[0]||"");
 }else{
   var site=independentSite(l);if(!site||a.state!=="observed")return null;
   issues=(a.objective_issues||[]).filter(function(x){return severity(x)>0&&isIndependent(x.url||site);});
   var impact=issues.reduce(function(sum,x){return sum+severity(x);},0);
   var transport=a.transport||{},insecure=transport.state==="http_only_confirmed"&&websiteHost(transport.http_url||site)===websiteHost(site);
   if(!insecure&&impact<3)return null;
   type="established";label=insecure?"Established · HTTP / HTTPS failed check":"Established · verified site issues";
   reason=insecure?"HTTP site loads and a same-host HTTPS attempt did not succeed during the recorded test; recheck before outreach.":issues.slice(0,2).map(function(x){return x.issue;}).join(" · ");
   if(insecure)issues.unshift({issue:"HTTPS upgrade unsuccessful in observed test",url:transport.http_url||site});
   evidence=site;
 }
 return {lead:l,type:type,label:label,reason:reason,evidence:evidence,
  issues:issues,score:score,verifiedSite:independentSite(l),
  checked_at:(l.research||{}).checked_at||"",
  ranking:score+(type==="established"?Math.min(12,issues.reduce(function(sum,x){return sum+severity(x);},0)):5)
      +(l.tier===1?8:l.tier===2?4:0)+(reg.state==="registry_found"?4:0)};
}
function select(leads,today,limit){var seen=new Set();
 return (leads||[]).map(function(l){return assess(l,today);}).filter(Boolean)
   .sort(function(a,b){return b.ranking-a.ranking||b.score-a.score||String(a.lead.name).localeCompare(String(b.lead.name));})
   .filter(function(x){var l=x.lead;var key=l.ico&&/^\d{8}$/.test(String(l.ico))?"ico:"+l.ico:"name:"+l.name.toLowerCase()+"|"+(l.address||"").toLowerCase();
    if(seen.has(key))return false;seen.add(key);return true;}).slice(0,Math.max(0,Math.min(10,limit||10)));
}
return {select:select,assess:assess,isIndependent:isIndependent,siteState:siteState,severity:severity};
});
