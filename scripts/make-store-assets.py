#!/usr/bin/env python3
"""Regenera as imagens das lojas em store/ (promo tiles + screenshot do popup).

Requisitos: pip install pillow playwright  (e um Chromium para o playwright).
Uso:  python3 scripts/make-store-assets.py "Hiraku" "Codeforces"
      (os dois argumentos são as linhas do nome mostradas nos tiles)
As capturas dentro do próprio Codeforces você tira à mão (ver docs/PUBLISHING.md).
"""
import io, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "store")
BOLD = next(p for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/Library/Fonts/Arial Bold.ttf", "C:/Windows/Fonts/arialbd.ttf") if os.path.exists(p))
REG = next(p for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/Library/Fonts/Arial.ttf", "C:/Windows/Fonts/arial.ttf") if os.path.exists(p))
LINE1, LINE2 = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("Hiraku", "Codeforces")

def gradient(w, h, c1=(18, 22, 36), c2=(52, 40, 110)):
    im = Image.new("RGB", (w, h)); px = im.load()
    for y in range(h):
        for x in range(w):
            t = x / w * 0.6 + y / h * 0.4
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return im.convert("RGBA")

def logo(size):
    S = size * 3; im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); g = Image.new("RGBA", (S, S)); p = g.load()
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * S)
            p[x, y] = (int(91 + 64 * t), int(124 - 32 * t), int(250 + 5 * t), 255)
    m = Image.new("L", (S, S), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * .24), fill=255)
    im.paste(g, (0, 0), m)
    d = ImageDraw.Draw(im); f = ImageFont.truetype(BOLD, int(S * .62)); bb = d.textbbox((0, 0), "H", font=f)
    d.text(((S - (bb[2] - bb[0])) / 2 - bb[0], (S - (bb[3] - bb[1])) / 2 - bb[1]), "H", font=f, fill="white")
    return im.resize((size, size), Image.LANCZOS)

def tile(w, h, name, ts, ss, ls, fs):
    im = gradient(w, h); d = ImageDraw.Draw(im)
    im.alpha_composite(logo(ls), (int(w * 0.07), (h - ls) // 2 - int(h * 0.04)))
    x = int(w * 0.07) + ls + int(w * 0.04); cy = h // 2 - int(h * 0.04)
    ft, fsub, ff = (ImageFont.truetype(BOLD, ts), ImageFont.truetype(REG, ss), ImageFont.truetype(REG, fs))
    d.text((x, cy - ts - 2), LINE1, font=ft, fill="white")
    d.text((x, cy + 2), LINE2, font=ft, fill=(160, 180, 255))
    d.text((x, cy + ts + 14), "Modern theme · Math-safe translation", font=fsub, fill=(205, 210, 230))
    d.text((int(w * 0.07), h - fs - int(h * 0.07)), "Unofficial extension — not affiliated with Codeforces", font=ff, fill=(150, 156, 185))
    im.convert("RGB").save(os.path.join(OUT, name)); print("✔", name)

STUB = """window.chrome={storage:{local:{get:async d=>({...d,uiLang:'en',theme:'%T%',accent:'%A%'}),set:async()=>{}}},
tabs:{query:async()=>[{id:1}],sendMessage:async()=>({ok:true,hasStatement:true,mode:'orig'})},
runtime:{sendMessage:async()=>({ok:true,text:'ok'})},i18n:{getUILanguage:()=>'en'}};"""

def popup(theme, scheme, accent):
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_context(viewport={"width": 340, "height": 700}, device_scale_factor=2, color_scheme=scheme).new_page()
        pg.add_init_script(STUB.replace("%T%", theme).replace("%A%", accent))
        pg.goto("file://" + os.path.join(ROOT, "popup", "popup.html")); pg.wait_for_timeout(400)
        png = pg.locator("main").screenshot(); b.close()
    return Image.open(io.BytesIO(png)).convert("RGBA")

def paste_card(canvas, card, x, y, width):
    card = card.resize((width, int(card.height * width / card.width)), Image.LANCZOS)
    mask = Image.new("L", card.size, 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, card.width - 1, card.height - 1), radius=20, fill=255)
    sh = Image.new("L", (card.width + 160, card.height + 160), 0)
    ImageDraw.Draw(sh).rounded_rectangle((80, 95, 80 + card.width, 95 + card.height), radius=20, fill=170)
    canvas.paste((0, 0, 0, 255), (x - 80, y - 80), sh.filter(ImageFilter.GaussianBlur(26)))
    canvas.paste(card, (x, y), mask)

def screenshot():
    c = gradient(1280, 800); d = ImageDraw.Draw(c)
    big, reg = ImageFont.truetype(BOLD, 56), ImageFont.truetype(REG, 24)
    d.text((70, 150), "Make Codeforces", font=big, fill="white")
    d.text((70, 220), "yours.", font=big, fill=(160, 180, 255))
    for i, t in enumerate(("Light, dark or automatic theme", "Your accent color, font and text size", "English and Portuguese interface")):
        d.text((70, 340 + i * 42), "•  " + t, font=reg, fill=(205, 210, 230))
    paste_card(c, popup("dark", "dark", "#5b7cfa"), 640, 60, 270)
    paste_card(c, popup("light", "light", "#8b5cf6"), 940, 130, 270)
    c.convert("RGB").save(os.path.join(OUT, "screenshots", "01-popup-1280x800.png")); print("✔ screenshots/01-popup-1280x800.png")

os.makedirs(os.path.join(OUT, "screenshots"), exist_ok=True)
tile(440, 280, "promo-small-440x280.png", 36, 14, 92, 11)
tile(1400, 560, "promo-marquee-1400x560.png", 78, 28, 230, 22)
screenshot()
