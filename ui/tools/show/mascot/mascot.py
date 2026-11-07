#!/usr/bin/env python3
"""매치봇 마스코트 그림 만들기(2026-11-08, 사용자 선택: A 다듬기).

  python3 mascot.py apply <안> <html...>   쪽마다 들어 있는 <symbol id="mb-bot..."> 를 그 안으로 바꿔 끼운다(그 쪽에 있던 표정만)
  python3 mascot.py gallery <out.html>      표준과 옵션을 실제 크기로 나란히 보는 비교 화면

안: std(표준) / eyes(동그란 눈) / noant(안테나 없이 머리 모서리 불빛) / white(흰 화면 + 진한 머리)
"""
import re
import sys

C = dict(blue='#3b6cf4', deep='#2546a8', screen='#e6eeff', ink='#1f2430', mint='#7ef0d0', yellow='#ffc53d', green='#3ccf8e')
LIGHT = dict(normal=(C['mint'], ''), think=(C['yellow'], ' class="mb-blink"'), done=(C['green'], ''), sleep=(C['mint'], ' opacity=".4"'))
STATES = [('normal', 'mb-bot'), ('think', 'mb-bot-think'), ('done', 'mb-bot-done'), ('sleep', 'mb-bot-sleep')]
VARIANTS = dict(std='A 표준', eyes='옵션 1 · 눈', noant='옵션 2 · 안테나', white='옵션 3 · 화면 색')


def n(v):
    return ('%.2f' % v).rstrip('0').rstrip('.')


def face(state, fx, fy, s, ink, round_eyes=False):
    ex, ew, eh, sw = 10.5 * s, 8 * s, 12.5 * s, 3.6 * s
    if round_eyes:
        ew = eh = 9.5 * s
    out = []

    def eye(cx, dx=0, dy=0):
        return '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>' % (n(cx - ew / 2 + dx), n(fy - 4 * s - eh / 2 + dy), n(ew), n(eh), n(ew / 2), ink)

    def line(d):
        return '<path d="%s" stroke="%s" stroke-width="%s" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' % (d, ink, n(sw))

    my = fy + 9.5 * s
    if state == 'normal':
        out += [eye(fx - ex), eye(fx + ex), line('M%s %s q%s %s %s 0' % (n(fx - 6 * s), n(my), n(6 * s), n(4.5 * s), n(12 * s)))]
    elif state == 'think':
        out += [eye(fx - ex, 2 * s, -1.5 * s), eye(fx + ex, 2 * s, -1.5 * s), line('M%s %s h%s' % (n(fx - 4.5 * s), n(my + s), n(9 * s)))]
    elif state == 'done':
        ey = fy - 3 * s
        for cx in (fx - ex, fx + ex):
            out.append(line('M%s %s q%s %s %s 0' % (n(cx - 5 * s), n(ey + 2.5 * s), n(5 * s), n(-6 * s), n(10 * s))))
        out.append('<path d="M%s %s q%s %s %s 0 z" fill="%s"/>' % (n(fx - 8 * s), n(my - 1.5 * s), n(8 * s), n(9 * s), n(16 * s), ink))
    elif state == 'sleep':
        for cx in (fx - ex, fx + ex):
            out.append(line('M%s %s h%s' % (n(cx - 4 * s), n(fy - 2 * s), n(8 * s))))
        out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>' % (n(fx), n(my + s), n(2.6 * s), n(3.2 * s), ink))
    return ''.join(out)


def zz(x, y, color):
    return '<text x="%s" y="%s" font-family="Jua, sans-serif" font-size="13" fill="%s">z</text><text x="%s" y="%s" font-family="Jua, sans-serif" font-size="9" fill="%s">z</text>' % (x, y, color, x + 7, y - 9, color)


