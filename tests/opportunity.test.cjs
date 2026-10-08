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
 "http://www.place123.net/cafe","https://local.infobel.cz/firm","https://rejstrik-firem.kurzy.cz/x","https://www.restauracevpraze.net/a"]){
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
 const three=[base({id:"first",ico:"11111111",score:50}),base({id:"other",ico:"22222222",score:70}),
 base({id:"duplicate",ico:"22222222",score:40}),base({id:"unresearched",ico:"33333333",research:{}})];
 const entries=radar.select(three,TODAY,10);
 assert.equal(entries.length,2);
 assert.deepEqual(entries.map(x=>x.lead.id),["other","first"]);
});
