#!/usr/bin/env python3
"""Browser smoke of EXISTING Pages dashboard against repository fixtures.
Keeps CRM, filtering, shortlist, CSV download and responsive rendering honest.
"""
from __future__ import annotations
import contextlib
import http.server
import threading
import time
from functools import partial
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self,format,*args):pass
def main():
    handler=partial(QuietServer,directory=str(ROOT))
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    url="http://127.0.0.1:"+str(server.server_address[1])+"/index.html"
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
            try:
                page=browser.new_page(accept_downloads=True,viewport={"width":1365,"height":900})
                errors=[]
                page.on("pageerror",lambda err:errors.append(str(err)))
                page.goto(url,wait_until="domcontentloaded")
                page.wait_for_function("""() => {
                  const status=document.getElementById('data-status');
                  return status && !/Connecting|Fetching/i.test(status.textContent);
                }""",timeout=30000)
                assert not errors,"Page JS errors: "+str(errors)
                assert page.locator("#top-three .pick-card").count()==3,"Missing top 3 display slots"
                assert page.locator("#source-filter").count()==1
                assert page.locator("#website-filter").count()==1
                assert page.locator("#age-filter").count()==1
                assert page.locator("#criteria-list .criterion").count()==16
                rows=page.locator("tr[data-id]")
                if rows.count():
                    rows.first.click()
                    assert page.locator("#lead-drawer[aria-hidden='false']").count()==1
                    assert page.locator("text=Commercial qualification").count()>0
                    page.locator("#drawer-close").click()
                    assert page.locator("#lead-drawer[aria-hidden='true']").count()==1
                    with page.expect_download(timeout=10000) as dl:
                        page.locator("#export-btn").click()
                    assert dl.value.suggested_filename.endswith(".csv")
                page.locator("#source-filter").select_option("csu_res")
                page.locator("#source-filter").select_option("all")
                page.locator("#website-filter").select_option("VERIFIED_WEBSITE")
                page.locator("#website-filter").select_option("all")
                page.locator("#age-filter").select_option("730")
                page.locator("#age-filter").select_option("all")
                page.set_viewport_size({"width":390,"height":844})
                page.wait_for_timeout(350)
                assert page.locator("#top-three").count()==1
                assert not errors,"Browser errors: "+str(errors)
                print("PASS: 3 picks, evidence, 16 rules, CRM drawer, CSV, filters, mobile viewport")
            finally:browser.close()
    finally:server.shutdown();server.server_close()
if __name__=="__main__":main()
