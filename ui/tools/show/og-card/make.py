#!/usr/bin/env python3
"""카카오톡·SNS 미리보기 그림(1200×630) 만들기(2026-11-08, 사용자 선택: 마스코트 한 장).

  python3 make.py <안>      -> out/card-<안>.png
  배치(2026-11-08 고름: 연한 파랑 바탕 + 왼쪽 마스코트 + 오른쪽 글)는 그대로 두고 글만 안마다 다르다.
  안: std(표준 · 쓰는 그림 share-matchbot-2.png: 스튜디오 정의 + 질문 부제) / num(옵션 · 2025 결과 숫자) / ask(옵션 · 질문을 큰 글로)
  (처음 카드의 「다시 만든다면?」 글은 매치봇을 재편성 프로그램처럼 보이게 해서 2026-11-08에 바꿨다.)

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
COPY = dict(
    std=('KBO 일정을<br>직접 짜 보는 스튜디오', '운영 방침을 바꾸면 일정은 어떻게 달라질까?'),
    num=('KBO 일정을<br>직접 짜 보는 스튜디오', '2025 일정으로 해 보니 총 이동거리 13% 감소'),
    ask=('운영 방침을 바꾸면<br>일정은 어떻게 달라질까?', 'KBO 일정을 직접 짜 보는 스튜디오'),
)

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
"""


def page(v):
    syms = ''.join(mascot.symbols('std'))
    h, sub = COPY[v]
    text = '<div><p class="wm">매치봇</p><p class="h">%s</p><p class="s">%s</p></div>' % (h, sub)
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
    for v in sys.argv[1:] or list(COPY):
        render(v)
