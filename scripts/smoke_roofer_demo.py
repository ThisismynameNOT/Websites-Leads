#!/usr/bin/env python3
"""Browser proof of the separate, user-facing, self-contained Prague roofer demo."""
import contextlib
import http.server
import threading
from functools import partial
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def run():
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),partial(QuietServer,directory=str(ROOT)))
    t=threading.Thread(target=server.serve_forever,daemon=True)
    t.start()
    url=f"http://127.0.0.1:{server.server_address[1]}/demos/majer-roofing/"
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
            try:
                for width,height in ((1366,900),(390,844),(320,740)):
                    page=browser.new_page(viewport={"width":width,"height":height},reduced_motion="reduce")
                    errors=[]
                    page.on("pageerror",lambda e:errors.append(str(e)))
                    page.goto(url,wait_until="load")
                    assert page.locator("html").get_attribute("lang")=="cs"
                    assert page.locator("meta[name=robots]").get_attribute("content").startswith("noindex")
                    assert page.locator(".preview").is_visible()
                    assert page.locator("h1").count()==1
                    assert page.locator(".service").count()==6
                    assert page.locator(".project").count()==3
                    assert page.locator('a[href^="tel:"]').count()>=1
                    assert page.locator('a[href^="mailto:"]').count()>=1
                    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth+2"),f"Overflow at {width}px"
                    if width<=600:
                        btn=page.locator(".menu-toggle")
                        assert btn.is_visible()
                        btn.click()
                        assert btn.get_attribute("aria-expanded")=="true"
                        assert page.locator('nav a[href="#realizace"]').is_visible()
                        page.locator('nav a[href="#realizace"]').click()
                        assert btn.get_attribute("aria-expanded")=="false"
                    assert not errors,f"JS error at {width}: {errors}"
                    page.close()
                print("PASS: Czech Majer concept / 1366, 390, 320px / no overflows / usable mobile nav / no JS errors")
            finally:browser.close()
    finally:server.shutdown();server.server_close()

if __name__=="__main__":run()
