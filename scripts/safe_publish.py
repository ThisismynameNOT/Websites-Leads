#!/usr/bin/env python3
"""Safe generated-data publisher on the ephemeral GitHub Actions checkout.
Keeps remote edits and freshest public evidence when another push races this run.
No force-push, no rebase of potentially conflicting large JSON blobs.
"""
import datetime as dt
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUTPUTS=("data/leads.json","data/research.json","data/res-candidates.json","data/res-state.json","data/qualification.json")
MAX_RETRIES=4

def git(*args,check=True):
    p=subprocess.run(["git",*args],cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if check and p.returncode:raise RuntimeError("git "+" ".join(args)+" "+p.stderr[-450:])
    return p

def load(p):
    return json.loads((ROOT/p).read_text(encoding="utf8")) if (ROOT/p).exists() else None

def save(p,data):
    destination=ROOT/p
    destination.parent.mkdir(parents=True,exist_ok=True)
    tmp=destination.with_suffix(destination.suffix+".tmp")
    tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    tmp.replace(destination)

def latest(a,b):
    if not a:return b
    if not b:return a
    def key(x):
        return (str(x.get("checked_at") or x.get("last_seen") or x.get("generated_at") or ""),
                int(x.get("engine_version") or 0))
    newest,older=(a,b) if key(a)>=key(b) else (b,a)
    merged={**older,**newest}
    for field in ("email","phone","instagram","website","ico","registered_at","legal_form","nace2025",
                  "operating_address","registered_office_address","source_type"):
        if not merged.get(field) and older.get(field):merged[field]=older[field]
    if a.get("first_seen") or b.get("first_seen"):
        merged["first_seen"]=min((d for d in (a.get("first_seen"),b.get("first_seen")) if d),default="")
    for field in ("source_urls","source_registry_urls"):
        left=a.get(field) or [];right=b.get(field) or []
        if isinstance(left,list) and isinstance(right,list):
            merged[field]=list(dict.fromkeys((left+right)))[:25]
    # A public human curation marker must never be downgraded by collector.
    if a.get("manual") or b.get("manual"):merged["manual"]=True
    return merged

def merge_index(left,right,kind):
    merged={}
    for l in left+right:
        if not isinstance(l,dict):continue
        key=str(l.get(kind) or "")
        if not key:continue
        merged[key]=latest(merged.get(key),l)
    return list(merged.values())

def merge_doc(path,remote,generated):
    if not remote:return generated
    if not generated:return remote
    if path=="data/leads.json":
        doc={**remote,**generated}
        candidates=merge_index(remote.get("leads",[]),generated.get("leads",[]),"id")
        candidates.sort(key=lambda l:(bool(l.get("manual")),bool(l.get("source_type")=="csu_res"),
                                       l.get("last_seen") or "",int(l.get("score") or 0)),reverse=True)
        doc["leads"]=candidates[:1800]
        return doc
    if path=="data/res-candidates.json":
        doc={**remote,**generated}
        doc["leads"]=merge_index(remote.get("leads",[]),generated.get("leads",[]),"ico")[:1100]
        return doc
    if path=="data/research.json":
        reports={**(remote.get("reports") or {})}
        for key,rep in (generated.get("reports") or {}).items():
            existing=reports.get(key)
            if not existing or (rep.get("checked_at",""),rep.get("engine_version",0)) >= (existing.get("checked_at",""),existing.get("engine_version",0)):
                reports[key]=rep
        doc={**remote,**generated,"reports":reports}
        return doc
    if path=="data/res-state.json":
        return generated if str(generated.get("snapshot_at") or "")>=str(remote.get("snapshot_at") or "") else remote
    if path=="data/qualification.json":
        return generated
    return generated

def run():
    generated={path:load(path) for path in OUTPUTS}
    git("config","user.name","fieldnotes-collector[bot]")
    git("config","user.email","41898282+github-actions[bot]@users.noreply.github.com")
    for attempt in range(1,MAX_RETRIES+1):
        git("fetch","origin","main")
        # Only used in GitHub's fresh disposable Actions checkout.
        git("reset","--hard","origin/main")
        for path,incoming in generated.items():
            if incoming is not None:
                save(path,merge_doc(path,load(path),incoming))
        # Compute one authoritative 100-point score against merged latest evidence.
        sys.path.insert(0,str(ROOT/"scripts"))
        import qualify
        qualify.run()
        git("add",*OUTPUTS)
        staged=git("diff","--cached","--quiet",check=False)
        if staged.returncode==0:
            print("No changes to publish; latest remote snapshot retained")
            return
        git("commit","-m","data: discover and qualify Czech website prospects [skip ci]")
        pushed=git("push","origin","HEAD:main",check=False)
        if pushed.returncode==0:
            print("Safely published merged data on attempt",attempt)
            return
        print("Concurrent main update; refetching and reconciling:",attempt,pushed.stderr[-150:],flush=True)
        time.sleep(attempt*2)
    raise RuntimeError("Concurrent pushes persisted; no force push. Generated data must be rerun.")

if __name__=="__main__":run()
