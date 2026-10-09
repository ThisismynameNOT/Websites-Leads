const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'), d=JSON.parse(fs.readFileSync(path.join(root,'data','october-review.json'),'utf8'));
const records=d.records;
test('All twenty-four October source rows unique and auditable',()=>{
 assert.equal(records.length,24); assert.equal(new Set(records.map(r=>r.name)).size,24);
 assert.equal(records.filter(r=>r.review_priority==='Priority research').length,4);
 assert.equal(records.filter(r=>r.review_priority==='Deferred / QA').length,20);
 records.forEach(r=>{assert.match(r.registration_date,/^2026-10-0[3-6]$/);
 assert.ok(r.source_urls.length>=1); assert.match(r.outreach_status,/NOT APPROVED/); assert.ok(r.decision_reason.length>30);
 assert.equal(r.eligible_for_outreach,false); assert.ok(r.group_check&&r.group_check.status); assert.equal(r.direct_customer_check.status,'not_verified');
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
 assert.equal(d.summary.priority_research,4);
 assert.equal(d.summary.deferred_qa,20);
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
 assert.equal(priority.length,4);
 priority.forEach(x=>assert.equal(x.group_check.status,'individual_wholly_owned_legal_record'));
 const js=fs.readFileSync(path.join(root,'sales.js'),'utf8');
 assert.match(js,/r.group_check.status==="independent_no_parent_verified"/);
 assert.match(js,/r.direct_customer_check.status==="verified_direct_external_customers"/);
 assert.match(js,/r.public_company_contact_verified===true/);
});
test('Legacy radar preserved for previous browser-only CRM',()=>{
 const html=fs.readFileSync(path.join(root,'legacy-radar.html'),'utf8');
 assert.match(html,/app\.js/);assert.match(html,/id="leads-body"/);
 const current=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(current,/sales\.js/);assert.match(current,/legacy-radar\.html/);
 assert.match(current,/data-view="premium"/);assert.match(current,/data-view="qa"/);
});