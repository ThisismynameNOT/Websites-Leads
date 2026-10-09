const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'), d=JSON.parse(fs.readFileSync(path.join(root,'data','october-review.json'),'utf8'));
const records=d.records;
test('All twenty-four October source rows unique and auditable',()=>{
 assert.equal(records.length,24); assert.equal(new Set(records.map(r=>r.name)).size,24);
 assert.equal(records.filter(r=>r.review_priority==='Priority research').length,7);
 assert.equal(records.filter(r=>r.review_priority==='Deferred / QA').length,17);
 records.forEach(r=>{assert.match(r.registration_date,/^2026-10-0[3-6]$/);
 assert.ok(r.source_urls.length>=1); assert.match(r.outreach_status,/NOT APPROVED/); assert.ok(r.decision_reason.length>30);
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
test('Legacy radar preserved for previous browser-only CRM',()=>{
 const html=fs.readFileSync(path.join(root,'legacy-radar.html'),'utf8');
 assert.match(html,/app\.js/);assert.match(html,/id="leads-body"/);
 const current=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(current,/sales\.js/);assert.match(current,/legacy-radar\.html/);
 assert.match(current,/data-view="premium"/);assert.match(current,/data-view="qa"/);
});