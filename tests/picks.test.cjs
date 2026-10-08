"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const policy=require("../picks.js");
const today="2026-10-08";
function lead(overrides={}){
 return {
  id:"manual-001",name:"New Salon Prague",industry:"Beauty & wellness",
  address:"Vinohradská 10, Praha 2",district:"Praha 2",
  ico:"12345678",website:"",website_status:"not_listed",website_score:null,
  registered_at:"2025-10-08",opened_at:null,email:"hello@salon.example",
  phone:"+420 123 456 789",instagram:"https://www.instagram.com/new_salon/",
  score:75,verification:"researching",manual:true,
  research_reviewed_at:"2026-10-08",demo_potential:"High",
  source_urls:["https://www.firmy.cz/a","https://www.podnikatel.cz/b"],
  ...overrides
 };
}
test("exactly three high quality candidates selected without duplicates or franchises",()=>{
 const curated=[lead({id:"1",ico:"11111111",name:"Salon One"}),
  lead({id:"2",ico:"22222222",name:"Salon Two",score:69}),
  lead({id:"3",ico:"33333333",name:"Cafe Three",score:57}),
  lead({id:"4",ico:"44444444",name:"McDonald's",score:100}),
  lead({id:"5",ico:"11111111",name:"Salon One duplicate",score:20}),
  lead({id:"6",ico:"66666666",name:"Failed Check",verification:"rejected",score:100})];
 const picks=policy.choose(curated,today);
 assert.equal(picks.length,3);
 assert.deepEqual(new Set(picks.map(x=>x.lead.ico)).size,3);
 assert.ok(picks.every(x=>x.status==="research"));
 assert.ok(picks.every(x=>!x.lead.name.includes("McDonald's")));
});
test("verification is never inferred solely from the score or missing directory URL",()=>{
 const l=lead({score:100,website_status:"not_listed",verification:"registry_checked"});
 assert.equal(policy.isQualified(l,today),false);
 assert.ok(policy.blockers(l,today).some(x=>/website|financial/i.test(x)));
});
test("manual fully evidenced verification can be qualified for outreach",()=>{
 const l=lead({qualification_status:"qualified_for_personalized_outreach_review",score:88});
 assert.equal(policy.isQualified(l,today),true);
 assert.equal(policy.choose([l],today)[0].status,"qualified");
});
test("established companies can qualify after commercial review regardless of age",()=>{
 const l=lead({registered_at:"1993-01-07",score:91,
  qualification_status:"qualified_for_personalized_outreach_review"});
 assert.equal(policy.isQualified(l,today),true);
 assert.equal(policy.choose([l],today)[0].status,"qualified");
});
test("verified new Prague premises qualify for age even when incorporation is older",()=>{
 const l=lead({registered_at:"2024-08-12",opened_at:"2026-03-02"});
 assert.equal(policy.recent(l,today),true);
});
test("stale reviews, invalid contact, outside Prague and no sources are excluded",()=>{
 assert.equal(policy.banned(lead({address:"Kladno, Středočeský kraj",district:"Kladno"})),true);
 assert.equal(policy.banned(lead({email:"",phone:"",instagram:""})),true);
 assert.equal(policy.banned(lead({verification:"closed"})),true);
 assert.equal(policy.isQualified(lead({source_urls:[],verification:"qualified"}),today),false);
});
test("all 16 constraints are documented and three empty slots may remain unfilled",()=>{
 assert.equal(policy.constraints.length,16);
 assert.equal(policy.choose([],today).length,0);
});
test("known parent-company franchises are excluded",()=>{
 for(const name of ["Starbucks Coffee","KFC","McDonald's","Lidl","Dhaba Beas"]){
  assert.equal(policy.banned(lead({name})),true,name);
 }
});

test("three manually researched Prague businesses rank as the starting daily picks",()=>{
 const curated=require("../data/manual-leads.json").leads;
 const choices=policy.choose(curated,today);
 assert.deepEqual(choices.map(x=>x.lead.name),["An Beauty Studio","Marina Hreben","Café Marathon"]);
 assert.ok(choices.every(x=>x.status==="research"),"No unverified business may be promoted as qualified");
 assert.ok(choices.every(x=>(x.lead.source_urls||[]).length>=2),"Each research pick must cite at least two sources");
});
test("registered premises date is distinct from opening date",()=>{
 const lead=require("../data/manual-leads.json").leads.find(x=>x.name==="Marina Hreben");
 assert.equal(lead.opened_at,null);
 assert.equal(lead.premises_registered_at,"2026-03-02");
 assert.equal(policy.recent(lead,today),true);
});

test("established companies are eligible for score-based redesign ranking",()=>{
 const old=lead({id:"old",ico:"44556677",name:"Established Roofing",registered_at:"2008-01-01",score:91});
 const newborn=lead({id:"new",ico:"88990011",name:"New Studio",registered_at:"2026-07-01",score:55});
 const picks=policy.choose([newborn,old],today);
 assert.deepEqual(picks.map(x=>x.lead.id),["old","new"]);
});
test("same commercial score ranks the top three and the directory",()=>{
 const leads=[lead({id:"one",ico:"10000001",score:62}),lead({id:"two",ico:"10000002",score:81}),lead({id:"three",ico:"10000003",score:74})];
 const sorted=leads.slice().sort((a,b)=>b.score-a.score).map(x=>x.id);
 assert.deepEqual(policy.choose(leads,today).map(x=>x.lead.id),sorted);
});
