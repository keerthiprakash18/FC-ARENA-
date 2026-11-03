"""Keep a rolling public FC ARENA Instagram-image library ready for schedulers.

Runs on GitHub-hosted Linux; does not require Gemini API credits, laptop,
Instagram credentials, Meta tokens, Metricool keys or external storage.
It composites licensed/in-project cinematic artwork and FC ARENA branding;
it is NOT a new diffusion-model image generation call.
"""
import argparse
import os
from datetime import datetime, timedelta, date
from pathlib import Path
from zoneinfo import ZoneInfo
from render import generate

ROOT=Path(__file__).resolve().parents[2]
MEDIA=ROOT/"marketing"/"instagram"

def build_queue(today,days=60,max_new=80):
    if days<1 or days>100 or max_new<1 or max_new>100:
        raise ValueError("Unsafe poster generation limits")
    made=[]
    for offset in range(1,days+1):
        d=today+timedelta(days=offset)
        path=MEDIA/(d.isoformat()+".jpg")
        if path.is_file():
            continue
        if len(made)>=max_new:
            break
        generate(d,path)
        made.append(path)
    print(f"FC ARENA rolling poster queue: {len(made)} new JPEGs; horizon {days} days")
    return made

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--days",type=int,default=60)
    p.add_argument("--max-new",type=int,default=80)
    a=p.parse_args()
    # Optional explicit date for deterministic CI testing; production uses IST.
    start=os.environ.get("RENDER_START_DATE")
    today=date.fromisoformat(start) if start else datetime.now(ZoneInfo("Asia/Kolkata")).date()
    build_queue(today,a.days,a.max_new)