def symbols(v):
    """안 v의 심볼들: mb-bot-body(머리) + 표정 4개."""
    head, screen = C['blue'], C['screen']
    if v == 'white':
        head, screen = C['deep'], '#ffffff'
    body = '<rect x="12" y="19" width="76" height="70" rx="26" fill="%s"/><rect x="21" y="30" width="58" height="48" rx="17" fill="%s"/>' % (head, screen)
    if v != 'noant':
        body = '<rect x="48" y="7" width="4" height="13" rx="2" fill="%s"/>' % C['deep'] + body
    syms = ['<symbol id="mb-bot-body" viewBox="0 0 100 100">' + body + '</symbol>']
    for st, sid in STATES:
        col, extra = LIGHT[st]
        if v == 'noant':
            light = '<circle cx="74" cy="24" r="6" fill="%s" stroke="#fff" stroke-width="2"%s/>' % (col, extra)
        else:
            light = '<circle cx="50" cy="8" r="5.5" fill="%s" stroke="%s" stroke-width="1.5"%s/>' % (col, C['deep'], extra)
        f = face(st, 50, 54, 1.05, C['ink'], round_eyes=(v == 'eyes'))
        if st == 'sleep':
            f += zz(80, 24, C['deep']) if v != 'noant' else zz(26, 22, C['deep'])
        syms.append('<symbol id="%s" viewBox="0 0 100 100"><use href="#mb-bot-body"/>%s%s</symbol>' % (sid, light, f))
    return syms


SYM_RE = re.compile(r'[ \t]*<symbol id="(mb-bot[a-z-]*)" viewBox="0 0 100 100">.*?</symbol>\n?', re.S)


def apply(v, files):
    new = {re.match(r'<symbol id="([^"]+)"', s).group(1): s for s in symbols(v)}
    for path in files:
        src = open(path, encoding='utf-8').read()
        seen = []

        def rep(m):
            seen.append(m.group(1))
            return '    ' + new[m.group(1)] + '\n'
        out = SYM_RE.sub(rep, src)
        if 'mb-bot-body' not in seen:
            raise SystemExit('%s: 마스코트 심볼을 못 찾음' % path)
        open(path, 'w', encoding='utf-8').write(out)
        print('%s: %s' % (path, ', '.join(seen)))


def gallery(out):
    rows = []
    for v, name in VARIANTS.items():
        defs = ''.join(s.replace('id="mb-', 'id="%s-mb-' % v).replace('href="#mb-', 'href="#%s-mb-' % v) for s in symbols(v))
        u = lambda sid: '<svg aria-hidden="true"><use href="#%s-%s"/></svg>' % (v, sid)
        faces = ''.join('<figure>%s%s</figure>' % (u(sid), lab) for (st, sid), lab in zip(STATES, ['기본', '계산 중', '완료', '대기']))
        note = dict(std='귀·반짝이·막대를 빼고 한 가지 파랑. 눈을 키웠어요.', eyes='표준에서 눈만 동그란 점으로. 더 귀여운 쪽.',
                    noant='표준에서 안테나를 빼고, 상태 불빛을 머리 오른쪽 위로. 더 단정한 쪽.', white='표준에서 화면을 흰색, 머리를 진한 파랑으로. 대비가 강한 쪽.')[v]
        rows.append('<section class="card"><svg width="0" height="0" style="position:absolute">%s</svg><div class="name">%s<b>%s</b><span>%s</span></div>'
                    '<div><div class="bar">%s<span class="wm">매치봇</span></div><div class="tiny">%s<span>16px</span></div></div>'
                    '<div class="say">%s<p>규칙을 다 지키는 일정은 셀 수 없이 많아요. 제 결정구는 그중 하나를 만들어 고치는 거예요.</p></div><div class="faces">%s</div></section>'
                    % (defs, '<span class="tag">표준</span>' if v == 'std' else '', name, note, u('mb-bot'), u('mb-bot'), u('mb-bot-think'), faces))
    html = open(__file__.replace('mascot.py', 'gallery-a.tpl.html'), encoding='utf-8').read().replace('<!--ROWS-->', '\n'.join(rows))
    open(out, 'w', encoding='utf-8').write(html)
    print(out)


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == 'apply':
        apply(sys.argv[2], sys.argv[3:])
    elif len(sys.argv) == 3 and sys.argv[1] == 'gallery':
        gallery(sys.argv[2])
    else:
        print(__doc__)
