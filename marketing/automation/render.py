"""Create high-quality FC ARENA 4:5 feed posters from licensed in-project cinematic art.
No paid image API; supplied artwork is edited with new typography and layout per day.
"""
import argparse
import hashlib
import math
from datetime import date
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageEnhance

ROOT = Path(__file__).resolve().parent
GRID = ROOT / "assets/cinematic-grid.jpg"
LOGO = ROOT.parent.parent / "apps/web/public/icons/brand-full.png"
W,H = 1080,1350
NAVY=(4,12,29); GOLD=(244,188,75); WHITE=(247,248,252)

CAMPAIGNS=[
 ("YOUR FOOTBALL WORLD","BUILT TO COMPETE","Leagues, tournaments, rankings and rivalries.","DOWNLOAD FC ARENA"),
 ("JOIN THE ARENA","FIND YOUR RIVALS","Meet the FC ARENA TAMIL community.","JOIN FC ARENA TAMIL"),
 ("THE CHALLENGE AWAITS","ENTER THE TOURNAMENT","Prove your skills in EA FC Mobile competitions.","EXPLORE TOURNAMENTS"),
 ("MATCHDAY IS HERE","KNOW YOUR OPPONENT","Fixtures and matchdays in one arena.","CHECK YOUR FIXTURES"),
 ("EVERY POINT MATTERS","CLIMB THE RANKINGS","Follow your competitive journey.","EXPLORE RANKINGS"),
 ("CHASE THE GOLD","THE GOLDEN BOOT","Every goal matters in the FC ARENA.","MAKE YOUR MARK"),
 ("DEFENCE WINS GLORY","THE CLEAN SHEET","Every great match needs a strong defence.","COMPETE IN FC ARENA"),
 ("BUILD YOUR LEGACY","BALLON D'OR SEASON","Great performances shape the season.","EXPLORE FC ARENA"),
 ("PROVE IT ON THE PITCH","SUBMIT YOUR RESULT","Record your match and move forward.","PLAY YOUR NEXT MATCH"),
 ("ONE COMMUNITY","ENDLESS RIVALRIES","Bring your football gaming skills together.","FIND YOUR LEAGUE"),
 ("YOUR JOURNEY","YOUR RECORDS","Make every match part of your story.","COMPETE TODAY"),
 ("RIVALS WANTED","ANSWER THE CHALLENGE","It's your time to take the pitch.","JOIN THE ARENA"),
 ("READY FOR KICKOFF","JOIN THE COMPETITION","Download, log in and explore tournaments.","DOWNLOAD THE APP"),
 ("PLAY. COMPETE. BELONG.","THIS IS FC ARENA","A dedicated EA FC Mobile community.","EXPLORE FC ARENA")
]

def font(sz,bold=True):
    paths=(["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"]
           if bold else
           ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"])
    for p in paths:
        if Path(p).exists(): return ImageFont.truetype(p,sz)
    return ImageFont.load_default()

def center(draw,word,y,f,fill,stroke=0):
    b=draw.textbbox((0,0),word,font=f,stroke_width=stroke)
    x=(W-(b[2]-b[0]))//2
    draw.text((x,y),word,font=f,fill=fill,stroke_width=stroke,
              stroke_fill=(22,15,13) if stroke else None)

def background(day):
    with Image.open(GRID) as raw:
        src=raw.convert("RGB")
        pw,ph=src.size
        k=day.toordinal()%4
        col=k%2;row=k//2
        # Avoid the narrow white cross-lines separating our four original scenes.
        x0=round(col*pw/2)+(8 if col else 0)
        x1=round((col+1)*pw/2)-(9 if not col else 0)
        y0=round(row*ph/2)+(8 if row else 0)
        y1=round((row+1)*ph/2)-(9 if not row else 0)
        cropped=src.crop((x0,y0,x1,y1))
        image=ImageOps.fit(cropped,(W,H),method=Image.Resampling.LANCZOS,centering=(0.42+0.08*(day.toordinal()%3),0.40+0.10*(day.toordinal()%3)))
        if day.toordinal() % 3 == 0:\n            image=ImageOps.mirror(image)\n        image=ImageEnhance.Color(image).enhance(1.04+(day.toordinal()%7)*0.027)
        image=ImageEnhance.Contrast(image).enhance(1.06)
        return image.convert("RGBA")

def generate(day,output):
    index=day.toordinal()%len(CAMPAIGNS)
    kicker,head,sub,cta=CAMPAIGNS[index]
    art=background(day)
    shade=Image.new("RGBA",(W,H),(0,0,0,0))
    overlay=ImageDraw.Draw(shade,"RGBA")
    # Atmosphere: dark readable title area, still-visible dramatic hero.
    for y in range(H):
        if y<510:
            alpha=int(220*(1-y/600)**0.55)+22
        elif y<850:
            alpha=19
        else:
            alpha=int(24+(y-850)/500*204)
        alpha=max(0,min(245,alpha))
        overlay.line((0,y,W,y),fill=(*NAVY,alpha))
    art=Image.alpha_composite(art,shade)
    d=ImageDraw.Draw(art,"RGBA")
    # Logo strictly uses official in-repo image, not an AI recreation.
    with Image.open(LOGO) as logo_file:
        logo=logo_file.convert("RGBA")
        logo.thumbnail((640,240),Image.Resampling.LANCZOS)
        art.alpha_composite(logo,((W-logo.width)//2,45))
    d=ImageDraw.Draw(art,"RGBA")
    d.line((170,290,910,290),fill=(*GOLD,160),width=3)
    center(d,kicker,320,font(30),GOLD)
    f=font(68)
    while d.textbbox((0,0),head,font=f)[2]>950 and f.size>42:
        f=font(f.size-2)
    center(d,head,381,f,WHITE,1)
    # Minimal copy keeps the dramatic stadium/player/trophy visible.
    d.rounded_rectangle((95,1010,985,1100),radius=20,
                        fill=(3,12,28,210),outline=(*GOLD,110),width=2)
    sf=font(29,False)
    while d.textbbox((0,0),sub,font=sf)[2]>840 and sf.size>19:
        sf=font(sf.size-1,False)
    center(d,sub,1038,sf,WHITE)
    d.rounded_rectangle((150,1140,930,1245),radius=25,
                        fill=(*GOLD,255),outline=(255,225,150,255),width=3)
    cf=font(39)
    while d.textbbox((0,0),cta,font=cf)[2]>715 and cf.size>27:
        cf=font(cf.size-1)
    center(d,cta,1167,cf,NAVY)
    center(d,"FC ARENA  •  EA FC MOBILE  •  fcarena.in",1283,font(24,False),WHITE)
    out=Path(output);out.parent.mkdir(parents=True,exist_ok=True)
    art.convert("RGB").save(out,format="JPEG",quality=89,optimize=True,progressive=False)
    print(f"FC ARENA premium poster ready: {out} | {day.isoformat()} | design {index+1}")
    return out

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--date",default=date.today().isoformat())
    p.add_argument("--output",default="output/fc-arena-premium.jpg")
    args=p.parse_args()
    generate(date.fromisoformat(args.date),args.output)
