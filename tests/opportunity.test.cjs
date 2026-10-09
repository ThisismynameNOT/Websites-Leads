"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const radar=require("../opportunity.js");
const TODAY="2026-10-09";
function base(overrides={}){
 return {id:"lead-1",name:"Prague Roofers",ico:"12345678",address:"Ulice 10, Praha",district:"Praha",
  industry:"Construction & property",registered_at:"2026-08-01",score:59,tier:1,verification:"researching",
  website:"",website_status:"not_listed",research:{checked_at:"2026-10-09",
  registry:{state:"registry_found",ico:"12345678"},
  discovery:{status:"searched",state:"NO_VERIFIED_WEBSITE_FOUND",examined:[{url:"https://www.firmy.cz/roofers"}]},
  audit:{state:"not_run",objective_issues:[]}},...overrides};
}
test("new business only qualifies after a completed independent website search",()=>{
 assert.equal(radar.assess(base(),TODAY).type,"new");
 assert.equal(radar.assess(base({research:{discovery:{status:"search_unavailable",state:"SEARCH_UNAVAILABLE"}}}),TODAY),null);
 assert.equal(radar.assess(base({research:{discovery:{status:"not_checked",state:"NO_VERIFIED_WEBSITE_FOUND"}}}),TODAY),null);
 assert.equal(radar.assess(base({research:{discovery:{status:"searched",state:"VERIFIED_WEBSITE",website:"https://praha-roof.cz"}}}),TODAY),null);
});
test("directory-only URL is never a verified independent company website",()=>{
 for(const u of ["https://www.firmy.cz/detail/1","https://rejstriky.finance.cz/company","https://www.ladypraha.cz/katalog/x",
 "http://www.place123.net/cafe","https://local.infobel.cz/firm","https://rejstrik-firem.kurzy.cz/x","https://www.restauracevpraze.net/a","https://www.reservio.com/booking/123","https://www.treatwell.cz/market"]){
  assert.equal(radar.isIndependent(u),false,u);
 }
 assert.equal(radar.isIndependent("https://www.real-roofers.cz/"),true);
});
test("established companies require a matched independent domain and observed consequential defects",()=>{
 const old=base({registered_at:"2011-05-05",website:"https://www.real-roofers.cz/",
  research:{registry:{state:"registry_found"},
   discovery:{status:"searched",state:"VERIFIED_WEBSITE",website:"https://www.real-roofers.cz/"},
   audit:{state:"observed",objective_issues:[{issue:"Measured mobile horizontal overflow",detail:"70 CSS pixels",url:"https://www.real-roofers.cz/"}]}}});
 assert.equal(radar.assess(old,TODAY).type,"established");
 const weak=JSON.parse(JSON.stringify(old));weak.research.audit.objective_issues=[{issue:"No machine-detected direct contact, form or booking action on homepage",url:weak.website}];
 assert.equal(radar.assess(weak,TODAY),null);
 const bogus=JSON.parse(JSON.stringify(old));bogus.research.discovery.website="https://www.firmy.cz/detail/1";
 assert.equal(radar.assess(bogus,TODAY),null);
});
test("observed HTTP with unsuccessful same-host HTTPS upgrade is a technical lead",()=>{
 const old=base({registered_at:"2012-01-01",website:"http://real-roofers.cz",
  research:{discovery:{state:"VERIFIED_WEBSITE",website:"http://real-roofers.cz"},
    audit:{state:"observed",objective_issues:[],transport:{state:"http_only_confirmed",http_url:"http://real-roofers.cz"}}}});
 assert.equal(radar.assess(old,TODAY).type,"established");
});
test("selection ranks, deduplicates, and never pads ten slots with unknowns",()=>{
 const verified=(id,ico,score)=>base({id,ico,score,research:{...base().research,registry:{state:"registry_found",ico}}});
 const three=[verified("first","11111111",50),verified("other","22222222",70),
 verified("duplicate","22222222",40),base({id:"unresearched",ico:"33333333",research:{}})];
 const entries=radar.select(three,TODAY,10);
 assert.equal(entries.length,2);
 assert.deepEqual(entries.map(x=>x.lead.id),["other","first"]);
});


test("established service firms with a verified site can be suggested for commercial-fit research without fabricated defects",()=>{
 const lead=base({id:"roof",registered_at:"1999-01-01",score:39,tier:1,
  research:{registry:{state:"registry_found",ico:"12345678"},
    discovery:{status:"searched",state:"VERIFIED_WEBSITE",website:"https://roofing-prague.example"},
    audit:{state:"observed",objective_issues:[]}}});
 const x=radar.assess(lead,TODAY);
 assert.equal(x.type,"fit");
 assert.equal(x.category,"research_candidate");
 assert.match(x.reason,/could benefit|confirm|discuss/i);
 assert.equal(x.issues.length,0);
});
test("hand-reviewed legal companies are research candidates, not asserted technical defects",()=>{
 const lead=base({id:"editorial",registered_at:"1996-01-15",manual:true,score:0,tier:1,
   source_urls:["https://elefant-praha.cz/reference","https://www.podnikatel.cz/rejstrik/elefant-praha-64942988"],
   editorial_review:{reviewed_at:"2026-10-09",business_case:"Dated construction references may benefit from easier CMS publishing; confirm the business need."},
   research:{}});
 const candidate=radar.assess(lead,TODAY);
 assert.equal(candidate.type,"fit");
 assert.equal(candidate.category,"research_candidate");
 assert.equal(candidate.score,0);
});
test("raw registry rows without trading evidence or contact cannot fill the shortlist",()=>{
 const row=base({registered_at:"2026-08-01",tier:1,registered_office_only:true,email:"",phone:"",research:{}});
 assert.equal(radar.assess(row,TODAY),null);
});
test("top ten includes some suitable clients even when numerous verified gaps exist",()=>{
 const found=Array.from({length:11},(_,i)=>{const ico=String(11000000+i);return base({id:"gap-"+i,ico,score:80-i,research:{...base().research,registry:{state:"registry_found",ico}}});});
 const fit=Array.from({length:4},(_,i)=>base({id:"fit-"+i,ico:String(22000000+i),registered_at:"1998-01-01",score:25,
  research:{registry:{state:"registry_found",ico:String(22000000+i)},
   discovery:{state:"VERIFIED_WEBSITE",website:"https://roof-"+i+".example"},
   audit:{state:"observed",objective_issues:[]}}}));
 const picks=radar.select(found.concat(fit),TODAY,10);
 assert.equal(picks.length,10);
 assert.equal(picks.filter(x=>x.category==="research_candidate").length,3);
 assert.equal(picks.filter(x=>x.category==="verified_gap").length,7);
});

test("registered-only research holds never get sold as top website opportunities",()=>{
 const lead=base({id:"hold",research_hold:true,registered_at:"2026-10-06",score:85});
 assert.equal(radar.assess(lead,TODAY),null);
 assert.equal(radar.select([lead],TODAY,10).length,0);
});
