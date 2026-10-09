const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'), d=JSON.parse(fs.readFileSync(path.join(root,'data','october-review.json'),'utf8'));
const records=d.records;
test('All twenty-four October source rows unique and auditable',()=>{
 assert.equal(records.length,24); assert.equal(new Set(records.map(r=>r.name)).size,24);
 assert.equal(records.filter(r=>r.review_priority==='Priority research').length,0);
 assert.equal(records.filter(r=>r.review_priority==='Deferred / QA').length,24);
 records.forEach(r=>{assert.match(r.registration_date,/^2026-10-0[3-6]$/);
 assert.ok(r.source_urls.length>=1); assert.match(r.outreach_status,/(NOT APPROVED|EXCLUDED)/); assert.ok(r.decision_reason.length>30);
 assert.equal(r.eligible_for_outreach,false);
 assert.equal(r.verified_standalone_brand,false);
 assert.ok(r.brand_check&&r.brand_check.status==='not_verified');
 assert.ok(r.project_vehicle_check); assert.ok(r.group_check&&r.group_check.status); assert.equal(r.direct_customer_check.status,'not_verified');
 assert.equal(r.no_site_confidence,null); assert.equal(r.score,null); assert.equal(r.package_czk,null);});
});
test('No unverified website gets a fabricated package, score or revenue',()=>{
 assert.equal(d.summary.new_qualified,0); assert.equal(d.summary.premium_qualified,0);
 assert.equal(d.summary.qualified_pipeline_czk,0);
 assert.ok(d.rules.hard_no_site_gate); assert.equal(d.rules.premium_min_scale_czk,50000000);
 assert.deepEqual(d.rules.new_prices,[40000,50000]);
 assert.deepEqual(d.rules.premium_prices,[70000,80000,100000]);
 const js=fs.readFileSync(path.join(root,'sales.js'),'utf8');
 assert.match(js,/function salesQualified/);assert.match(js,/verifiedGate\(r\)/);
 assert.match(js,/NOT VERIFIED/);
});
test('Independent direct-customer business is a mandatory separate gate',()=>{
 assert.equal(d.rules.independent_direct_market_gate,true);
 assert.equal(d.summary.priority_research,0);
 assert.equal(d.summary.deferred_qa,24);
 assert.equal(d.summary.confirmed_parent_exclusions,1);
 assert.equal(d.summary.direct_customer_verified,0);
 const corporate=records.find(x=>x.name==='ROBET design Group s.r.o.');
 assert.equal(corporate.group_check.status,'corporate_parent_confirmed');
 assert.equal(corporate.review_priority,'Deferred / QA');
 assert.equal(corporate.outreach_status,'EXCLUDED — corporate-owned subsidiary');
 assert.match(corporate.group_check.basis,/Oil Energy/);
 for(const name of ['RONDON DRON s.r.o.','PWB stavební s.r.o.']){
   assert.equal(records.find(x=>x.name===name).review_priority,'Deferred / QA');
 }
 const priority=records.filter(x=>x.review_priority==='Priority research');
 assert.equal(priority.length,0);
 assert.equal(d.summary.verified_standalone_brands,0);
 assert.equal(d.summary.verified_direct_external_customer_operators,0);
 assert.equal(d.rules.standalone_public_facing_brand_gate,true);
 for(const name of ['Orvex Construction s.r.o.','TMZ Air Solutions s.r.o.','D&L BUILD MONT s.r.o.','Lupawood s.r.o.']){
  const r=records.find(x=>x.name===name);
  assert.equal(r.review_priority,'Deferred / QA');
  assert.equal(r.verified_standalone_brand,false);
  assert.equal(r.brand_check.status,'not_verified');
  assert.equal(r.project_vehicle_check.status,'unknown');
 }
 const js=fs.readFileSync(path.join(root,'sales.js'),'utf8');
 assert.match(js,/r.group_check.status==="independent_no_parent_verified"/);
 assert.match(js,/r.direct_customer_check.status==="verified_direct_external_customers"/);
 assert.match(js,/r.public_company_contact_verified===true/);
 assert.match(js,/r.verified_standalone_brand===true/);
 assert.match(js,/r.project_vehicle_check.status==="not_captive_or_spv_verified"/);
 assert.match(js,/r.external_customer_evidence.status==="verified_independent_external_clients"/);
});
test('Legacy radar preserved for previous browser-only CRM',()=>{
 const html=fs.readFileSync(path.join(root,'legacy-radar.html'),'utf8');
 assert.match(html,/app\.js/);assert.match(html,/id="leads-body"/);
 const current=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(current,/sales\.js/);assert.match(current,/legacy-radar\.html/);
 assert.match(current,/data-view="premium"/);assert.match(current,/data-view="qa"/);
});