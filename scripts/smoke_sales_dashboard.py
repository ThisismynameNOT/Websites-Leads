#!/usr/bin/env python3
"""Browser-test the Excel-gated October qualification homepage, without affecting legacy CRM."""
import http.server, threading
from functools import partial
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def main():
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),partial(Handler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
            try:
                for width,height in [(1366,900),(390,844),(320,760)]:
                    page=browser.new_page(viewport={"width":width,"height":height},accept_downloads=True)
                    errors=[]
                    page.on("pageerror",lambda err:errors.append(str(err)))
                    page.goto(f"http://127.0.0.1:{server.server_address[1]}/index.html",wait_until="domcontentloaded")
                    page.wait_for_function('document.getElementById("data-message").textContent.includes("24 October registrations")')
                    assert page.get_by_text("No proven independent public-facing brands.").count()==1
                    assert page.get_by_text("0 outreach approved").count()==1
                    assert page.locator(".priority").count()==0
                    assert page.locator("#main-nav button").count()==6
                    assert page.locator('a[href="./legacy-radar.html"]').count()>=1
                    assert not page.evaluate("document.documentElement.scrollWidth > window.innerWidth+3"),f"horizontal document overflow at {width}"
                    page.locator('button[data-view="premium"]').click()
                    assert page.get_by_text("No companies passed the gate").count()==1
                    page.locator('button[data-view="new"]').click()
                    assert page.get_by_text("No companies passed the gate").count()==1
                    page.locator('button[data-view="queue"]').click()
                    assert page.locator(".table tbody tr").count()==0
                    assert page.get_by_text("No matching companies").count()==1
                    page.locator('button[data-view="qa"]').click()
                    page.locator(".table button[data-dossier]").first.click()
                    assert page.locator("#modal-overlay").is_visible()
                    assert page.get_by_text("NOT APPROVED.").count()>0
                    assert page.get_by_text("Standalone public-facing brand").count()==1
                    page.locator("#close-panel").click()
                    assert page.locator("#modal-overlay").is_hidden()
                    assert page.locator(".table tbody tr").count()==24
                    page.locator("#company-search").fill("ROBET")
                    assert page.locator(".table tbody tr").count()==1
                    assert page.get_by_text("CORPORATE PARENT").count()==1
                    with page.expect_download(timeout=10000) as d:
                        page.locator("#csv-btn").click()
                    assert d.value.suggested_filename.endswith("qa.csv")
                    page.locator('button[data-view="method"]').click()
                    assert page.get_by_text("Six mandatory domain checks").count()==1
                    assert page.get_by_text("No parent group; outside customers").count()==1
                    assert page.get_by_text("Public-facing is more than legal ownership").count()==1
                    assert not errors,errors
                    page.close()
                print("PASS: Excel-rule dashboard at desktop + mobile, zero brand-ready research, 24 QA, zero qualified, dossiers, CSV, search, legacy CRM")
            finally:
                browser.close()
    finally:
        server.shutdown();server.server_close()

if __name__=="__main__":
    main()
