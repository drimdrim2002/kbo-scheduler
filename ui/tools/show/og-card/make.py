#!/usr/bin/env python3
"""카카오톡·SNS 미리보기 그림(1200×630) 만들기(2026-11-08, 사용자 선택: 마스코트 한 장).

  python3 make.py <안>      -> out/card-<안>.png
  안: std(표준: 연한 파랑 바탕 + 마스코트 + 글) / dark(옵션 1 · 바탕: 진한 파랑) / brand(옵션 2 · 글: 이름만) / center(옵션 3 · 배치: 가운데)

쓰는 그림은 ui/show/share-matchbot-<번호>.png 로 복사하고, 다섯 쪽 og:image 를 그 주소로 바꾼다.
카카오는 같은 그림 주소를 오래 기억하므로 그림을 바꿀 때마다 번호를 올린다.
Jua 글꼴은 구글 폰트라 인터넷이 필요하다.
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'mascot'))
import mascot  # noqa: E402

CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
TITLE = 'KBO 144경기 일정,<br>매치봇이 다시 만든다면?'
SUB = '2025 KBO와 같은 대진·같은 규칙으로 다시 짠 일정'

CSS = """
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
body { font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif; color: #1f2430; background: #eef3ff; position: relative; }
.bot { width: 330px; height: 330px; display: block; flex: none; }
.wm { font-family: 'Jua', sans-serif; font-size: 64px; line-height: 1; color: #3b6cf4; margin: 0 0 22px; }
.h { font-size: 56px; font-weight: 800; line-height: 1.22; letter-spacing: -.02em; margin: 0 0 22px; }
.s { font-size: 28px; color: #555d6e; margin: 0; letter-spacing: -.01em; }
.url { position: absolute; right: 56px; bottom: 40px; font-size: 24px; font-weight: 700; color: #2546a8; letter-spacing: .01em; }
.row { position: absolute; inset: 0 72px 0 84px; display: flex; align-items: center; gap: 64px; }
.deco { position: absolute; right: -120px; top: -160px; width: 520px; height: 520px; border-radius: 50%; background: #dfe9ff; }
.dark { background: linear-gradient(135deg, #2546a8, #3b6cf4); color: #fff; }
.dark .wm { color: #fff; } .dark .s { color: #dfe9ff; } .dark .url { color: #fff; } .dark .deco { background: rgba(255,255,255,.08); }
.brand .row { justify-content: center; gap: 56px; } .brand .wm { font-size: 150px; margin: 0 0 18px; } .brand .s { font-size: 34px; }
.center .row { flex-direction: column; justify-content: center; gap: 18px; text-align: center; inset: 0; }
.center .bot { width: 240px; height: 240px; } .center .wm { display: none; } .center .h { font-size: 54px; margin: 0 0 14px; }
"""


def page(v):
    syms = ''.join(mascot.symbols('std'))
    if v == 'brand':
        text = '<div><p class="wm">매치봇</p><p class="s">KBO 일정을 다시 만드는 최적화 엔진</p></div>'
    elif v == 'center':
        text = '<div><p class="h">KBO 144경기 일정, 매치봇이 다시 만든다면?</p><p class="s">%s</p></div>' % SUB
    else:
        text = '<div><p class="wm">매치봇</p><p class="h">%s</p><p class="s">%s</p></div>' % (TITLE, SUB)
    return ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&display=block">'
            '<style>%s</style></head><body class="%s"><svg width="0" height="0" style="position:absolute">%s</svg>'
            '<div class="deco"></div><div class="row"><svg class="bot" viewBox="0 0 100 100"><use href="#mb-bot"/></svg>%s</div>'
            '<div class="url">schedulelab.kr</div></body></html>') % (CSS, v, syms, text)


def render(v):
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    html = os.path.join(HERE, 'out', 'card-%s.html' % v)
    png = os.path.join(HERE, 'out', 'card-%s.png' % v)
    open(html, 'w', encoding='utf-8').write(page(v))
    with tempfile.TemporaryDirectory() as prof:
        subprocess.run([CH, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--user-data-dir=' + prof,
                        '--window-size=1200,630', '--virtual-time-budget=6000', '--screenshot=' + png, 'file://' + html],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    print(png)


if __name__ == '__main__':
    for v in sys.argv[1:] or ['std', 'dark', 'brand', 'center']:
        render(v)
